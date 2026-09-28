const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');
const { sanitizeString } = require('../middleware/validate');
const { findBestCategory } = require('../utils/autoCategorize');

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
const sendTelegramMessage = async (chatId, text) => {
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

module.exports = router;

