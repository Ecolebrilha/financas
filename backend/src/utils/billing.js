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

// Rótulo de período de fatura ("YYYY-MM") de uma data de vencimento
// efetiva, dado o método de pagamento. Dois modos:
// - normal: cartão tem um dia de corte fixo pra todo mundo
//   (`paymentMethod.dueDay`) — ex: Riachuelo vence dia 15 em vez do dia
//   10 padrão — então uma mesma data de compra pode cair num período
//   diferente dependendo do cartão. Cartões sem dueDay (Pix, etc.) caem
//   no corte padrão do Painel.
// - `dueDateFollowsPurchase`: cartões de loja (ex: Renner) sem corte
//   mensal compartilhado — cada compra vence exatamente 1 mês depois,
//   no mesmo dia. Nesse caso `date` já É a data de vencimento real (via
//   billingDate, calculado na criação do gasto — ver routes/expenses.js
//   e utils/installments.js), então o rótulo é só o mês dela direto,
//   sem aplicar nenhum corte por cima.
function periodLabelFor(date, paymentMethod, primaryCutoff = PRIMARY_CYCLE_DAY) {
  if (paymentMethod?.dueDateFollowsPurchase) {
    return monthKey(date);
  }
  const cutoffDay = paymentMethod?.dueDay || primaryCutoff;
  return monthKey(nextDueDate(date, cutoffDay));
}

// Rótulo de período de fatura de um Expense já carregado com
// `paymentMethod` — usa a data efetiva dele (billingDate se houver,
// senão a data da compra).
function invoicePeriodLabelForExpense(expense, primaryCutoff = PRIMARY_CYCLE_DAY) {
  return periodLabelFor(effectiveDate(expense), expense.paymentMethod, primaryCutoff);
}

// Um Expense conta pro período `monthParam` do Painel considerando o dia
// de corte do próprio cartão dele, não um corte único pra todo mundo.
function matchesInvoicePeriod(expense, monthParam, primaryCutoff = PRIMARY_CYCLE_DAY) {
  return invoicePeriodLabelForExpense(expense, primaryCutoff) === monthParam;
}

module.exports = {
  billingDateWhere,
  effectiveDate,
  periodLabelFor,
  invoicePeriodLabelForExpense,
  matchesInvoicePeriod,
};
