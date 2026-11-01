const express = require('express');
const prisma = require('../db');
const { INCOME_TYPES } = require('../constants');
const { materializeRecurringIncomeForMonth } = require('../utils/recurringIncome');
const { startOfMonth, clampDay, lastBusinessDayOfMonth } = require('../utils/dates');

const router = express.Router();
const INCLUDE = { person: true };

// Mesmo motivo de syncMaterializedFromTemplate em recurring.js: materializar
// não sobrescreve o que já existe, então sincroniza o(s) lançamento(s)
// deste mês em diante pra refletir a edição do template na hora.
async function syncMaterializedFromTemplate(template) {
  const now = new Date();
  const monthStart = startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
  const rows = await prisma.income.findMany({ where: { recurringIncomeId: template.id, date: { gte: monthStart } } });
  for (const row of rows) {
    const year = row.date.getUTCFullYear();
    const monthIndex = row.date.getUTCMonth();
    const date = template.lastBusinessDay
      ? lastBusinessDayOfMonth(year, monthIndex)
      : new Date(Date.UTC(year, monthIndex, clampDay(year, monthIndex, template.dayOfMonth || 1)));
    await prisma.income.update({
      where: { id: row.id },
      data: {
        description: template.description,
        amount: template.amount,
        personId: template.personId,
        type: template.type,
        notes: template.notes,
        date,
      },
    });
  }
}

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
    await syncMaterializedFromTemplate(item);
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Receita recorrente não encontrada' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.recurringIncome.update({ where: { id: req.params.id }, data: { active: false } });
    const now = new Date();
    const monthStart = startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
    await prisma.income.deleteMany({ where: { recurringIncomeId: item.id, date: { gte: monthStart } } });
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
