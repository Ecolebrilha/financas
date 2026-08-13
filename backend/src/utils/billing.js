// Filtro Prisma reaproveitado sempre que um Expense precisa ser buscado
// por período considerando o override de billingDate: usa billingDate
// quando preenchido, senão cai pra `date` (a data real da compra).
function billingDateWhere(start, end) {
  return {
    OR: [
      { billingDate: null, date: { gte: start, lt: end } },
      { billingDate: { gte: start, lt: end } },
    ],
  };
}

// A data "efetiva" de um Expense já carregado (billingDate se houver,
// senão date) — usar pra qualquer cálculo de fatura/período em memória.
function effectiveDate(expense) {
  return expense.billingDate || expense.date;
}

const { monthKey, nextDueDate, PRIMARY_CYCLE_DAY } = require('./dates');

// Rótulo de período de fatura (mesmo formato "YYYY-MM" usado pelo Painel)
// de um Expense já carregado com `paymentMethod`. Cada cartão tem seu
// próprio dia de corte (`paymentMethod.dueDay`) — ex: Riachuelo vence dia
// 15 em vez do dia 10 padrão dos outros cartões — então uma mesma data de
// compra/fatura pode cair num período diferente dependendo do cartão.
// Cartões sem dueDay (Pix, etc.) caem no corte padrão do Painel.
function invoicePeriodLabelForExpense(expense, primaryCutoff = PRIMARY_CYCLE_DAY) {
  const cutoffDay = expense.paymentMethod?.dueDay || primaryCutoff;
  return monthKey(nextDueDate(effectiveDate(expense), cutoffDay));
}

// Um Expense conta pro período `monthParam` do Painel considerando o dia
// de corte do próprio cartão dele, não um corte único pra todo mundo.
function matchesInvoicePeriod(expense, monthParam, primaryCutoff = PRIMARY_CYCLE_DAY) {
  return invoicePeriodLabelForExpense(expense, primaryCutoff) === monthParam;
}

module.exports = { billingDateWhere, effectiveDate, invoicePeriodLabelForExpense, matchesInvoicePeriod };
