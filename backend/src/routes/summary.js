const express = require('express');
const prisma = require('../db');
const { parseMonthParam, periodLabelForDate, shiftMonthKey } = require('../utils/dates');
const { round2, sum, groupSumByEntity, groupSumByKey } = require('../utils/aggregate');
const { getOpenInstallmentGroups } = require('../utils/installments');
const { getCardInvoices } = require('../utils/cards');
const { billingDateWhere } = require('../utils/billing');
const { getPeriodData, buildWithdrawalAdvice } = require('../utils/periodData');
const { getCashOverview } = require('../utils/cashFlow');

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

router.get('/', async (req, res) => {
  // "Hoje" pro Painel é o período de FATURA em que a data atual cai (dia
  // 11 a dia 10), não o mês civil — senão, entre o dia 11 e o fim do
  // mês, o padrão abriria sempre na fatura que já fechou/venceu em vez
  // da que está em aberto.
  const todayKey = periodLabelForDate(new Date());
  const monthParam = req.query.month || todayKey;
  const data = await getPeriodData(monthParam);

  const isFuture = monthParam > todayKey;

  // Pra período futuro, o que passa de um mês pro outro não é o saldo por
  // competência: a dívida do mês anterior você sempre paga, então só pesa
  // no mês seguinte o repasse do saque no limite do cartão (opção
  // recomendada) que cobriu a falta. O ponto de partida é a falta REAL da
  // tela Caixa (dinheiro em conta + Flash), não o saldo por competência.
  let carryOver = 0;
  if (isFuture) {
    const dues = new Map();
    const schedule = (advice, fromKey) => {
      const { total, perInstallment, installments } = advice.options[advice.recommended];
      for (let n = 1; n <= installments; n += 1) {
        const key = shiftMonthKey(fromKey, n);
        dues.set(key, round2((dues.get(key) || 0) + (installments === 1 ? total : perInstallment)));
      }
    };
    const cash = await getCashOverview();
    if (cash.withdrawal) schedule(cash.withdrawal, todayKey);

    let cursor = shiftMonthKey(todayKey, 1);
    let guard = 0;
    while (cursor <= monthParam && guard < 36) {
      const due = dues.get(cursor) || 0;
      if (cursor === monthParam) {
        carryOver = round2(-due);
        break;
      }
      const cursorData = await getPeriodData(cursor);
      const after = round2(cursorData.balance - due);
      if (after < 0) schedule(await buildWithdrawalAdvice(round2(-after), cursor), cursor);
      cursor = shiftMonthKey(cursor, 1);
      guard += 1;
    }
  }
  const projectedBalance = round2(carryOver + data.balance);
  const headlineBalance = isFuture ? projectedBalance : data.balance;

  // Quando o saldo fica negativo, sugere como sacar a diferença no limite
  // do cartão (ver buildWithdrawalAdvice).
  const cardWithdrawal = headlineBalance < 0 ? await buildWithdrawalAdvice(round2(Math.abs(headlineBalance)), monthParam) : null;

  const [openInstallments, cardInvoices] = await Promise.all([getOpenInstallmentGroups(), getCardInvoices(monthParam)]);

  res.json({
    month: monthParam,
    period: { start: data.start, end: new Date(data.end.getTime() - 1) },
    totals: {
      expenses: data.selfExpenses,
      expensesImmediate: data.selfExpensesImmediate,
      expensesCard: data.selfExpensesCard,
      householdExpenses: data.householdExpenses,
      income: data.income,
      incomeRegular: data.incomeRegular,
      incomeFromOthers: data.incomeFromOthers,
      balance: data.balance,
      isFuture,
      projectedBalance: isFuture ? projectedBalance : data.balance,
      carryOver: isFuture ? carryOver : 0,
    },
    expenses: data.expenses,
    incomes: data.incomes,
    incomesForBalance: data.incomesForBalance,
    payments: data.payments,
    byPerson: groupSumByEntity(data.expenses, (e) => e.person, (e) => e.amount),
    owedByPerson: data.owedByPerson,
    byPaymentMethod: groupSumByEntity(data.expenses, (e) => e.paymentMethod, (e) => e.amount),
    byCategory: groupSumByEntity(data.expenses, (e) => e.category, (e) => e.amount),
    incomeByType: groupSumByKey(data.incomes, (i) => i.type, (i) => i.amount),
    recurringExpenses: data.expenses.filter((e) => e.recurringTemplateId),
    recurringIncomes: data.incomes.filter((i) => i.recurringIncomeId),
    openInstallments,
    cardInvoices,
    cardWithdrawal,
    expenseCount: data.expenses.length,
    incomeCount: data.incomes.length,
  });
});

module.exports = router;
