const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');
const { sanitizeString } = require('../middleware/validate');
const { findBestCategory } = require('../utils/autoCategorize');
const { parseBankEmail } = require('../utils/bankEmailParser');
const { parseWithGemini } = require('../utils/geminiParser');
const { getUsdToDopRate } = require('../utils/exchangeRate');

const SECURE_FALLBACK = 'tracker_gastos_jwt_secret_key_2026_prod_secure_fallback_v1';
const JWT_SECRET = process.env.JWT_SECRET || SECURE_FALLBACK;

const router = express.Router();

/**
 * Generates a high-entropy integration token
 */
const generateApiKey = () => {
  return `trk_${crypto.randomBytes(24).toString('hex')}`;
};

// ─── Get or Create Integration Token for authenticated user ───────────
router.get('/token', auth, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, apiKey: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (!user.apiKey) {
      const newKey = generateApiKey();
      user = await prisma.user.update({
        where: { id: req.userId },
        data: { apiKey: newKey },
        select: { id: true, apiKey: true },
      });
      securityLogger.info('INTEGRATION_TOKEN_CREATED', { userId: req.userId });
    }

    res.json({
      apiKey: user.apiKey,
    });
  } catch (error) {
    securityLogger.error('GET_INTEGRATION_TOKEN_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener token de integración.' });
  }
});

// ─── Regenerate Integration Token ─────────────────────────────────────
router.post('/token/regenerate', auth, async (req, res) => {
  try {
    const newKey = generateApiKey();
    await prisma.user.update({
      where: { id: req.userId },
      data: { apiKey: newKey },
    });

    securityLogger.info('INTEGRATION_TOKEN_REGENERATED', { userId: req.userId });

    res.json({
      apiKey: newKey,
      message: 'Token de integración regenerado correctamente.',
    });
  } catch (error) {
    securityLogger.error('REGENERATE_INTEGRATION_TOKEN_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al regenerar token.' });
  }
});

// ─── Ingest Apple Wallet / Apple Pay Transaction ──────────────────────
router.post('/apple-wallet', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // Check for explicit integration apiKey (trk_*) from header, query, or body
    let apiKey =
      req.headers['x-api-key'] ||
      req.query.token ||
      req.body?.token ||
      (authHeader && authHeader.startsWith('Bearer trk_') ? authHeader.split(' ')[1] : null);

    let user = null;

    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('trk_')) {
      user = await prisma.user.findUnique({
        where: { apiKey },
        include: { categories: true },
      });
    }

    // Fallback: If caller has a valid Bearer JWT session (e.g. testing from frontend app)
    if (!user && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.userId) {
          user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { categories: true },
          });
        }
      } catch (jwtErr) {
        // invalid jwt token
      }
    }

    if (!user) {
      securityLogger.warn('APPLE_WALLET_UNAUTHORIZED', { ip: req.ip });
      return res.status(401).json({ error: 'Token de integración o sesión inválida.' });
    }

    // Extract payload fields
    let { amount, merchant, description, categoryId, date, cardName } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0.' });
    }

    // Format description & merchant
    const merchantName = sanitizeString(merchant || description || 'Compra con Apple Pay').slice(0, 150);

    // Auto-categorize if no valid category provided
    let targetCategory = null;
    if (categoryId) {
      targetCategory = user.categories.find(c => c.id === categoryId);
    }

    if (!targetCategory) {
      targetCategory = findBestCategory(merchantName, user.categories);
    }

    if (!targetCategory) {
      return res.status(400).json({ error: 'No se encontraron categorías disponibles para asignar el gasto.' });
    }

    // Parse date or fallback to now
    let expenseDate = new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        expenseDate = parsed;
      }
    }

    // Payment method label
    const method = cardName ? `Apple Wallet (${sanitizeString(cardName).slice(0, 20)})` : 'Apple Wallet';

    // Create the expense
    const expense = await prisma.expense.create({
      data: {
        amount: Math.round(numAmount * 100) / 100,
        description: merchantName,
        date: expenseDate,
        paymentMethod: method,
        userId: user.id,
        categoryId: targetCategory.id,
      },
      include: {
        category: true,
      },
    });

    securityLogger.info('APPLE_WALLET_TRANSACTION_INGESTED', {
      userId: user.id,
      amount: expense.amount,
      category: targetCategory.name,
    });

    res.status(201).json({
      success: true,
      message: `Gasto de RD$ ${expense.amount.toLocaleString()} en "${expense.description}" registrado en ${targetCategory.name}.`,
      expense,
    });
  } catch (error) {
    securityLogger.error('APPLE_WALLET_INGEST_ERROR', { ip: req.ip, message: error.message });
    res.status(500).json({ error: 'Error al procesar transacción de Apple Wallet.' });
  }
});

