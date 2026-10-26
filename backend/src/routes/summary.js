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
  const selfPeriodExpenses = expenses.filter((e) => e.person?.isSelf);
  const selfExpenses = round2(sum(selfPeriodExpenses, 'amount'));
  // Dentro dos SEUS gastos, separa o que já saiu de verdade do seu
  // bolso (Pix/Débito — pago na hora, não tem fatura) do que é dívida de
  // cartão de crédito que só vence depois. Pra fluxo de caixa, os dois
  // contam igual no saldo total, mas são coisas diferentes: um já foi,
  // o outro ainda precisa ter dinheiro guardado pra pagar na hora certa.
  const IMMEDIATE_TYPES = ['PIX', 'DEBIT_CARD'];
  const selfExpensesImmediate = round2(
    sum(selfPeriodExpenses.filter((e) => IMMEDIATE_TYPES.includes(e.paymentMethod?.type)), 'amount'),
  );
  const selfExpensesCard = round2(selfExpenses - selfExpensesImmediate);
  const income = round2(sum(incomes, 'amount'));

  return {
    start,
    end,
    expenses,
    incomes,
    payments,
    householdExpenses,
    selfExpenses,
    selfExpensesImmediate,
    selfExpensesCard,
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
  const headlineBalance = isFuture ? projectedBalance : data.balance;

  // Quando o saldo fica negativo, sugere como sacar a diferença no limite
  // do cartão via Mercado Pago (único jeito que você usa pra isso): a
  // taxa de 1x é mais barata, mas se pagar tudo de uma vez deixaria o MÊS
  // SEGUINTE também no vermelho, parcelar em 2x (mais caro no total, mas
  // mais leve por mês) costuma ser a escolha certa — mesmo critério que
  // você já usa na prática, só automatizado.
  const WITHDRAWAL_FEE_RATES = { 1: 0.0498, 2: 0.0691 };
  let cardWithdrawal = null;
  if (headlineBalance < 0) {
    const amountNeeded = round2(Math.abs(headlineBalance));
    const fee1x = round2(amountNeeded * WITHDRAWAL_FEE_RATES[1]);
    const total1x = round2(amountNeeded + fee1x);
    const fee2x = round2(amountNeeded * WITHDRAWAL_FEE_RATES[2]);
    const total2x = round2(amountNeeded + fee2x);

    const nextMonthParam = shiftMonthKey(monthParam, 1);
    const nextMonthData = await getPeriodData(nextMonthParam);
    // Se o mês seguinte já fecha no vermelho, pagar o saque inteiro em 1x
    // só pioraria — por isso o teste é contra o saldo dele JÁ descontando
    // o repasse de cada opção.
    const nextMonthBalanceIf1x = round2(nextMonthData.balance - total1x);
    const nextMonthBalanceIf2x = round2(nextMonthData.balance - total2x / 2);
    // 1x sai mais barato no total — só vale parcelar em 2x quando pagar
    // tudo de uma vez pesaria demais no mês seguinte (deixaria ele no
    // vermelho), que é exatamente o critério que você já usa na prática.
    const recommended = nextMonthBalanceIf1x < 0 ? 2 : 1;

    cardWithdrawal = {
      amountNeeded,
      options: {
        1: { installments: 1, feeRate: WITHDRAWAL_FEE_RATES[1], fee: fee1x, total: total1x, perInstallment: total1x },
        2: { installments: 2, feeRate: WITHDRAWAL_FEE_RATES[2], fee: fee2x, total: total2x, perInstallment: round2(total2x / 2) },
      },
      nextMonth: nextMonthParam,
      nextMonthBalanceBeforeWithdrawal: nextMonthData.balance,
      nextMonthBalanceIf1x,
      nextMonthBalanceIf2x,
      recommended,
    };
  }

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
    cardWithdrawal,
    expenseCount: data.expenses.length,
    incomeCount: data.incomes.length,
  });
});

module.exports = router;
