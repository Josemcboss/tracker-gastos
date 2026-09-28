const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');
const { sanitizeString } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /api/goals
 */
router.get('/', auth, async (req, res) => {
  try {
    const goals = await prisma.savingGoal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    const enriched = goals.map((g) => {
      const percentage = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);

      let daysRemaining = null;
      if (g.targetDate) {
        const diff = new Date(g.targetDate).getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      return {
        ...g,
        percentage,
        remaining,
        daysRemaining,
        isCompleted: g.currentAmount >= g.targetAmount,
      };
    });

    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);

    res.json({
      goals: enriched,
      totalTarget,
      totalSaved,
      overallPercentage: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
    });
  } catch (error) {
    securityLogger.error('GET_GOALS_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener metas de ahorro.' });
  }
});

/**
 * POST /api/goals
 */
router.post('/', auth, async (req, res) => {
  try {
    const { title, targetAmount, currentAmount = 0, targetDate, color, icon, currency } = req.body;

    const numTarget = parseFloat(targetAmount);
    const numCurrent = parseFloat(currentAmount) || 0;

    if (!title || isNaN(numTarget) || numTarget <= 0) {
      return res.status(400).json({ error: 'Título y un monto meta mayor a 0 son obligatorios.' });
    }

    const goal = await prisma.savingGoal.create({
      data: {
        title: sanitizeString(title).slice(0, 100),
        targetAmount: Math.round(numTarget * 100) / 100,
        currentAmount: Math.max(0, Math.round(numCurrent * 100) / 100),
        targetDate: targetDate ? new Date(targetDate) : null,
        color: color || '#8B5CF6',
        icon: icon || 'Target',
        currency: currency || 'DOP',
        userId: req.userId,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    securityLogger.error('CREATE_GOAL_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al crear meta de ahorro.' });
  }
});

/**
 * POST /api/goals/:id/contribute
 * Add funds to a savings goal
 */
router.post('/:id/contribute', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Ingresa un monto válido para aportar.' });
    }

    const goal = await prisma.savingGoal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Meta no encontrada.' });
    }

    const updated = await prisma.savingGoal.update({
      where: { id: req.params.id },
      data: {
        currentAmount: {
          increment: Math.round(numAmount * 100) / 100,
        },
      },
    });

    securityLogger.info('GOAL_CONTRIBUTION', { userId: req.userId, goalId: goal.id, amount: numAmount });

    res.json({
      message: `¡Se aportaron RD$ ${numAmount.toLocaleString()} a "${goal.title}"!`,
      goal: updated,
    });
  } catch (error) {
    securityLogger.error('CONTRIBUTE_GOAL_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al aportar a la meta.' });
  }
});

/**
 * DELETE /api/goals/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await prisma.savingGoal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Meta no encontrada.' });
    }

    await prisma.savingGoal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Meta eliminada correctamente.' });
  } catch (error) {
    securityLogger.error('DELETE_GOAL_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar meta.' });
  }
});

module.exports = router;
