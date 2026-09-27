const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { validateExpense, validateUUIDParam } = require('../middleware/validate');
const securityLogger = require('../utils/securityLogger');

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

    // Limit pagination to safe bounds (OWASP A04: Resource Exhaustion prevention)
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({ expenses, total, page: pageNum, limit: limitNum });
  } catch (error) {
    securityLogger.error('EXPENSE_LIST_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al obtener gastos.' });
  }
});

// ─── Create expense ──────────────────────────────────────────────────
router.post('/', validateExpense(false), async (req, res) => {
  try {
    const { amount, description, date, categoryId, paymentMethod } = req.body;

    // Verify category belongs to the authenticated user (OWASP A01: Broken Access Control)
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.userId },
    });
    if (!category) {
      securityLogger.warn('EXPENSE_CREATE_INVALID_CATEGORY', {
        ip: req.ip,
        userId: req.userId,
        categoryId,
      });
      return res.status(400).json({ error: 'La categoría seleccionada no es válida o no te pertenece.' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount,
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
    securityLogger.error('EXPENSE_CREATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al crear gasto.' });
  }
});

// ─── Bulk Create Expenses (Import Center) ───────────────────────────
router.post('/bulk', async (req, res) => {
  try {
    const { expenses } = req.body;
    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ error: 'Lista de gastos inválida o vacía.' });
    }

    if (expenses.length > 500) {
      return res.status(400).json({ error: 'El límite máximo por importación es de 500 gastos.' });
    }

    // Get user categories (auto-create if missing)
    let categories = await prisma.category.findMany({
      where: { userId: req.userId },
    });

    if (categories.length === 0) {
      const DEFAULT_CATS = [
        { name: 'Comida', color: '#8B5CF6', icon: 'utensils' },
        { name: 'Transporte', color: '#A78BFA', icon: 'car' },
        { name: 'Vivienda', color: '#C4B5FD', icon: 'home' },
        { name: 'Entretenimiento', color: '#D946EF', icon: 'gamepad-2' },
        { name: 'Salud', color: '#F472B6', icon: 'heart-pulse' },
        { name: 'Educación', color: '#6D28D9', icon: 'graduation-cap' },
        { name: 'Otros', color: '#52525B', icon: 'ellipsis' },
      ];
      await prisma.category.createMany({
        data: DEFAULT_CATS.map(c => ({ ...c, userId: req.userId, isDefault: true })),
      });
      categories = await prisma.category.findMany({
        where: { userId: req.userId },
      });
    }

    const defaultCatId = categories[0]?.id;
    const catMap = new Set(categories.map(c => c.id));

    const records = [];
    for (const item of expenses) {
      const numAmount = parseFloat(item.amount);
      if (isNaN(numAmount) || numAmount <= 0) continue;

      const desc = (item.description || 'Gasto importado')
        .toString()
        .replace(/[\0\u0000]/g, '')
        .trim()
        .slice(0, 255);
      const catId = (item.categoryId && catMap.has(item.categoryId)) ? item.categoryId : defaultCatId;
      const parsedDate = item.date ? new Date(item.date) : new Date();
      const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const method = (item.paymentMethod || 'Importación')
        .toString()
        .replace(/[\0\u0000]/g, '')
        .trim()
        .slice(0, 50);

      records.push({
        amount: Math.round(numAmount * 100) / 100,
        description: desc,
        date: validDate,
        paymentMethod: method,
        userId: req.userId,
        categoryId: catId,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'No se encontraron gastos válidos con monto mayor a cero para importar.' });
    }

    let insertedCount = 0;
    try {
      const batchResult = await prisma.expense.createMany({
        data: records,
      });
      insertedCount = batchResult.count;
    } catch (batchErr) {
      // Fallback: insert row by row so valid rows succeed even if one has issues
      for (const rec of records) {
        try {
          await prisma.expense.create({ data: rec });
          insertedCount++;
        } catch (singleErr) {
          console.warn('Fallback single insert error:', singleErr.message);
        }
      }
    }

    securityLogger.info('EXPENSES_BULK_IMPORTED', {
      userId: req.userId,
      count: insertedCount,
    });

    res.status(201).json({
      success: true,
      count: insertedCount,
      message: `Se importaron exitosamente ${insertedCount} gastos.`,
    });
  } catch (error) {
    securityLogger.error('EXPENSES_BULK_IMPORT_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: error.message || 'Error al importar gastos masivamente.' });
  }
});

// ─── Update expense ──────────────────────────────────────────────────
router.put('/:id', validateUUIDParam('id'), validateExpense(true), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, categoryId, paymentMethod } = req.body;

    // Verify ownership (OWASP A01: IDOR prevention)
    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }

    const data = {};
    if (amount !== undefined) data.amount = amount;
    if (description !== undefined) data.description = description;
    if (date !== undefined) data.date = new Date(date);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod || null;

    if (categoryId !== undefined) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId: req.userId },
      });
      if (!category) {
        return res.status(400).json({ error: 'La categoría seleccionada no es válida o no te pertenece.' });
      }
      data.categoryId = categoryId;
    }

    const expense = await prisma.expense.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.json(expense);
  } catch (error) {
    securityLogger.error('EXPENSE_UPDATE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al actualizar gasto.' });
  }
});

// ─── Delete expense ──────────────────────────────────────────────────
router.delete('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership (OWASP A01: IDOR prevention)
    const existing = await prisma.expense.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }

    await prisma.expense.delete({ where: { id } });

    res.json({ message: 'Gasto eliminado exitosamente.' });
  } catch (error) {
    securityLogger.error('EXPENSE_DELETE_ERROR', { ip: req.ip, userId: req.userId, message: error.message });
    res.status(500).json({ error: 'Error al eliminar gasto.' });
  }
});

module.exports = router;
