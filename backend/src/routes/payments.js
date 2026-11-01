const express = require('express');
const prisma = require('../db');

const router = express.Router();

function parseDate(str) {
  return new Date(`${str}T00:00:00.000Z`);
}

router.get('/', async (req, res) => {
  const { personId, from, to } = req.query;
  const where = {};
  if (personId) where.personId = personId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = parseDate(from);
    if (to) where.date.lt = new Date(parseDate(to).getTime() + 24 * 60 * 60 * 1000);
  }
  const payments = await prisma.payment.findMany({ where, include: { person: true }, orderBy: { date: 'desc' } });
  res.json(payments);
});

router.post('/', async (req, res) => {
  const { personId, amount, date, notes } = req.body;
  if (!personId || amount === undefined || !date) {
    return res.status(400).json({ error: 'personId, amount e date são obrigatórios' });
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número maior que zero' });
  }
  const payment = await prisma.payment.create({
    data: { personId, amount: value, date: parseDate(date), notes: notes || null },
    include: { person: true },
  });
  res.status(201).json(payment);
});

router.put('/:id', async (req, res) => {
  const body = req.body;
  const data = {};
  if (body.personId !== undefined) data.personId = body.personId;
  if (body.date !== undefined) data.date = parseDate(body.date);
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.amount !== undefined) {
    const value = Number(body.amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'amount deve ser um número maior que zero' });
    }
    data.amount = value;
  }

  try {
    const payment = await prisma.payment.update({ where: { id: req.params.id }, data, include: { person: true } });
    res.json(payment);
  } catch (e) {
    res.status(404).json({ error: 'Abatimento não encontrado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.payment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    res.status(404).json({ error: 'Abatimento não encontrado' });
  }
});

module.exports = router;
