const express = require('express');
const prisma = require('../db');
const { parseMonthParam, currentMonthKey, shiftMonthKey, invoicePeriodForMonthParam, addMonths } = require('../utils/dates');
const { round2, sum, groupSumByEntity, groupSumByKey } = require('../utils/aggregate');
const { materializeRecurringForMonth } = require('../utils/recurring');
const { materializeRecurringIncomeForMonth } = require('../utils/recurringIncome');
const { getOpenInstallmentGroups } = require('../utils/installments');
const { getCardInvoices } = require('../utils/cards');
const { billingDateWhere, matchesInvoicePeriod } = require('../utils/billing');

const router = express.Router();

// Comparativo entre meses (para a página de histórico). Ex: /history?months=12
router.get('/history', async (req, res) => {
  const n = Math.min(Number(req.query.months) || 12, 36);
  const today = new Date();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  const results = [];
  for (const m of months) {
    const { start, end } = parseMonthParam(m);
    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({ where: billingDateWhere(start, end), include: { category: true } }),
      prisma.income.findMany({ where: { date: { gte: start, lt: end } } }),
    ]);
    results.push({
      month: m,
      totalExpenses: round2(sum(expenses, 'amount')),
      totalIncome: round2(sum(incomes, 'amount')),
      byCategory: groupSumByEntity(expenses, (e) => e.category, (e) => e.amount),
    });
  }
  res.json(results);
});

// Busca (e materializa recorrentes de) um período de fatura, retornando
// tudo que o Painel precisa pra aquele período especificamente — sem a
// parte de projeção/carry-over, que é responsabilidade de quem chama.
async function getPeriodData(monthParam) {
  const { year, monthIndex, start, end } = invoicePeriodForMonthParam(monthParam);
  const previousMonth = addMonths(new Date(Date.UTC(year, monthIndex, 1)), -1);

  // Materializa os recorrentes dos dois meses civis que o período cobre,
  // mesmo que sejam períodos futuros — assim, ao navegar pra frente, o
  // Painel já mostra a projeção de receitas/gastos fixos daquele período.
  await Promise.all([
    materializeRecurringForMonth(year, monthIndex),
    materializeRecurringIncomeForMonth(year, monthIndex),
    materializeRecurringForMonth(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth()),
    materializeRecurringIncomeForMonth(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth()),
  ]);

  const [allExpenses, incomes, payments] = await Promise.all([
    // Não dá pra filtrar isso direto no banco por um único intervalo de
    // datas: cada cartão pode ter seu próprio dia de corte (ex: Riachuelo
    // vence dia 15), então o período de fatura de uma compra depende de
    // qual cartão ela é. Busca tudo e filtra em memória por
    // matchesInvoicePeriod — o volume de dados é pequeno o bastante pra
    // isso não ser um problema.
    prisma.expense.findMany({
      include: { person: true, paymentMethod: true, category: true },
      orderBy: { date: 'desc' },
    }),
    prisma.income.findMany({
      where: { date: { gte: start, lt: end } },
      include: { person: true },
      orderBy: { date: 'desc' },
    }),
    prisma.payment.findMany({
      where: { date: { gte: start, lt: end } },
      include: { person: true },
      orderBy: { date: 'desc' },
    }),
  ]);
  const expenses = allExpenses.filter((e) => matchesInvoicePeriod(e, monthParam));

  const householdExpenses = round2(sum(expenses, 'amount'));
  // Saldo é sempre da sua parte: sua receita menos só os SEUS gastos — o
  // que as outras pessoas gastaram nos cartões compartilhados é cobrança
  // (ver Vencimento dos cartões), não dinheiro seu de fato.
  const selfExpenses = round2(sum(expenses.filter((e) => e.person?.isSelf), 'amount'));
  const income = round2(sum(incomes, 'amount'));

  return {
    start,
    end,
    expenses,
    incomes,
    payments,
    householdExpenses,
    selfExpenses,
    income,
    balance: round2(income - selfExpenses),
  };
}

router.get('/', async (req, res) => {
  const monthParam = req.query.month || currentMonthKey();
  const data = await getPeriodData(monthParam);

  const todayKey = currentMonthKey();
  const isFuture = monthParam > todayKey;

  // Pra período futuro, simula o saldo acumulado: soma o saldo (receita -
  // seus gastos) de cada período entre hoje e o período pedido, incluindo
  // despesas fixas e parcelas já lançadas nesse meio-tempo (a "dívida" ou
  // sobra que carrega de um período pro outro).
  let carryOver = 0;
  if (isFuture) {
    let cursor = todayKey;
    let guard = 0;
    while (cursor !== monthParam && guard < 36) {
      const cursorData = await getPeriodData(cursor);
      carryOver = round2(carryOver + cursorData.balance);
      cursor = shiftMonthKey(cursor, 1);
      guard += 1;
    }
  }
  const projectedBalance = round2(carryOver + data.balance);

  const [openInstallments, cardInvoices] = await Promise.all([getOpenInstallmentGroups(), getCardInvoices(monthParam)]);

  res.json({
    month: monthParam,
    period: { start: data.start, end: new Date(data.end.getTime() - 1) },
    totals: {
      expenses: data.selfExpenses,
      householdExpenses: data.householdExpenses,
      income: data.income,
      balance: data.balance,
      isFuture,
      projectedBalance: isFuture ? projectedBalance : data.balance,
      carryOver: isFuture ? carryOver : 0,
    },
    expenses: data.expenses,
    payments: data.payments,
    byPerson: groupSumByEntity(data.expenses, (e) => e.person, (e) => e.amount),
    byPaymentMethod: groupSumByEntity(data.expenses, (e) => e.paymentMethod, (e) => e.amount),
    byCategory: groupSumByEntity(data.expenses, (e) => e.category, (e) => e.amount),
    incomeByType: groupSumByKey(data.incomes, (i) => i.type, (i) => i.amount),
    recurringExpenses: data.expenses.filter((e) => e.recurringTemplateId),
    recurringIncomes: data.incomes.filter((i) => i.recurringIncomeId),
    openInstallments,
    cardInvoices,
    expenseCount: data.expenses.length,
    incomeCount: data.incomes.length,
  });
});

module.exports = router;