// ─── Telegram Bot Helper ───────────────────────────────────────────────
const sendTelegramMessage = async (chatId, text, parseMode = 'HTML') => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log(`[Telegram Simulation -> ${chatId}]: ${text}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
  } catch (err) {
    console.error('Telegram Send Error:', err.message);
  }
};

// ─── Get Telegram Status & Link Code ───────────────────────────────────
router.get('/telegram/status', auth, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { telegramChatId: true, telegramLinkToken: true },
    });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (!user.telegramLinkToken) {
      const newToken = crypto.randomBytes(6).toString('hex');
      user = await prisma.user.update({
        where: { id: req.userId },
        data: { telegramLinkToken: newToken },
        select: { telegramChatId: true, telegramLinkToken: true },
      });
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'TrackerGastosBot';

    res.json({
      isLinked: !!user.telegramChatId,
      telegramChatId: user.telegramChatId,
      linkToken: user.telegramLinkToken,
      botUsername,
      botUrl: `https://t.me/${botUsername}?start=${user.telegramLinkToken}`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de Telegram.' });
  }
});

// ─── Unlink Telegram ───────────────────────────────────────────────────
router.post('/telegram/unlink', auth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { telegramChatId: null },
    });
    res.json({ message: 'Telegram desvinculado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desvincular Telegram.' });
  }
});

