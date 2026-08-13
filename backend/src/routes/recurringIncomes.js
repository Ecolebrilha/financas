const express = require('express');
const prisma = require('../db');
const { INCOME_TYPES } = require('../constants');
const { materializeRecurringIncomeForMonth } = require('../utils/recurringIncome');

const router = express.Router();
const INCLUDE = { person: true };

router.get('/', async (req, res) => {
  const where = req.query.includeInactive === 'true' ? {} : { active: true };
  const items = await prisma.recurringIncome.findMany({ where, include: INCLUDE, orderBy: { description: 'asc' } });
  res.json(items);
});

router.post('/', async (req, res) => {
  const body = req.body;
  if (!body.description || body.amount === undefined || !body.type) {
    return res.status(400).json({ error: 'description, amount e type são obrigatórios' });
  }
  if (!INCOME_TYPES.includes(body.type)) {
    return res.status(400).json({ error: `type deve ser um de: ${INCOME_TYPES.join(', ')}` });
  }
  const item = await prisma.recurringIncome.create({
    data: {
      description: String(body.description).trim(),
      amount: Number(body.amount),
      personId: body.personId || null,
      type: body.type,
      dayOfMonth: body.dayOfMonth ? Number(body.dayOfMonth) : 1,
      lastBusinessDay: !!body.lastBusinessDay,
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
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.amount !== undefined) data.amount = Number(body.amount);
  if (body.personId !== undefined) data.personId = body.personId || null;
  if (body.type !== undefined) {
    if (!INCOME_TYPES.includes(body.type)) {
      return res.status(400).json({ error: `type deve ser um de: ${INCOME_TYPES.join(', ')}` });
    }
    data.type = body.type;
  }
  if (body.dayOfMonth !== undefined) data.dayOfMonth = Number(body.dayOfMonth);
  if (body.lastBusinessDay !== undefined) data.lastBusinessDay = !!body.lastBusinessDay;
  if (body.active !== undefined) data.active = body.active;
  if (body.startDate !== undefined) data.startDate = new Date(`${body.startDate}T00:00:00.000Z`);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null;
  if (body.notes !== undefined) data.notes = body.notes || null;

  try {
    const item = await prisma.recurringIncome.update({ where: { id: req.params.id }, data, include: INCLUDE });
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Receita recorrente não encontrada' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.recurringIncome.update({ where: { id: req.params.id }, data: { active: false } });
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Receita recorrente não encontrada' });
  }
});

router.post('/materialize', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month é obrigatório (YYYY-MM)' });
  const [y, m] = month.split('-').map(Number);
  const created = await materializeRecurringIncomeForMonth(y, m - 1);
  res.json({ created: created.length });
});

module.exports = router;
