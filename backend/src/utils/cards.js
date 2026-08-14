const prisma = require('../db');
const { periodLabelForDate, dueDateForPeriodLabel, PRIMARY_CYCLE_DAY } = require('./dates');
const { round2 } = require('./aggregate');
const { effectiveDate } = require('./billing');

// Para cada cartão de crédito ativo (e também Pix/Flash, que não têm
// fatura de verdade mas funcionam do mesmo jeito pra fins de "quem deve
// quanto"), calcula o vencimento e a lista de compras do período
// selecionado no Painel (monthParam) — com a lista individual de cada
// pessoa (settledAt marca se aquela compra específica já foi quitada).
// Pix/Flash não têm dia de vencimento cadastrado, então usam o ciclo
// padrão da casa (dia 10) só pra agrupar no mesmo período que os outros
// cartões.
//
// Além das compras do próprio período, soma à parte (sem misturar) o
// quanto ainda está pendente de faturas ANTERIORES a esse período — pra
// não fazer uma dívida antiga sumir só porque você navegou pro mês
// seguinte, mas também sem inflar o total do período atual com ela.
async function getCardInvoices(monthParam) {
  const cards = await prisma.paymentMethod.findMany({
    where: { type: { in: ['CREDIT_CARD', 'PIX', 'VOUCHER'] }, active: true },
    orderBy: { sortOrder: 'asc' },
  });

  const results = [];
  for (const card of cards) {
    const dueDay = card.dueDay || PRIMARY_CYCLE_DAY;
    const due = dueDateForPeriodLabel(monthParam, dueDay);
    const isCredit = card.type === 'CREDIT_CARD';

    const expenses = await prisma.expense.findMany({
      where: { paymentMethodId: card.id },
      include: { person: true },
      orderBy: { date: 'desc' },
    });

    const matching = [];
    let priorPendingTotal = 0;
    for (const e of expenses) {
      const label = periodLabelForDate(effectiveDate(e), dueDay);
      if (label === monthParam) {
        matching.push(e);
      } else if (isCredit && label < monthParam && !e.settledAt) {
        priorPendingTotal += e.amount;
      }
    }
    const total = matching.reduce((s, e) => s + e.amount, 0);

    const byPersonMap = new Map();
    for (const e of matching) {
      const key = e.person.id;
      if (!byPersonMap.has(key)) byPersonMap.set(key, { person: e.person, items: [], spent: 0, settled: 0 });
      const bucket = byPersonMap.get(key);
      bucket.items.push({
        id: e.id,
        description: e.description,
        date: e.date,
        amount: e.amount,
        settledAt: e.settledAt,
        personId: e.personId,
        paymentMethodId: e.paymentMethodId,
        categoryId: e.categoryId,
        notes: e.notes,
        billingDate: e.billingDate,
        installmentNumber: e.installmentNumber,
        installmentTotal: e.installmentTotal,
        installmentGroupId: e.installmentGroupId,
      });
      bucket.spent += e.amount;
      if (e.settledAt) bucket.settled += e.amount;
    }

    const byPerson = Array.from(byPersonMap.values())
      .map(({ person, items, spent, settled }) => ({
        person,
        items,
        spent: round2(spent),
        settled: round2(settled),
        pending: round2(Math.max(spent - settled, 0)),
      }))
      .sort((a, b) => b.pending - a.pending);

    results.push({
      paymentMethod: card,
      nextDueDate: due,
      openInvoiceTotal: round2(total),
      itemCount: matching.length,
      totalPending: round2(byPerson.reduce((s, p) => s + p.pending, 0)),
      priorPendingTotal: round2(priorPendingTotal),
      byPerson,
    });
  }
  return results;
}

module.exports = { getCardInvoices };
