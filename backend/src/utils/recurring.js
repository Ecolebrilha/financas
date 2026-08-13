const prisma = require('../db');
const { clampDay, startOfMonth, endOfMonthExclusive } = require('./dates');

// Garante que os gastos fixos/recorrentes ativos tenham uma linha de Expense
// gerada para o mês (year/monthIndex) informado. Idempotente: não duplica se
// já existe um lançamento daquele template naquele mês.
async function materializeRecurringForMonth(year, monthIndex) {
  const templates = await prisma.recurringExpense.findMany({ where: { active: true } });
  const monthStart = startOfMonth(year, monthIndex);
  const monthEnd = endOfMonthExclusive(year, monthIndex);
  const targetYm = year * 12 + monthIndex;

  const created = [];
  for (const t of templates) {
    const start = new Date(t.startDate);
    const startYm = start.getUTCFullYear() * 12 + start.getUTCMonth();
    if (targetYm < startYm) continue;

    if (t.endDate) {
      const end = new Date(t.endDate);
      const endYm = end.getUTCFullYear() * 12 + end.getUTCMonth();
      if (targetYm > endYm) continue;
    }

    const existing = await prisma.expense.findFirst({
      where: {
        recurringTemplateId: t.id,
        date: { gte: monthStart, lt: monthEnd },
      },
    });
    if (existing) continue;

    const day = clampDay(year, monthIndex, t.dayOfMonth || 1);
    const expense = await prisma.expense.create({
      data: {
        description: t.description,
        amount: t.amount,
        date: new Date(Date.UTC(year, monthIndex, day)),
        personId: t.personId,
        paymentMethodId: t.paymentMethodId,
        categoryId: t.categoryId,
        notes: t.notes,
        recurringTemplateId: t.id,
      },
    });
    created.push(expense);
  }
  return created;
}

module.exports = { materializeRecurringForMonth };
