const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

router.use(auth);

// ─── List Incomes ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, categoryId, page = 1, limit = 50 } = req.query;

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

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [incomes, total] = await Promise.all([
      prisma.income.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.income.count({ where }),
    ]);

    res.json({
      incomes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    securityLogger.error('INCOMES_LIST_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener ingresos.' });
  }
});

// ─── Summary (for Dashboard) ─────────────────────────────────────────
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

    const incomes = await prisma.income.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by category
    const byCategoryMap = {};
    let total = 0;

    incomes.forEach((inc) => {
      total += inc.amount;
      const catId = inc.categoryId;
      if (!byCategoryMap[catId]) {
        byCategoryMap[catId] = {
          id: catId,
          name: inc.category?.name || 'Otros Ingresos',
          color: inc.category?.color || '#6B7280',
          icon: inc.category?.icon || 'wallet',
          total: 0,
          count: 0,
        };
      }
      byCategoryMap[catId].total += inc.amount;
      byCategoryMap[catId].count += 1;
    });

    const byCategory = Object.values(byCategoryMap).sort((a, b) => b.total - a.total);

    // Group by month
    const byMonthMap = {};
    incomes.forEach((inc) => {
      const monthKey = inc.date.toISOString().slice(0, 7);
      if (!byMonthMap[monthKey]) {
        byMonthMap[monthKey] = { month: monthKey, total: 0, count: 0 };
      }
      byMonthMap[monthKey].total += inc.amount;
      byMonthMap[monthKey].count += 1;
    });

    const byMonth = Object.values(byMonthMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      total: Math.round(total * 100) / 100,
      count: incomes.length,
      byCategory,
      byMonth,
    });
  } catch (error) {
    securityLogger.error('INCOMES_SUMMARY_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener resumen de ingresos.' });
  }
});

// ─── Create Single Income ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { amount, description, date, categoryId, source } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
    }

    const cleanDesc = (description || 'Ingreso')
      .toString()
      .replace(/[\0\u0000]/g, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 255);

    const cleanSource = source
      ? source.toString().replace(/[\0\u0000]/g, '').replace(/[<>]/g, '').trim().slice(0, 100)
      : null;

    // Check category exists for this user
    let category = null;
    if (categoryId) {
      category = await prisma.incomeCategory.findFirst({
        where: { id: categoryId, userId: req.userId },
      });
    }

    if (!category) {
      // Find first default category or create one
      category = await prisma.incomeCategory.findFirst({
        where: { userId: req.userId },
      });
      if (!category) {
        category = await prisma.incomeCategory.create({
          data: {
            name: 'Otros Ingresos',
            color: '#6B7280',
            icon: 'wallet',
            userId: req.userId,
            isDefault: true,
          },
        });
      }
    }

    const parsedDate = date ? new Date(date) : new Date();
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const income = await prisma.income.create({
      data: {
        amount: Math.round(numAmount * 100) / 100,
        description: cleanDesc,
        date: validDate,
        source: cleanSource,
        userId: req.userId,
        categoryId: category.id,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    res.status(201).json(income);
  } catch (error) {
    securityLogger.error('INCOME_CREATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al registrar ingreso.' });
  }
});

// ─── Update Income ───────────────────────────────────────────────────
router.put('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, categoryId, source } = req.body;

    const existing = await prisma.income.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Ingreso no encontrado.' });
    }

    const data = {};
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
      }
      data.amount = Math.round(numAmount * 100) / 100;
    }

    if (description !== undefined) {
      data.description = description
        .toString()
        .replace(/[\0\u0000]/g, '')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 255);
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) data.date = parsedDate;
    }

    if (source !== undefined) {
      data.source = source
        ? source.toString().replace(/[\0\u0000]/g, '').replace(/[<>]/g, '').trim().slice(0, 100)
        : null;
    }

    if (categoryId !== undefined) {
      const category = await prisma.incomeCategory.findFirst({
        where: { id: categoryId, userId: req.userId },
      });
      if (category) data.categoryId = category.id;
    }

    const updated = await prisma.income.update({
      where: { id },
      data,
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    securityLogger.error('INCOME_UPDATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al actualizar ingreso.' });
  }
});

// ─── Delete Income ───────────────────────────────────────────────────
router.delete('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.income.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Ingreso no encontrado.' });
    }

    await prisma.income.delete({ where: { id } });
    res.json({ message: 'Ingreso eliminado correctamente.' });
  } catch (error) {
    securityLogger.error('INCOME_DELETE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar ingreso.' });
  }
});

module.exports = router;
