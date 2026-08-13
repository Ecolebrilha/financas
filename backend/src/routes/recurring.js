const express = require('express');
const prisma = require('../db');
const { materializeRecurringForMonth } = require('../utils/recurring');

const router = express.Router();
const INCLUDE = { person: true, paymentMethod: true, category: true };

router.get('/', async (req, res) => {
  const where = req.query.includeInactive === 'true' ? {} : { active: true };
  const items = await prisma.recurringExpense.findMany({ where, include: INCLUDE, orderBy: { description: 'asc' } });
  res.json(items);
});

router.post('/', async (req, res) => {
  const body = req.body;
  if (!body.description || body.amount === undefined || !body.personId || !body.paymentMethodId || !body.categoryId) {
    return res.status(400).json({
      error: 'description, amount, personId, paymentMethodId e categoryId são obrigatórios',
    });
  }
  const item = await prisma.recurringExpense.create({
    data: {
      description: String(body.description).trim(),
      amount: Number(body.amount),
      personId: body.personId,
      paymentMethodId: body.paymentMethodId,
      categoryId: body.categoryId,
      dayOfMonth: body.dayOfMonth ? Number(body.dayOfMonth) : 1,
      startDate: body.startDate ? new Date(`${body.startDate}T00:00:00.000Z`) : new Date(),
      endDate: body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null,
      notes: body.notes || null,
    },
    include: INCLUDE,
  });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const body = req.body;
  const data = {};
  ['description', 'personId', 'paymentMethodId', 'categoryId', 'notes'].forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (data.description !== undefined) data.description = String(data.description).trim();
  if (body.amount !== undefined) data.amount = Number(body.amount);
  if (body.dayOfMonth !== undefined) data.dayOfMonth = Number(body.dayOfMonth);
  if (body.active !== undefined) data.active = body.active;
  if (body.startDate !== undefined) data.startDate = new Date(`${body.startDate}T00:00:00.000Z`);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null;

  try {
    const item = await prisma.recurringExpense.update({ where: { id: req.params.id }, data, include: INCLUDE });
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Gasto recorrente não encontrado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.recurringExpense.update({ where: { id: req.params.id }, data: { active: false } });
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Gasto recorrente não encontrado' });
  }
});

// Força a geração dos lançamentos de um mês específico (normalmente
// automático via /api/summary, mas útil para regenerar manualmente).
router.post('/materialize', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month é obrigatório (YYYY-MM)' });
  const [y, m] = month.split('-').map(Number);
  const created = await materializeRecurringForMonth(y, m - 1);
  res.json({ created: created.length });
});

module.exports = router;
