const express = require('express');
const prisma = require('../db');
const { periodLabelForDate } = require('../utils/dates');
const { round2, sum } = require('../utils/aggregate');
const { getCardInvoices } = require('../utils/cards');
const { getPeriodData, buildWithdrawalAdvice } = require('../utils/periodData');

const router = express.Router();

// Só Pix/Débito faz sentido "ainda não paguei" — cartão já vira fatura (e
// entra em "vai sair") e Flash já saiu do saldo dele na hora.
const CASH_PENDING_TYPES = ['PIX', 'DEBIT_CARD'];

// Tela Caixa: em vez do saldo do mês por competência (Painel), mostra o
// DINHEIRO de verdade — quanto tem agora (conta informada por você +
// Flash sacável), quanto precisa ficar separado pra pagar por fora, o que
// ainda vai entrar e o que ainda vai sair até o fim do período, e no fim
// quanto sobra ou falta (com a sugestão de saque quando falta).
router.get('/', async (req, res) => {
  const now = new Date();
  const todayKey = periodLabelForDate(now);

  const [data, position, unpaidRows, cardInvoices] = await Promise.all([
    getPeriodData(todayKey),
    prisma.cashPosition.findUnique({ where: { id: 'main' } }),
    prisma.expense.findMany({
      where: { unpaid: true, person: { isSelf: true }, paymentMethod: { type: { in: CASH_PENDING_TYPES } } },
      include: { paymentMethod: true },
      orderBy: { date: 'asc' },
    }),
    getCardInvoices(todayKey),
  ]);

  const accountBalance = round2(position?.accountBalance ?? 0);

  // Saldo sacável do Flash (e de qualquer cartão ligado a uma receita
  // fixa): já é líquido da taxa de saque em 1x — ver getPeriodData.
  const flashCards = data.linkedCardDetails;
  const flashNet = round2(sum(flashCards, 'netWithdrawable'));

  const separateItems = unpaidRows.map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    date: e.date,
    paymentMethod: { id: e.paymentMethod.id, name: e.paymentMethod.name },
  }));
  const separateTotal = round2(sum(separateItems, 'amount'));

  // Só entra o que AINDA vai cair (data depois de agora) — o que já caiu
  // está dentro do saldo em conta que você informou. Receita ligada a
  // cartão (Flash) fica de fora porque já entra como saldo sacável acima.
  const linkedTypes = new Set(flashCards.map((c) => c.incomeType));
  const upcomingIncomes = data.incomes
    .filter((i) => new Date(i.date) > now && !linkedTypes.has(i.type))
    .map((i) => ({
      id: i.id,
      description: i.description,
      date: i.date,
      amount: i.amount,
      person: i.person ? { id: i.person.id, name: i.person.name } : null,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingIncomesTotal = round2(sum(upcomingIncomes, 'amount'));

  // O que os outros ainda vão te mandar (Pix/Flash do período) — desconta
  // o que já abateram (abatimento já recebido), por segurança: contar a
  // dívida cheia de novo superestimaria o que vai entrar.
  const people = data.owedByPerson.map((p) => {
    const owed = round2(p.total);
    const received = round2(
      sum(
        data.payments.filter((pay) => pay.personId === p.id && new Date(pay.date) <= now),
        'amount',
      ),
    );
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      owed,
      received,
      pending: Math.max(round2(owed - received), 0),
    };
  });
  const othersPending = round2(sum(people, 'pending'));

  // Sai: só a SUA parte de cada fatura de cartão de crédito (a parte dos
  // outros nos cartões não entra na sua conta — mesma regra do Painel).
  const cards = cardInvoices
    .filter((c) => c.paymentMethod.type === 'CREDIT_CARD')
    .map((c) => {
      const own = round2(c.byPerson.find((b) => b.person.isSelf)?.spent ?? 0);
      return {
        id: c.paymentMethod.id,
        name: c.paymentMethod.name,
        dueDate: c.nextDueDate,
        own,
        invoiceTotal: c.openInvoiceTotal,
      };
    })
    .filter((c) => c.invoiceTotal > 0)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  // Gasto "de cartão" seu que não está em nenhuma fatura de cartão de
  // crédito (ex: "Não especificado") — ainda conta como saída.
  const cardsOther = Math.max(round2(data.selfExpensesCard - sum(cards, 'own')), 0);
  const outgoingTotal = round2(data.selfExpensesCard);

  const readyNow = round2(accountBalance + flashNet);
  const freeAfterSeparating = round2(readyNow - separateTotal);
  const finalWithOthers = round2(freeAfterSeparating + upcomingIncomesTotal + othersPending - outgoingTotal);
  const finalWithoutOthers = round2(finalWithOthers - othersPending);

  const withdrawal = finalWithOthers < 0 ? await buildWithdrawalAdvice(round2(-finalWithOthers), todayKey) : null;

  res.json({
    now,
    period: { label: todayKey, start: data.start, end: new Date(data.end.getTime() - 1) },
    account: { balance: accountBalance, updatedAt: position?.updatedAt ?? null },
    flash: { cards: flashCards, netWithdrawable: flashNet },
    separate: { items: separateItems, total: separateTotal },
    incoming: {
      incomes: upcomingIncomes,
      incomesTotal: upcomingIncomesTotal,
      others: { people, pending: othersPending, owed: round2(sum(people, 'owed')), received: round2(sum(people, 'received')) },
    },
    outgoing: { cards, other: cardsOther, total: outgoingTotal },
    result: { readyNow, freeAfterSeparating, finalWithOthers, finalWithoutOthers },
    withdrawal,
  });
});

router.put('/balance', async (req, res) => {
  const amount = Number(req.body.amount);
  if (req.body.amount === '' || req.body.amount === null || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'amount deve ser um número' });
  }
  const position = await prisma.cashPosition.upsert({
    where: { id: 'main' },
    update: { accountBalance: round2(amount) },
    create: { id: 'main', accountBalance: round2(amount) },
  });
  res.json(position);
});

module.exports = router;
