const prisma = require('../db');
const { shiftMonthKey, invoicePeriodForMonthParam, addMonths } = require('./dates');
const { round2, sum, groupSumByEntity } = require('./aggregate');
const { materializeRecurringForMonth } = require('./recurring');
const { materializeRecurringIncomeForMonth } = require('./recurringIncome');
const { getUsedCreditLimits, getDynamicCreditLimits } = require('./cards');
const { matchesInvoicePeriod } = require('./billing');

// Taxa do saque do limite via Mercado Pago (1x ou 2x) — usada tanto na
// sugestão de saque quanto pra calcular quanto uma receita vinculada a
// um cartão (ver creditLimitIncomeType) realmente vale em dinheiro.
const WITHDRAWAL_FEE_RATES = { 1: 0.0357, 2: 0.0779 };

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
  // bolso (Pix/Débito/Flash — pago na hora, não tem fatura; Flash é
  // saldo pré-pago, gasto na hora igual Pix) do que é dívida de cartão
  // de crédito que só vence depois. Pra fluxo de caixa, os dois contam
  // igual no saldo total, mas são coisas diferentes: um já foi, o outro
  // ainda precisa ter dinheiro guardado pra pagar na hora certa.
  const IMMEDIATE_TYPES = ['PIX', 'DEBIT_CARD', 'VOUCHER'];
  const selfExpensesImmediate = round2(
    sum(selfPeriodExpenses.filter((e) => IMMEDIATE_TYPES.includes(e.paymentMethod?.type)), 'amount'),
  );
  const selfExpensesCard = round2(selfExpenses - selfExpensesImmediate);
  // Receita não é só o que entra "de fora" (salário, Flash etc) — o que
  // as outras pessoas gastaram em Pix ou Flash também conta, porque elas
  // vão te devolver esse valor de qualquer jeito (ver "Gasto por
  // pessoa"). NÃO entra o que gastaram no cartão de crédito — essa é
  // fatura que você paga depois, não dinheiro que volta pra você como um
  // Pix. Isso é o TOTAL gasto delas em Pix/Flash, não só o que falta —
  // um abatimento (Payment) já recebido não soma de novo aqui, ele só
  // abate o "pendente" mostrado em Gasto por pessoa; a dívida inteira já
  // está contada na hora que o gasto dela é lançado, não quando ela paga.
  // Receita de um cartão tipo Flash (ver creditLimitIncomeType) não vale
  // o valor bruto depositado — vale quanto sobra de saldo nele AGORA,
  // líquido da taxa de saque em 1x (é assim que você de fato transforma
  // esse saldo em dinheiro: sacando na maquineta). incomesForBalance é
  // uma cópia ajustada só pra esse cálculo e pro "De onde vem esse
  // número" — a receita bruta real (`incomes`) continua intacta em
  // Receitas fixas/Mais → Receitas.
  const linkedCards = await prisma.paymentMethod.findMany({ where: { creditLimitIncomeType: { not: null } } });
  let incomesForBalance = incomes;
  let linkedCardDetails = [];
  if (linkedCards.length > 0) {
    const [usedByCard, dynamicByCard] = await Promise.all([
      getUsedCreditLimits(linkedCards),
      getDynamicCreditLimits(linkedCards),
    ]);
    linkedCardDetails = linkedCards.map((card) => {
      const limit = dynamicByCard.get(card.id) ?? card.creditLimit ?? 0;
      const used = usedByCard.get(card.id) ?? 0;
      const available = Math.max(round2(limit - used), 0);
      return {
        cardId: card.id,
        cardName: card.name,
        incomeType: card.creditLimitIncomeType,
        limit: round2(limit),
        used,
        available,
        feeRate: WITHDRAWAL_FEE_RATES[1],
        netWithdrawable: round2(available * (1 - WITHDRAWAL_FEE_RATES[1])),
      };
    });
    const detailByType = new Map(linkedCardDetails.map((d) => [d.incomeType, d]));
    incomesForBalance = incomes.map((i) => {
      const detail = detailByType.get(i.type);
      return detail ? { ...i, amount: detail.netWithdrawable } : i;
    });
  }
  const incomeRegular = round2(sum(incomesForBalance, 'amount'));
  const OTHERS_RECEIVABLE_TYPES = ['PIX', 'VOUCHER'];
  const otherPeopleExpenses = expenses.filter(
    (e) => !e.person?.isSelf && OTHERS_RECEIVABLE_TYPES.includes(e.paymentMethod?.type),
  );
  const incomeFromOthers = round2(sum(otherPeopleExpenses, 'amount'));
  const owedByPerson = groupSumByEntity(otherPeopleExpenses, (e) => e.person, (e) => e.amount);
  const income = round2(incomeRegular + incomeFromOthers);

  return {
    start,
    end,
    expenses,
    incomes,
    incomesForBalance,
    linkedCardDetails,
    payments,
    householdExpenses,
    selfExpenses,
    selfExpensesImmediate,
    selfExpensesCard,
    incomeRegular,
    incomeFromOthers,
    owedByPerson,
    income,
    balance: round2(income - selfExpenses),
  };
}

// Sugere como cobrir `amountNeeded` sacando do limite do cartão via
// Mercado Pago (único jeito que você usa pra isso): a taxa de 1x é mais
// barata, mas se pagar tudo de uma vez deixaria o MÊS SEGUINTE também
// no vermelho, parcelar em 2x (mais caro no total, mas mais leve por
// mês) costuma ser a escolha certa — mesmo critério que você já usa na
// prática, só automatizado. `monthParam` é o período de referência; o
// "mês seguinte" é calculado a partir dele.
async function buildWithdrawalAdvice(amountNeeded, monthParam) {
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

  return {
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

module.exports = { WITHDRAWAL_FEE_RATES, getPeriodData, buildWithdrawalAdvice };
