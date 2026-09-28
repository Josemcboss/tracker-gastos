const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');
const { sanitizeString } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /api/subscriptions
 * Lists user recurring subscriptions with days until next due date
 */
router.get('/', auth, async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.userId },
      include: { category: true },
      orderBy: { billingDay: 'asc' },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const enriched = subscriptions.map((sub) => {
      // Calculate next billing date
      let nextDate = new Date(currentYear, currentMonth, sub.billingDay);
      if (currentDay > sub.billingDay) {
        nextDate = new Date(currentYear, currentMonth + 1, sub.billingDay);
      }

      const diffTime = nextDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...sub,
        nextBillingDate: nextDate.toISOString().split('T')[0],
        daysUntilDue: Math.max(0, daysUntilDue),
      };
    });

    // Summary calculations
    const monthlyTotal = subscriptions
      .filter((s) => s.isActive)
      .reduce((sum, s) => {
        return sum + (s.billingCycle === 'yearly' ? s.amount / 12 : s.amount);
      }, 0);

    res.json({
      subscriptions: enriched,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      activeCount: subscriptions.filter((s) => s.isActive).length,
    });
  } catch (error) {
    securityLogger.error('GET_SUBSCRIPTIONS_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener suscripciones.' });
  }
});

/**
 * POST /api/subscriptions
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, amount, billingDay, billingCycle, categoryId, paymentMethod, currency } = req.body;

    const numAmount = parseFloat(amount);
    const day = parseInt(billingDay, 10);

    if (!name || isNaN(numAmount) || numAmount <= 0 || isNaN(day) || day < 1 || day > 31) {
      return res.status(400).json({
        error: 'Nombre, monto mayor a 0 y día de cobro válido (1-31) son obligatorios.',
      });
    }

    const sub = await prisma.subscription.create({
      data: {
        name: sanitizeString(name).slice(0, 100),
        amount: Math.round(numAmount * 100) / 100,
        billingDay: day,
        billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
        categoryId: categoryId || null,
        paymentMethod: paymentMethod ? sanitizeString(paymentMethod).slice(0, 50) : null,
        currency: currency || 'DOP',
        userId: req.userId,
      },
      include: { category: true },
    });

    res.status(201).json(sub);
  } catch (error) {
    securityLogger.error('CREATE_SUBSCRIPTION_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al registrar suscripción.' });
  }
});

/**
 * PUT /api/subscriptions/:id
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, amount, billingDay, billingCycle, categoryId, paymentMethod, isActive } = req.body;

    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Suscripción no encontrada.' });
    }

    const updateData = {};
    if (name) updateData.name = sanitizeString(name).slice(0, 100);
    if (amount !== undefined) updateData.amount = Math.round(parseFloat(amount) * 100) / 100;
    if (billingDay !== undefined) updateData.billingDay = parseInt(billingDay, 10);
    if (billingCycle) updateData.billingCycle = billingCycle;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: updateData,
      include: { category: true },
    });

    res.json(updated);
  } catch (error) {
    securityLogger.error('UPDATE_SUBSCRIPTION_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al actualizar suscripción.' });
  }
});

/**
 * DELETE /api/subscriptions/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Suscripción no encontrada.' });
    }

    await prisma.subscription.delete({ where: { id: req.params.id } });
    res.json({ message: 'Suscripción eliminada correctamente.' });
  } catch (error) {
    securityLogger.error('DELETE_SUBSCRIPTION_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar suscripción.' });
  }
});

module.exports = router;
