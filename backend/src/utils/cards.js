const prisma = require('../db');
const { dueDateForPeriodLabel, PRIMARY_CYCLE_DAY, periodLabelForDate, invoicePeriodForMonthParam } = require('./dates');
const { round2 } = require('./aggregate');
const { effectiveDate, periodLabelFor } = require('./billing');

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
  // Mesma troca de creditLimit fixo pelo dinâmico (ver getDynamicCreditLimits)
  // feita em GET /payment-methods — precisa de novo aqui porque esta
  // função busca os cartões direto do banco, sem passar por lá.
  const dynamicLimits = await getDynamicCreditLimits(cards);

  const results = [];
  for (const card of cards) {
    const dueDay = card.dueDay || PRIMARY_CYCLE_DAY;
    const isCredit = card.type === 'CREDIT_CARD';

    const expenses = await prisma.expense.findMany({
      where: { paymentMethodId: card.id },
      include: { person: true },
      orderBy: { date: 'desc' },
    });

    const matching = [];
    let priorPendingTotal = 0;
    for (const e of expenses) {
      const label = periodLabelFor(effectiveDate(e), card);
      if (label === monthParam) {
        matching.push(e);
      } else if (isCredit && label < monthParam && !e.settledAt) {
        priorPendingTotal += e.amount;
      }
    }
    const total = matching.reduce((s, e) => s + e.amount, 0);

    // Cartões com vencimento fixo (a maioria): o "vence" do período é
    // sempre o mesmo dia pra todo mundo. Cartões com
    // dueDateFollowsPurchase (ex: Renner) não têm esse corte único —
    // cada compra vence num dia diferente, então mostra a MAIS PRÓXIMA
    // entre as compras do período (a mais urgente: é a que precisa ser
    // paga primeiro, então é ela quem deve guiar o alarme/contagem de
    // dias, não a última do lote).
    const due = card.dueDateFollowsPurchase
      ? matching.length > 0
        ? new Date(Math.min(...matching.map((e) => effectiveDate(e).getTime())))
        : dueDateForPeriodLabel(monthParam, dueDay)
      : dueDateForPeriodLabel(monthParam, dueDay);

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

    const effectiveCard = dynamicLimits.has(card.id) ? { ...card, creditLimit: dynamicLimits.get(card.id) } : card;

    results.push({
      paymentMethod: effectiveCard,
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

// Uma parcela "de verdade" (compra parcelada) — essas sempre travam o
// limite com antecedência, são compromisso firmado.
function isRealInstallment(e) {
  return !!e.installmentTotal && e.installmentTotal > 1;
}

// Entre os lançamentos de fatura FUTURA (ainda não é a que está em
// aberto), decide quais realmente "travam" o limite com antecedência:
// - parcela de verdade: sempre conta, é compromisso firmado;
// - avulso sem template recorrente: sempre conta — só existe numa
//   fatura futura porque alguém decidiu isso explicitamente (fatura
//   prevista manual), nunca por efeito colateral de navegação;
// - gasto fixo recorrente (recurringTemplateId): só a ocorrência mais
//   próxima conta. O Painel materializa o mês sendo visto com
//   antecedência pra já mostrar a projeção — navegar vários meses pra
//   frente acaba pré-gerando a mesma assinatura várias vezes (ex: 6
//   meses de "Netflix" de uma vez), e cada uma dessas não é um
//   compromisso novo, é a MESMA assinatura — só a próxima cobrança real
//   deveria pesar no limite agora.
function filterFutureEntries(entries) {
  const nearestByTemplate = new Map();
  for (const { expense: e, periodLabel } of entries) {
    if (!e.recurringTemplateId) continue;
    const current = nearestByTemplate.get(e.recurringTemplateId);
    if (!current || periodLabel < current.periodLabel) {
      nearestByTemplate.set(e.recurringTemplateId, { periodLabel, id: e.id });
    }
  }
  return entries.filter(({ expense: e }) => {
    if (isRealInstallment(e)) return true;
    if (!e.recurringTemplateId) return true;
    return nearestByTemplate.get(e.recurringTemplateId)?.id === e.id;
  });
}

// Quanto do limite de cada cartão está ocupado AGORA, calculado a partir
// dos próprios lançamentos em vez de mantido manualmente: soma a fatura
// do período atual (ainda em aberto, nem venceu) inteira, mais o que já
// é compromisso firmado em faturas futuras (ver filterFutureEntries).
// Não entra fatura já vencida: a premissa do app é que ela já foi paga
// com a receita do mês, liberando o limite de novo (não usa settledAt
// pra essa conta — aquele campo é sobre a pessoa ter te pago de volta,
// não sobre você ter pago o banco).
async function getUsedCreditLimits(cards) {
  const cardIds = cards.map((c) => c.id);
  if (cardIds.length === 0) return new Map();
  // "Hoje" aqui também é o período de fatura (dia 11 a dia 10) em que a
  // data atual cai, não o mês civil — mesma correção aplicada no Painel.
  const today = periodLabelForDate(new Date());
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const expenses = await prisma.expense.findMany({ where: { paymentMethodId: { in: cardIds } } });

  const used = new Map(cardIds.map((id) => [id, 0]));
  for (const id of cardIds) {
    const card = cardsById.get(id);
    const own = expenses
      .filter((e) => e.paymentMethodId === id)
      .map((e) => ({ expense: e, periodLabel: periodLabelFor(effectiveDate(e), card) }));
    const current = own.filter(({ periodLabel }) => periodLabel === today);
    const future = filterFutureEntries(own.filter(({ periodLabel }) => periodLabel > today));
    const total = [...current, ...future].reduce((s, { expense: e }) => s + e.amount, 0);
    used.set(id, round2(total));
  }
  return used;
}

// Mesma regra de getUsedCreditLimits, mas devolve a lista item a item em
// vez de só o total — usado pra mostrar "o que está prendendo esse
// limite" quando a pessoa toca no cartão em Limites de crédito.
async function getUsedLimitDetail(cardId) {
  const card = await prisma.paymentMethod.findUnique({ where: { id: cardId } });
  if (!card) return null;
  const today = periodLabelForDate(new Date());
  const expenses = await prisma.expense.findMany({
    where: { paymentMethodId: cardId },
    include: { person: true },
    orderBy: { date: 'asc' },
  });

  const entries = expenses.map((e) => ({ expense: e, periodLabel: periodLabelFor(effectiveDate(e), card) }));
  const current = entries.filter(({ periodLabel }) => periodLabel === today);
  const future = filterFutureEntries(entries.filter(({ periodLabel }) => periodLabel > today));

  const items = [...current, ...future]
    .map(({ expense: e, periodLabel }) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      date: e.date,
      person: e.person,
      periodLabel,
      installmentNumber: e.installmentNumber,
      installmentTotal: e.installmentTotal,
      // Resto só pra permitir editar/apagar o lançamento direto desta
      // tela (ver ExpenseEditForm) sem precisar buscar de novo.
      personId: e.personId,
      paymentMethodId: e.paymentMethodId,
      categoryId: e.categoryId,
      notes: e.notes,
      billingDate: e.billingDate,
      installmentGroupId: e.installmentGroupId,
    }))
    .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel) || new Date(a.date) - new Date(b.date));

  return {
    paymentMethod: card,
    items,
    total: round2(items.reduce((s, i) => s + i.amount, 0)),
  };
}

