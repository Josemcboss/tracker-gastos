const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

/**
 * GET /api/budgets
 * Retrieves user budgets along with current month spent amounts per category
 */
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch user budgets with category details
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch expenses of current month grouped by category
    const monthlyExpenses = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        userId: req.userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const spentMap = {};
    monthlyExpenses.forEach((item) => {
      spentMap[item.categoryId] = item._sum.amount || 0;
    });

    const enrichedBudgets = budgets.map((b) => {
      const spent = spentMap[b.categoryId] || 0;
      const percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      const remaining = Math.max(0, b.amount - spent);

      let status = 'normal';
      if (percentage >= 100) status = 'exceeded';
      else if (percentage >= 90) status = 'danger';
      else if (percentage >= 75) status = 'warning';

      return {
        ...b,
        spent,
        remaining,
        percentage,
        status,
      };
    });

    res.json(enrichedBudgets);
  } catch (error) {
    securityLogger.error('GET_BUDGETS_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener presupuestos.' });
  }
});

/**
 * POST /api/budgets
 * Upsert (create or update) a category budget
 */
router.post('/', auth, async (req, res) => {
  try {
    const { categoryId, amount } = req.body;

    const numAmount = parseFloat(amount);
    if (!categoryId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Categoría y un monto mayor a 0 son obligatorios.' });
    }

    // Verify category belongs to user
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.userId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId: {
          userId: req.userId,
          categoryId,
        },
      },
      update: {
        amount: Math.round(numAmount * 100) / 100,
      },
      create: {
        amount: Math.round(numAmount * 100) / 100,
        userId: req.userId,
        categoryId,
      },
      include: {
        category: true,
      },
    });

    securityLogger.info('BUDGET_SAVED', { userId: req.userId, categoryId, amount: budget.amount });

    res.status(201).json(budget);
  } catch (error) {
    securityLogger.error('SAVE_BUDGET_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al guardar presupuesto.' });
  }
});

/**
 * DELETE /api/budgets/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    await prisma.budget.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Presupuesto eliminado correctamente.' });
  } catch (error) {
    securityLogger.error('DELETE_BUDGET_ERROR', { userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar presupuesto.' });
  }
});

module.exports = router;
