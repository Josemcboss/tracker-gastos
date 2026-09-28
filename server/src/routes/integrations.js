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

module.exports = router;
