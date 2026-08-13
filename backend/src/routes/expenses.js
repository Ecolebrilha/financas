const express = require('express');
const prisma = require('../db');
const { createExpenseWithInstallments } = require('../utils/installments');
const { billingDateWhere } = require('../utils/billing');

const router = express.Router();
const INCLUDE = { person: true, paymentMethod: true, category: true };

function parseDate(str) {
  return new Date(`${str}T00:00:00.000Z`);
}

router.get('/', async (req, res) => {
  const {
    month,
    personId,
    paymentMethodId,
    categoryId,
    from,
    to,
    installmentGroupId,
    recurringTemplateId,
    search,
  } = req.query;

  let where = {};
  if (month) {
    const [y, m] = month.split('-').map(Number);
    where = billingDateWhere(new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1)));
  } else if (from || to) {
    const gte = from ? parseDate(from) : new Date(0);
    const lt = to ? new Date(parseDate(to).getTime() + 24 * 60 * 60 * 1000) : new Date(8640000000000000);
    where = billingDateWhere(gte, lt);
  }
  if (personId) where.personId = personId;
  if (paymentMethodId) where.paymentMethodId = paymentMethodId;
  if (categoryId) where.categoryId = categoryId;
  if (installmentGroupId) where.installmentGroupId = installmentGroupId;
  if (recurringTemplateId) where.recurringTemplateId = recurringTemplateId;
  if (search) where.description = { contains: search };

  const expenses = await prisma.expense.findMany({ where, include: INCLUDE, orderBy: { date: 'desc' } });
  res.json(expenses);
});

router.get('/:id', async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id }, include: INCLUDE });
  if (!expense) return res.status(404).json({ error: 'Gasto não encontrado' });
  res.json(expense);
});

router.post('/', async (req, res) => {
  const body = req.body;
  if (!body.description || body.amount === undefined || !body.date || !body.personId || !body.paymentMethodId || !body.categoryId) {
    return res.status(400).json({
      error: 'description, amount, date, personId, paymentMethodId e categoryId são obrigatórios',
    });
  }
  const magnitude = Number(body.amount);
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número maior que zero' });
  }
  // Estorno é registrado como valor negativo: some naturalmente com o
  // resto da fatura/relatórios em vez de precisar de lógica separada em
  // cada soma (fatura do cartão, saldo do mês, gasto por categoria etc).
  const amount = body.isRefund ? -magnitude : magnitude;

  const data = {
    description: String(body.description).trim(),
    amount,
    date: parseDate(body.date),
    personId: body.personId,
    paymentMethodId: body.paymentMethodId,
    categoryId: body.categoryId,
    notes: body.notes || null,
    billingDate: body.billingDate ? parseDate(body.billingDate) : null,
  };

  try {
    const result = await createExpenseWithInstallments({
      ...data,
      installmentNumber: body.installmentNumber ? Number(body.installmentNumber) : null,
      installmentTotal: body.installmentTotal ? Number(body.installmentTotal) : null,
      generateFuture: !!body.generateFutureInstallments,
    });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Não foi possível criar o gasto' });
  }
});

router.put('/:id', async (req, res) => {
  const body = req.body;
  const data = {};
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.amount !== undefined) {
    const magnitude = Math.abs(Number(body.amount));
    data.amount = body.isRefund ? -magnitude : magnitude;
  }
  if (body.date !== undefined) data.date = parseDate(body.date);
  if (body.personId !== undefined) data.personId = body.personId;
  if (body.paymentMethodId !== undefined) data.paymentMethodId = body.paymentMethodId;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.billingDate !== undefined) data.billingDate = body.billingDate ? parseDate(body.billingDate) : null;
  if (body.installmentNumber !== undefined) {
    data.installmentNumber = body.installmentNumber ? Number(body.installmentNumber) : null;
  }
  if (body.installmentTotal !== undefined) {
    data.installmentTotal = body.installmentTotal ? Number(body.installmentTotal) : null;
  }

  try {
    const expense = await prisma.expense.update({ where: { id: req.params.id }, data, include: INCLUDE });
    res.json(expense);
  } catch (e) {
    res.status(404).json({ error: 'Gasto não encontrado' });
  }
});

// Marca/desmarca uma compra individual como quitada (ver Vencimento dos
// cartões no Painel) — o valor pendente do cartão pra aquela pessoa é
// sempre recalculado a partir disso, não é um número guardado à parte.
router.put('/:id/settle', async (req, res) => {
  const settled = !!req.body.settled;
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { settledAt: settled ? new Date() : null },
      include: INCLUDE,
    });
    res.json(expense);
  } catch (e) {
    res.status(404).json({ error: 'Gasto não encontrado' });
  }
});

router.delete('/:id', async (req, res) => {
  // scope=group apaga esta parcela e todas as futuras do mesmo grupo
  const { scope } = req.query;
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) return res.status(404).json({ error: 'Gasto não encontrado' });

    if (scope === 'group' && expense.installmentGroupId) {
      await prisma.expense.deleteMany({
        where: {
          installmentGroupId: expense.installmentGroupId,
          installmentNumber: { gte: expense.installmentNumber },
        },
      });
    } else {
      await prisma.expense.delete({ where: { id: req.params.id } });
    }
    res.status(204).end();
  } catch (e) {
    res.status(404).json({ error: 'Gasto não encontrado' });
  }
});

module.exports = router;
