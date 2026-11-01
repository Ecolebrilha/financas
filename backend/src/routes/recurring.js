const express = require('express');
const prisma = require('../db');
const { materializeRecurringForMonth } = require('../utils/recurring');
const { startOfMonth, clampDay } = require('../utils/dates');

const router = express.Router();
const INCLUDE = { person: true, paymentMethod: true, category: true };

// Materializar é idempotente (não sobrescreve o que já existe), então
// editar o template sozinho não muda o lançamento deste mês que já foi
// gerado antes da edição — sincroniza esse(s) lançamento(s) (deste mês
// em diante; meses passados ficam como histórico, sem reescrever) pra
// refletir o template na hora.
async function syncMaterializedFromTemplate(template) {
  const now = new Date();
  const monthStart = startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
  const rows = await prisma.expense.findMany({ where: { recurringTemplateId: template.id, date: { gte: monthStart } } });
  for (const row of rows) {
    const year = row.date.getUTCFullYear();
    const monthIndex = row.date.getUTCMonth();
    const day = clampDay(year, monthIndex, template.dayOfMonth || 1);
    await prisma.expense.update({
      where: { id: row.id },
      data: {
        description: template.description,
        amount: template.amount,
        personId: template.personId,
        paymentMethodId: template.paymentMethodId,
        categoryId: template.categoryId,
        notes: template.notes,
        date: new Date(Date.UTC(year, monthIndex, day)),
      },
    });
  }
}

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
    await syncMaterializedFromTemplate(item);
    res.json(item);
  } catch (e) {
    res.status(404).json({ error: 'Gasto recorrente não encontrado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.recurringExpense.update({ where: { id: req.params.id }, data: { active: false } });
    // "Pausar" tira o lançamento de vista a partir de agora — não só
    // impede meses futuros ainda não gerados, também remove o deste mês
    // que já tinha sido materializado antes de pausar.
    const now = new Date();
    const monthStart = startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
    await prisma.expense.deleteMany({ where: { recurringTemplateId: item.id, date: { gte: monthStart } } });
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