// ─── Telegram Webhook Endpoint ─────────────────────────────────────────
router.post('/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    const message = update?.message || update?.edited_message;

    if (!message || !message.text) {
      return res.status(200).send('OK');
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // 1. Check for /start <token>
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const token = parts[1]?.trim();

      if (token) {
        const user = await prisma.user.findUnique({
          where: { telegramLinkToken: token },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { telegramChatId: chatId },
          });

          await sendTelegramMessage(
            chatId,
            `🎉 ¡Hola ${user.name}! Tu cuenta ha sido vinculada exitosamente con tu Tracker de Gastos.\n\nAhora puedes registrar gastos simplemente escribiéndome:\n• "Almuerzo 450"\n• "Uber 320"\n• "Gasolina 2000"\n\n¡Pruébalo enviándome un gasto ahora!`
          );
          return res.status(200).send('OK');
        }
      }

      await sendTelegramMessage(
        chatId,
        `👋 ¡Hola! Para vincular tu cuenta, abre tu Tracker de Gastos, entra a Perfil > "🤖 Bot de Telegram" y toca el enlace de conexión.`
      );
      return res.status(200).send('OK');
    }

    // 2. Identify linked user by chatId
    const user = await prisma.user.findUnique({
      where: { telegramChatId: chatId },
      include: { categories: true },
    });

    if (!user) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Tu cuenta aún no está vinculada. Abre la aplicación de Tracker de Gastos y toca "Conectar con Telegram" en tu perfil.`
      );
      return res.status(200).send('OK');
    }

    // 3. Parse expense text: e.g. "Almuerzo 450", "Uber 320", "2000 Gasolina"
    // Extract any number (int or decimal)
    const amountMatch = text.match(/(?:RD\$|DOP|\$)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i);

    if (!amountMatch) {
      await sendTelegramMessage(
        chatId,
        `🤔 No pude detectar un monto en tu mensaje.\n\nEscribe el concepto seguido del monto, por ejemplo:\n• Almuerzo 450\n• Uber 350\n• Supermercado 2500`
      );
      return res.status(200).send('OK');
    }

    const rawNum = amountMatch[1].replace(',', '.');
    const parsedAmount = parseFloat(rawNum);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await sendTelegramMessage(chatId, `⚠️ El monto debe ser un número mayor a cero.`);
      return res.status(200).send('OK');
    }

    // Remove the number and currency keywords from text to get the description
    let description = text
      .replace(amountMatch[0], '')
      .replace(/\b(rd\$|dop|pesos|dolares|usd|\$)\b/gi, '')
      .trim();

    if (!description) description = 'Gasto por Telegram';

    // Auto-categorize
    const targetCategory = findBestCategory(description, user.categories);

    // Save expense to DB
    const expense = await prisma.expense.create({
      data: {
        amount: Math.round(parsedAmount * 100) / 100,
        description,
        date: new Date(),
        paymentMethod: 'Telegram Bot',
        currency: 'DOP',
        exchangeRate: 1,
        userId: user.id,
        categoryId: targetCategory.id,
      },
    });

    await sendTelegramMessage(
      chatId,
      `✅ ¡Gasto registrado exitosamente!\n\n💵 Monto: RD$ ${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}\n📌 Concepto: ${expense.description}\n🏷️ Categoría: ${targetCategory.name}\n📅 Fecha: ${new Date().toLocaleDateString('es-DO')}`
    );

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return res.status(500).send('Error');
  }
});

// ─── Ingest Expense from Automated Email (Gmail, Apps Script, etc.) ────
router.post('/email-expense', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let apiKey =
      req.headers['x-api-key'] ||
      req.query.token ||
      req.body?.token ||
      (authHeader && authHeader.startsWith('Bearer trk_') ? authHeader.split(' ')[1] : null);

    let user = null;

    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('trk_')) {
      user = await prisma.user.findUnique({
        where: { apiKey },
        include: { categories: true },
      });
    }

    // Fallback: If no apiKey was provided, match owner Jose Mencia by email/name
    if (!user && (req.body?.ownerEmail === 'josemcboss@gmail.com' || req.body?.userEmail === 'josemcboss@gmail.com' || req.body?.userEmail === 'joseanibalmencia@gmail.com')) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'joseanibalmencia@gmail.com' },
            { email: 'josemcboss@gmail.com' },
            { name: { contains: 'Jose Mencia', mode: 'insensitive' } },
          ],
        },
        include: { categories: true },
      });
    }

    if (!user) {
      securityLogger.warn('EMAIL_EXPENSE_UNAUTHORIZED', { ip: req.ip });
      return res.status(401).json({ error: 'Token de integración inválido o usuario no identificado.' });
    }

    const { subject = '', bodyText = '', bodyHtml = '', from = '', date, rawAmount, rawMerchant } = req.body;

    // Clean HTML if plain text was omitted
    let cleanText = bodyText;
    if (!cleanText && bodyHtml) {
      cleanText = bodyHtml.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');
    }

    let parsed = null;

    // 1. Direct explicit values if client pre-extracted them
    if (rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0) {
      parsed = {
        amount: Math.round(parseFloat(rawAmount) * 100) / 100,
        currency: req.body.currency === 'USD' ? 'USD' : 'DOP',
        merchant: rawMerchant ? sanitizeString(rawMerchant).slice(0, 100) : 'Gasto por Correo',
        date: date ? new Date(date) : new Date(),
        paymentMethod: from ? `Correo (${from.slice(0, 30)})` : 'Notificación por Correo',
        parsedBy: 'direct',
      };
    }

    // 2. Intelligent Dominican Bank Regex Parser
    if (!parsed) {
      parsed = parseBankEmail({ subject, bodyText: cleanText, from, date });
    }

    // 3. Fallback: Gemini AI Parser
    if (!parsed) {
      parsed = await parseWithGemini({ subject, bodyText: cleanText, from });
    }

    if (!parsed || !parsed.amount || parsed.amount <= 0) {
      securityLogger.info('EMAIL_EXPENSE_UNPARSED', { userId: user.id, subject });
      return res.status(422).json({
        error: 'No se detectó ninguna transacción de gasto en el correo recibido.',
        subject,
      });
    }

    // Category assignment
    let targetCategory = null;
    if (parsed.suggestedCategory) {
      targetCategory = user.categories.find(
        (c) => c.name.toLowerCase() === parsed.suggestedCategory.toLowerCase()
      );
    }
    if (!targetCategory) {
      targetCategory = findBestCategory(parsed.merchant, user.categories);
    }
    if (!targetCategory && user.categories.length > 0) {
      targetCategory = user.categories.find((c) => c.isDefault) || user.categories[0];
    }

    if (!targetCategory) {
      return res.status(400).json({ error: 'No hay categorías disponibles para registrar el gasto.' });
    }

    // ─── Currency & Exchange Rate Handling (DOP / USD) ──────────────────
    let originalCurrency = parsed.currency || 'DOP';
    let exchangeRate = 1.0;
    let finalAmount = parsed.amount;

    if (originalCurrency === 'USD') {
      exchangeRate = await getUsdToDopRate();
      finalAmount = Math.round((parsed.amount * exchangeRate) * 100) / 100;
    }

    // ─── Duplicate Charge Detector (within 15 minutes) ──────────────────
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingRecent = await prisma.expense.findFirst({
      where: {
        userId: user.id,
        amount: finalAmount,
        createdAt: { gte: fifteenMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    const isDuplicate = !!existingRecent;
    const finalDescription = isDuplicate
      ? `⚠️ [POSIBLE DUPLICADO] ${sanitizeString(parsed.merchant).slice(0, 120)}`
      : sanitizeString(parsed.merchant).slice(0, 150);

    // Insert expense
    const expense = await prisma.expense.create({
      data: {
        amount: finalAmount,
        description: finalDescription,
        date: parsed.date || new Date(),
        paymentMethod: sanitizeString(parsed.paymentMethod || 'Correo Electrónico').slice(0, 50),
        currency: originalCurrency,
        exchangeRate,
        userId: user.id,
        categoryId: targetCategory.id,
      },
      include: {
        category: true,
      },
    });

    securityLogger.info('EMAIL_EXPENSE_INGESTED', {
      userId: user.id,
      amount: expense.amount,
      category: targetCategory.name,
      isDuplicate,
      parsedBy: parsed.parsedBy,
    });

    // Send Telegram Notification (Normal or Duplicate Alert)
    if (user.telegramChatId) {
      if (isDuplicate) {
        const dupMessage = `🚨 <b>¡ALERTA DE POSIBLE CARGO DUPLICADO!</b>\n\n` +
          `Se ha detectado un segundo cobro idéntico de <b>RD$ ${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</b> en <b>${parsed.merchant}</b> con menos de 15 minutos de diferencia.\n\n` +
          `⚠️ <i>Por favor verifica tu banca en línea o llama a tu banco si no realizaste esta compra dos veces.</i>`;
        await sendTelegramMessage(user.telegramChatId, dupMessage);
      } else {
        const cur = originalCurrency === 'USD' ? 'US$' : 'RD$';
        const formattedAmount = `${cur} ${parsed.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
        const conversionNote = originalCurrency === 'USD' ? ` (Equiv: RD$ ${finalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })} @ ${exchangeRate})` : '';
        const parsedBadge = parsed.parsedBy === 'gemini' ? '🤖 Gemini IA' : (parsed.parsedBy === 'direct' ? '⚡ Directo' : '🏦 Parser Bancario');

        const message = `📧 <b>Nuevo Gasto Registrado desde Gmail</b>\n\n` +
          `💵 <b>Monto:</b> ${formattedAmount}${conversionNote}\n` +
          `🏪 <b>Comercio:</b> ${parsed.merchant}\n` +
          `📂 <b>Categoría:</b> ${targetCategory.name}\n` +
          `💳 <b>Origen:</b> ${expense.paymentMethod}\n` +
          `📅 <b>Fecha:</b> ${new Date(expense.date).toLocaleDateString('es-DO')}\n\n` +
          `<i>Modo: ${parsedBadge}</i>`;

        await sendTelegramMessage(user.telegramChatId, message);
      }
    }

    res.status(201).json({
      success: true,
      message: isDuplicate
        ? `Alerta: Cargo posiblemente duplicado de RD$ ${expense.amount} en "${parsed.merchant}".`
        : `Gasto de RD$ ${expense.amount} en "${parsed.merchant}" registrado exitosamente.`,
      expense,
      isDuplicate,
      parsedBy: parsed.parsedBy,
    });
  } catch (error) {
    securityLogger.error('EMAIL_EXPENSE_ERROR', { message: error.message });
    res.status(500).json({ error: 'Error interno al procesar el gasto por correo.' });
  }
});

