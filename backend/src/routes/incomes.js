const express = require('express');
const prisma = require('../db');
const { INCOME_TYPES } = require('../constants');

const router = express.Router();

function parseDate(str) {
  return new Date(`${str}T00:00:00.000Z`);
}

router.get('/', async (req, res) => {
  const { month, personId, type, from, to } = req.query;
  const where = {};
  if (month) {
    const [y, m] = month.split('-').map(Number);
    where.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  } else if (from || to) {
    where.date = {};
    if (from) where.date.gte = parseDate(from);
    if (to) where.date.lt = new Date(parseDate(to).getTime() + 24 * 60 * 60 * 1000);
  }
  if (personId) where.personId = personId;
  if (type) where.type = type;

  const incomes = await prisma.income.findMany({ where, include: { person: true }, orderBy: { date: 'desc' } });
  res.json(incomes);
});

router.post('/', async (req, res) => {
  const body = req.body;
  if (!body.description || body.amount === undefined || !body.date || !body.type) {
    return res.status(400).json({ error: 'description, amount, date e type são obrigatórios' });
  }
  if (!INCOME_TYPES.includes(body.type)) {
    return res.status(400).json({ error: `type deve ser um de: ${INCOME_TYPES.join(', ')}` });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número maior que zero' });
  }

  const income = await prisma.income.create({
    data: {
      description: String(body.description).trim(),
      amount,
      date: parseDate(body.date),
      personId: body.personId || null,
      type: body.type,
      notes: body.notes || null,
    },
  });
  res.status(201).json(income);
});

router.put('/:id', async (req, res) => {
  const body = req.body;
  const data = {};
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.amount !== undefined) data.amount = Number(body.amount);
  if (body.date !== undefined) data.date = parseDate(body.date);
  if (body.personId !== undefined) data.personId = body.personId || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.type !== undefined) {
    if (!INCOME_TYPES.includes(body.type)) {
      return res.status(400).json({ error: `type deve ser um de: ${INCOME_TYPES.join(', ')}` });
    }
    data.type = body.type;
  }

  try {
    const income = await prisma.income.update({ where: { id: req.params.id }, data, include: { person: true } });
    res.json(income);
  } catch (e) {
    res.status(404).json({ error: 'Receita não encontrada' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.income.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    res.status(404).json({ error: 'Receita não encontrada' });
  }
});

module.exports = router;
