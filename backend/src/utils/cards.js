const prisma = require('../db');
const { nextDueDate, invoiceDueDateForExpense, PRIMARY_CYCLE_DAY } = require('./dates');
const { round2 } = require('./aggregate');
const { effectiveDate } = require('./billing');

// Para cada cartão de crédito ativo (e também Pix/Flash, que não têm
// fatura de verdade mas funcionam do mesmo jeito pra fins de "quem deve
// quanto"), calcula o vencimento e quanto está pendente — com a lista de
// compras individuais de cada um (settledAt marca se aquela compra
// específica já foi quitada), pra saber exatamente o que cobrar de cada
// um. Pix/Flash não têm dia de vencimento cadastrado, então usam o ciclo
// padrão da casa (dia 10) só pra agrupar no mesmo período que os outros
// cartões.
//
// A fatura mostrada é a mais antiga que ainda tem algo pendente — não
// necessariamente a próxima a vencer. Sem isso, assim que a data de
// vencimento passasse o app pularia direto pra fatura seguinte e as
// compras ainda não quitadas simplesmente sumiriam da lista.
async function getCardInvoices(referenceDate = new Date()) {
  const cards = await prisma.paymentMethod.findMany({
    where: { type: { in: ['CREDIT_CARD', 'PIX', 'VOUCHER'] }, active: true },
    orderBy: { sortOrder: 'asc' },
  });

  const results = [];
  for (const card of cards) {
    const dueDay = card.dueDay || PRIMARY_CYCLE_DAY;
    const upcoming = nextDueDate(referenceDate, dueDay);

    const expenses = await prisma.expense.findMany({
      where: { paymentMethodId: card.id },
      include: { person: true },
      orderBy: { date: 'desc' },
    });

    const byDue = new Map();
    for (const e of expenses) {
      const dueDate = invoiceDueDateForExpense(effectiveDate(e), dueDay);
      const key = dueDate.getTime();
      if (!byDue.has(key)) byDue.set(key, { due: dueDate, items: [] });
      byDue.get(key).items.push(e);
    }

    const openGroups = Array.from(byDue.values())
      .filter((g) => g.due <= upcoming && g.items.some((e) => !e.settledAt))
      .sort((a, b) => a.due - b.due);

    const due = openGroups.length > 0 ? openGroups[0].due : upcoming;
    const matching = openGroups.length > 0 ? openGroups[0].items : byDue.get(upcoming.getTime())?.items || [];
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
      byPerson,
    });
  }
  return results;
}

module.exports = { getCardInvoices };
