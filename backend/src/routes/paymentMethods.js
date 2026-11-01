const express = require('express');
const prisma = require('../db');
const { simpleCrudRouter } = require('../utils/crudFactory');
const { getUsedCreditLimits, getUsedLimitDetail, getDynamicCreditLimits } = require('../utils/cards');
const { PAYMENT_TYPES, INCOME_TYPES } = require('../constants');

const router = express.Router();

// O "usado" de um cartão de crédito agora é sempre calculado a partir
// dos lançamentos (ver getUsedCreditLimits) em vez de guardado no banco
// — essa rota intercepta o GET genérico do CRUD só pra sobrescrever
// usedLimit com o valor computado antes de responder. O campo no banco
// (preenchido no schema por compatibilidade) deixa de ser lido.
router.get('/', async (req, res) => {
  const where = req.query.includeInactive === 'true' ? {} : { active: true };
  const items = await prisma.paymentMethod.findMany({ where, orderBy: { sortOrder: 'asc' } });
  // Qualquer método com limite cadastrado entra nessa conta, não só
  // cartão de crédito — o Flash (VA/VR) também tem limite e aparece em
  // "Limites de crédito" junto com os cartões.
  const cardsWithLimit = items.filter((pm) => pm.creditLimit != null);
  const usedByCard = await getUsedCreditLimits(cardsWithLimit);
  // Pra cartão ligado a uma receita fixa (ver creditLimitIncomeType), o
  // limite "de verdade" não é o creditLimit fixo cadastrado — é quanto
  // essa receita depositou no período atual. effectiveCreditLimit é esse
  // valor (com o creditLimit fixo como fallback); creditLimit em si
  // continua intacto, é o que aparece pra editar em Mais → Cartões.
  const dynamicByCard = await getDynamicCreditLimits(cardsWithLimit);
  const withUsedLimit = items.map((pm) =>
    pm.creditLimit != null
      ? { ...pm, usedLimit: usedByCard.get(pm.id) ?? 0, effectiveCreditLimit: dynamicByCard.get(pm.id) ?? pm.creditLimit }
      : pm,
  );
  res.json(withUsedLimit);
});

// Listagem item a item do que está contando no "usado" desse cartão
// (ver getUsedLimitDetail) — pra mostrar em "Limites de crédito" quando
// a pessoa toca num cartão pra entender de onde vem aquele número.
router.get('/:id/used-limit-detail', async (req, res) => {
  const detail = await getUsedLimitDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Cartão não encontrado' });
  res.json(detail);
});

router.use(
  simpleCrudRouter('paymentMethod', {
    fields: [
      'name',
      'type',
      'dueDay',
      'closingDay',
      'color',
      'sortOrder',
      'creditLimit',
      'creditLimitIncomeType',
      'limitMonthlyDeduction',
      'dueDateFollowsPurchase',
    ],
    requiredFields: ['name', 'type'],
    validate: (body, { partial } = {}) => {
      if (body.type !== undefined && !PAYMENT_TYPES.includes(body.type)) {
        return `type deve ser um de: ${PAYMENT_TYPES.join(', ')}`;
      }
      if (!partial && body.type === undefined) return null;
      if (body.dueDay !== undefined && body.dueDay !== null) {
        const d = Number(body.dueDay);
        if (!Number.isInteger(d) || d < 1 || d > 31) return 'dueDay deve ser um dia entre 1 e 31';
      }
      if (body.creditLimit !== undefined && body.creditLimit !== null && !Number.isFinite(Number(body.creditLimit))) {
        return 'creditLimit deve ser um número';
      }
      if (body.creditLimitIncomeType !== undefined && body.creditLimitIncomeType !== null && body.creditLimitIncomeType !== '') {
        if (!INCOME_TYPES.includes(body.creditLimitIncomeType)) {
          return `creditLimitIncomeType deve ser um de: ${INCOME_TYPES.join(', ')}`;
        }
      }
      if (
        body.limitMonthlyDeduction !== undefined &&
        body.limitMonthlyDeduction !== null &&
        !Number.isFinite(Number(body.limitMonthlyDeduction))
      ) {
        return 'limitMonthlyDeduction deve ser um número';
      }
      return null;
    },
  }),
);

module.exports = router;
