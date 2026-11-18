const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

// All dashboard routes require authentication
router.use(auth);

// ─── Summary: totals by category and by month ────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = { userId: req.userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) where.date.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          where.date.lte = end;
        }
      }
    }

    // Fetch all expenses in the given range
    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true },
    });

    // Aggregate totals by category
    const byCategory = {};
    const byMonth = {};
    let total = 0;

    expenses.forEach(expense => {
      total += expense.amount;

      // ── By category ──
      const catKey = expense.categoryId;
      if (!byCategory[catKey]) {
        byCategory[catKey] = {
          name: expense.category.name,
          color: expense.category.color,
          icon: expense.category.icon,
          total: 0,
          count: 0,
        };
      }
      byCategory[catKey].total += expense.amount;
      byCategory[catKey].count += 1;

      // ── By month ──
      const d = new Date(expense.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { month: monthKey, total: 0, count: 0 };
      }
      byMonth[monthKey].total += expense.amount;
      byMonth[monthKey].count += 1;
    });

    res.json({
      total: Math.round(total * 100) / 100,
      expenseCount: expenses.length,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    });
  } catch (error) {
    securityLogger.error('DASHBOARD_SUMMARY_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener resumen.' });
  }
});

// ─── AI Financial Advisor / Insights (Gemini + Local Heuristics) ───────
router.get('/ai-insights', async (req, res) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Current Month expenses
    const currentExpenses = await prisma.expense.findMany({
      where: {
        userId: req.userId,
        date: { gte: startOfCurrentMonth },
      },
      include: { category: true },
      orderBy: { amount: 'desc' },
    });

    // Previous Month expenses
    const prevExpenses = await prisma.expense.findMany({
      where: {
        userId: req.userId,
        date: { gte: startOfPreviousMonth, lte: endOfPreviousMonth },
      },
    });

    // Budgets
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId },
      include: { category: true },
    });

    const currentTotal = currentExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const prevTotal = prevExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    // Calculate Category Breakdown
    const catMap = {};
    const merchantMap = {};
    for (const exp of currentExpenses) {
      const cName = exp.category?.name || 'Otros';
      catMap[cName] = (catMap[cName] || 0) + exp.amount;

      const mName = exp.description || 'Varios';
      merchantMap[mName] = (merchantMap[mName] || 0) + exp.amount;
    }

    const sortedCats = Object.entries(catMap)
      .map(([name, total]) => ({ name, total, percent: currentTotal > 0 ? Math.round((total / currentTotal) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    const sortedMerchants = Object.entries(merchantMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    // Check budget stress
    const budgetAlerts = [];
    for (const b of budgets) {
      const spent = catMap[b.category?.name] || 0;
      const pct = Math.round((spent / b.amount) * 100);
      if (pct >= 85) {
        budgetAlerts.push({ category: b.category?.name, percent: pct, limit: b.amount, spent });
      }
    }

    // Attempt Gemini Generation if key available
    let aiResult = null;
    const apiKey = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (apiKey) {
      try {
        const financialContext = JSON.stringify({
          gastoMesActual: Math.round(currentTotal),
          gastoMesAnterior: Math.round(prevTotal),
          transaccionesRegistradas: currentExpenses.length,
          topCategorias: sortedCats.slice(0, 4),
          topComercios: sortedMerchants,
          alertasPresupuesto: budgetAlerts,
        });

        const prompt = `
Eres el asesor financiero personal de una aplicación de control de gastos en República Dominicana (moneda RD$).
Analiza los datos de gastos del usuario y genera un resumen ejecutivo motivador, realista y estratégico.

Datos financieros:
${financialContext}

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "headline": "<Frase corta de 1 línea con impacto, ej: 'Buen control en transporte pero ojo con la comida'>",
  "summary": "<Párrafo de 2-3 líneas explicando cómo va el mes en comparación con el mes pasado o sus presupuestos>",
  "topInsight": "<Observación clave sobre el comercio o categoría que más consumió dinero>",
  "savingsAdvice": "<Consejo práctico y directo para ahorrar dinero en los próximos 7 días>",
  "healthScore": <número entero entre 40 y 98 basado en su disciplina de gasto>,
  "status": "<'excelente' si ahorró, 'estable' si está dentro de lo normal, 'alerta' si hay sobregasto>"
}
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (response.ok) {
          const geminiData = await response.json();
          const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            aiResult = JSON.parse(text.trim());
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini AI Insights error:', geminiErr.message);
      }
    }

    // High quality local heuristic fallback
    if (!aiResult) {
      let status = 'estable';
      let score = 82;
      let diffText = '';

      if (prevTotal > 0) {
        const diffPct = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
        if (diffPct > 15) {
          status = 'alerta';
          score = 68;
          diffText = `Tus consumos han aumentado un ${diffPct}% en comparación con el mes pasado.`;
        } else if (diffPct < -10) {
          status = 'excelente';
          score = 92;
          diffText = `¡Excelente! Has reducido tus gastos un ${Math.abs(diffPct)}% respecto al mes anterior.`;
        } else {
          diffText = `Tus gastos se mantienen en un rango similar al mes anterior (${diffPct >= 0 ? '+' : ''}${diffPct}%).`;
        }
      } else {
        diffText = `Llevas registrados RD$ ${currentTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} en lo que va de mes.`;
      }

      const topCat = sortedCats[0];
      const topMerchant = sortedMerchants[0];

      aiResult = {
        headline: topCat ? `Tu mayor enfoque este mes está en ${topCat.name} (${topCat.percent}% del total)` : 'Comienza a registrar consumos para ver tu diagnóstico',
        summary: `${diffText} ${budgetAlerts.length > 0 ? `Tienes ${budgetAlerts.length} categoría(s) cerca de alcanzar su presupuesto límite.` : 'Tus presupuestos se encuentran en zona segura.'}`,
        topInsight: topMerchant ? `Tu comercio con mayor volumen es ${topMerchant.name} con RD$ ${topMerchant.total.toLocaleString('es-DO')}.` : 'No se registran comercios dominantes.',
        savingsAdvice: topCat && topCat.name.toLowerCase().includes('comida')
          ? 'Intenta planificar las comidas del fin de semana con antelación para reducir gastos en delivery y compras impulsivas.'
          : 'Revisa tus suscripciones recurrentes y gastos menores de cafetería para conservar hasta un 10% adicional de tus ingresos.',
        healthScore: score,
        status,
      };
    }

    res.json({
      success: true,
      data: {
        ...aiResult,
        stats: {
          currentTotal: Math.round(currentTotal * 100) / 100,
          currentTotalFormatted: `RD$ ${currentTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
          expensesCount: currentExpenses.length,
          topCategory: sortedCats[0] || null,
          topMerchant: sortedMerchants[0] || null,
        },
      },
    });
  } catch (error) {
    securityLogger.error('AI_INSIGHTS_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al generar diagnóstico con Inteligencia Artificial.' });
  }
});

module.exports = router;
