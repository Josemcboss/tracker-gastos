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

module.exports = router;