// Pra cartões com creditLimitIncomeType preenchido (ex: Flash/VA-VR
// ligado à receita fixa "Benefício"), o limite efetivo não é o
// creditLimit fixo cadastrado — é quanto essa receita realmente
// depositou no período atual (pode variar mês a mês, ex: sobra do mês
// anterior somada). Devolve só os cartões que têm essa ligação; quem não
// tem fica de fora do Map (o chamador usa o creditLimit fixo como
// fallback).
async function getDynamicCreditLimits(cards) {
  const linked = cards.filter((c) => c.creditLimitIncomeType);
  if (linked.length === 0) return new Map();
  const today = periodLabelForDate(new Date());
  const { start, end } = invoicePeriodForMonthParam(today);
  const types = [...new Set(linked.map((c) => c.creditLimitIncomeType))];
  const incomes = await prisma.income.findMany({ where: { type: { in: types }, date: { gte: start, lt: end } } });

  const sumByType = new Map();
  for (const i of incomes) sumByType.set(i.type, (sumByType.get(i.type) || 0) + i.amount);

  const result = new Map();
  for (const c of linked) {
    const total = sumByType.get(c.creditLimitIncomeType);
    if (total !== undefined) result.set(c.id, round2(total));
  }
  return result;
}

module.exports = { getCardInvoices, getUsedCreditLimits, getUsedLimitDetail, getDynamicCreditLimits };
