const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { validateCategory, validateUUIDParam } = require('../middleware/validate');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

router.use(auth);

const DEFAULT_INCOME_CATS = [
  { name: 'Salario / Nómina',        color: '#10B981', icon: 'wallet' },
  { name: 'Freelance / Servicios',   color: '#3B82F6', icon: 'briefcase' },
  { name: 'Inversiones / Rendimientos', color: '#8B5CF6', icon: 'trending-up' },
  { name: 'Ventas / Negocio',        color: '#F59E0B', icon: 'store' },
  { name: 'Otros Ingresos',          color: '#6B7280', icon: 'plus-circle' },
];

// ─── List income categories ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let categories = await prisma.incomeCategory.findMany({
      where: { userId: req.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Auto-seed if user doesn't have any
    if (categories.length === 0) {
      await prisma.incomeCategory.createMany({
        data: DEFAULT_INCOME_CATS.map(c => ({ ...c, userId: req.userId, isDefault: true })),
        skipDuplicates: true,
      });
      categories = await prisma.incomeCategory.findMany({
        where: { userId: req.userId },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    }

    res.json(categories);
  } catch (error) {
    securityLogger.error('INCOME_CATEGORY_LIST_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener categorías de ingreso.' });
  }
});

// ─── Create income category ──────────────────────────────────────────
router.post('/', validateCategory(false), async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    const count = await prisma.incomeCategory.count({ where: { userId: req.userId } });
    if (count >= 50) {
      return res.status(400).json({ error: 'Has alcanzado el límite máximo de categorías de ingreso (50).' });
    }

    const category = await prisma.incomeCategory.create({
      data: {
        name,
        color,
        icon: icon || 'wallet',
        isDefault: false,
        userId: req.userId,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una categoría de ingreso con ese nombre.' });
    }
    securityLogger.error('INCOME_CATEGORY_CREATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al crear categoría de ingreso.' });
  }
});

// ─── Update income category ──────────────────────────────────────────
router.put('/:id', validateUUIDParam('id'), validateCategory(true), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const existing = await prisma.incomeCategory.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría de ingreso no encontrada.' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;

    const category = await prisma.incomeCategory.update({
      where: { id },
      data,
    });

    res.json(category);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una categoría de ingreso con ese nombre.' });
    }
    securityLogger.error('INCOME_CATEGORY_UPDATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al actualizar categoría de ingreso.' });
  }
});

// ─── Delete income category ──────────────────────────────────────────
router.delete('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.incomeCategory.findFirst({
      where: { id, userId: req.userId },
      include: { _count: { select: { incomes: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría de ingreso no encontrada.' });
    }

    if (existing._count.incomes > 0) {
      return res.status(400).json({
        error: `No se puede eliminar porque tiene ${existing._count.incomes} ingresos asociados. Reasígnalos primero.`,
      });
    }

    await prisma.incomeCategory.delete({ where: { id } });
    res.json({ message: 'Categoría de ingreso eliminada correctamente.' });
  } catch (error) {
    securityLogger.error('INCOME_CATEGORY_DELETE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar categoría de ingreso.' });
  }
});

module.exports = router;
