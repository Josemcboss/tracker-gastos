const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// All category routes require authentication
router.use(auth);

// ─── List categories ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// ─── Create custom category ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Nombre y color son requeridos' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        color,
        icon: icon || 'tag',
        isDefault: false,
        userId: req.userId,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// ─── Update category ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    res.json(category);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// ─── Delete category ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Prevent deletion if category has expenses
    const expenseCount = await prisma.expense.count({
      where: { categoryId: id },
    });
    if (expenseCount > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: la categoría tiene ${expenseCount} gasto(s) asociado(s). Reasígnalos primero.`,
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

module.exports = router;
