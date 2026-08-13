const crypto = require('crypto');
const prisma = require('../db');
const { addMonths, startOfMonth } = require('./dates');

// Cria um gasto único, ou, se for parcelado com geração automática marcada,
// cria uma linha por parcela (mês a mês) compartilhando installmentGroupId.
async function createExpenseWithInstallments(data) {
  const { installmentTotal, installmentNumber, generateFuture, date, billingDate, ...rest } = data;

  const total = installmentTotal || null;
  const startNumber = installmentNumber || (total ? 1 : null);

  if (!total || total <= 1 || !generateFuture) {
    return prisma.expense.create({
      data: {
        ...rest,
        date,
        billingDate: billingDate || null,
        installmentTotal: total,
        installmentNumber: startNumber,
      },
    });
  }

  const groupId = crypto.randomUUID();
  const rows = [];
  for (let n = startNumber; n <= total; n++) {
    const monthsAhead = n - startNumber;
    rows.push({
      ...rest,
      date: addMonths(date, monthsAhead),
      // A fatura prevista informada vale só pra parcela que ela foi
      // preenchida (a atual); as futuras seguem a mesma progressão
      // mensal, senão todas cairiam empilhadas na fatura da primeira.
      billingDate: billingDate ? addMonths(billingDate, monthsAhead) : null,
      installmentGroupId: groupId,
      installmentNumber: n,
      installmentTotal: total,
    });
  }
  await prisma.expense.createMany({ data: rows });
  return prisma.expense.findMany({
    where: { installmentGroupId: groupId },
    orderBy: { installmentNumber: 'asc' },
    include: { person: true, paymentMethod: true, category: true },
  });
}

// Lista, por grupo de parcelamento, quanto ainda falta pagar (parcelas com
// data no mês atual ou em meses futuros) e quando termina.
async function getOpenInstallmentGroups(referenceDate = new Date()) {
  const refStart = startOfMonth(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth());

  const rows = await prisma.expense.findMany({
    where: { installmentGroupId: { not: null } },
    include: { person: true, paymentMethod: true, category: true },
    orderBy: [{ installmentGroupId: 'asc' }, { installmentNumber: 'asc' }],
  });

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.installmentGroupId)) groups.set(row.installmentGroupId, []);
    groups.get(row.installmentGroupId).push(row);
  }

  const result = [];
  for (const [groupId, items] of groups) {
    const remaining = items.filter((i) => i.date >= refStart);
    if (remaining.length === 0) continue;
    const last = items[items.length - 1];
    const first = items[0];
    result.push({
      installmentGroupId: groupId,
      description: first.description,
      person: first.person,
      paymentMethod: first.paymentMethod,
      category: first.category,
      installmentTotal: first.installmentTotal,
      installmentAmount: first.amount,
      installmentsPaid: first.installmentTotal - remaining.length,
      installmentsRemaining: remaining.length,
      remainingAmount: Math.round((remaining.reduce((s, i) => s + i.amount, 0) + Number.EPSILON) * 100) / 100,
      finalDate: last.date,
    });
  }

  return result.sort((a, b) => new Date(a.finalDate) - new Date(b.finalDate));
}

module.exports = { createExpenseWithInstallments, getOpenInstallmentGroups };