// ─── iOS / Apple Shortcuts / Widget Summary Endpoint ──────────────────
router.get('/widget-summary', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let apiKey =
      req.headers['x-api-key'] ||
      req.query.token ||
      (authHeader && authHeader.startsWith('Bearer trk_') ? authHeader.split(' ')[1] : null);

    let user = null;
    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('trk_')) {
      user = await prisma.user.findUnique({
        where: { apiKey },
        include: { budgets: true },
      });
    }

    // Fallback: Default to owner if requested without explicit apiKey
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'joseanibalmencia@gmail.com' },
            { email: 'josemcboss@gmail.com' },
          ],
        },
        include: { budgets: true },
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Token de Widget no válido.' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sum of expenses this month
    const expensesThisMonth = await prisma.expense.findMany({
      where: {
        userId: user.id,
        date: { gte: startOfMonth },
      },
      include: { category: true },
      orderBy: { date: 'desc' },
    });

    const totalSpent = expensesThisMonth.reduce((acc, curr) => acc + curr.amount, 0);

    // Total budget
    const totalBudget = (user.budgets || []).reduce((acc, curr) => acc + curr.amount, 0);
    const budgetRemaining = totalBudget > 0 ? Math.max(0, totalBudget - totalSpent) : null;
    const percentUsed = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : null;

    // Latest expense
    const latest = expensesThisMonth[0] || null;

    // Top Category this month
    const catTotals = {};
    for (const exp of expensesThisMonth) {
      const cName = exp.category?.name || 'Otros';
      catTotals[cName] = (catTotals[cName] || 0) + exp.amount;
    }
    let topCategory = null;
    let maxCatAmount = 0;
    for (const [cName, amt] of Object.entries(catTotals)) {
      if (amt > maxCatAmount) {
        maxCatAmount = amt;
        topCategory = cName;
      }
    }

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    res.json({
      status: 'ok',
      userName: user.name,
      month: monthLabel,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalSpentFormatted: `RD$ ${totalSpent.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalBudget: totalBudget > 0 ? totalBudget : null,
      budgetRemaining: budgetRemaining !== null ? Math.round(budgetRemaining * 100) / 100 : null,
      budgetRemainingFormatted: budgetRemaining !== null ? `RD$ ${budgetRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Sin límite fijado',
      percentUsed,
      expensesCount: expensesThisMonth.length,
      topCategory: topCategory || 'N/A',
      lastExpense: latest ? {
        description: latest.description,
        amount: latest.amount,
        formatted: `RD$ ${latest.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        category: latest.category?.name || 'Otros',
        date: latest.date.toISOString().split('T')[0],
      } : null,
    });
  } catch (error) {
    securityLogger.error('WIDGET_SUMMARY_ERROR', { message: error.message });
    res.status(500).json({ error: 'Error al generar resumen para el Widget.' });
  }
});

module.exports = router;

