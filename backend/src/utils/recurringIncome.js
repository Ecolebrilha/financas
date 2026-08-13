const prisma = require('../db');
const { clampDay, lastBusinessDayOfMonth, startOfMonth, endOfMonthExclusive } = require('./dates');

// Mesma ideia de materializeRecurringForMonth (gastos fixos), mas pra
// receitas fixas (salário, Flash, etc). Idempotente: não duplica se já
// existe uma receita daquele template naquele mês.
async function materializeRecurringIncomeForMonth(year, monthIndex) {
  const templates = await prisma.recurringIncome.findMany({ where: { active: true } });
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

    const existing = await prisma.income.findFirst({
      where: {
        recurringIncomeId: t.id,
        date: { gte: monthStart, lt: monthEnd },
      },
    });
    if (existing) continue;

    const date = t.lastBusinessDay
      ? lastBusinessDayOfMonth(year, monthIndex)
      : new Date(Date.UTC(year, monthIndex, clampDay(year, monthIndex, t.dayOfMonth || 1)));

    const income = await prisma.income.create({
      data: {
        description: t.description,
        amount: t.amount,
        date,
        personId: t.personId,
        type: t.type,
        notes: t.notes,
        recurringIncomeId: t.id,
      },
    });
    created.push(income);
  }
  return created;
}

module.exports = { materializeRecurringIncomeForMonth };
