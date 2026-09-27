const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// All expense routes require authentication
router.use(auth);

// ─── List expenses (with optional filters) ───────────────────────────
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, categoryId, page = 1, limit = 50 } = req.query;

    const where = { userId: req.userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({ expenses, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// ─── Create expense ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { amount, description, date, categoryId, paymentMethod } = req.body;

    if (!amount || !description || !date || !categoryId) {
      return res.status(400).json({ error: 'Monto, descripción, fecha y categoría son requeridos' });
    }

    // Verify category belongs to user
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.userId },
    });
    if (!category) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        paymentMethod: paymentMethod || null,
        userId: req.userId,
        categoryId,
      },
      include: { category: true },
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// ─── Update expense ──────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, categoryId, paymentMethod } = req.body;

    // Verify ownership
    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    const data = {};
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (description !== undefined) data.description = description;
    if (date !== undefined) data.date = new Date(date);
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod || null;

    const expense = await prisma.expense.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

// ─── Delete expense ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    await prisma.expense.delete({ where: { id } });

    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
