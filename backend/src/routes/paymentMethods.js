const express = require('express');
const prisma = require('../db');
const { simpleCrudRouter } = require('../utils/crudFactory');
const { getUsedCreditLimits } = require('../utils/cards');
const { PAYMENT_TYPES } = require('../constants');

const router = express.Router();

// O "usado" de um cartão de crédito agora é sempre calculado a partir
// dos lançamentos (ver getUsedCreditLimits) em vez de guardado no banco
// — essa rota intercepta o GET genérico do CRUD só pra sobrescrever
// usedLimit com o valor computado antes de responder. O campo no banco
// (preenchido no schema por compatibilidade) deixa de ser lido.
router.get('/', async (req, res) => {
  const where = req.query.includeInactive === 'true' ? {} : { active: true };
  const items = await prisma.paymentMethod.findMany({ where, orderBy: { sortOrder: 'asc' } });
  const creditCards = items.filter((pm) => pm.type === 'CREDIT_CARD');
  const usedByCard = await getUsedCreditLimits(creditCards);
  const withUsedLimit = items.map((pm) =>
    pm.type === 'CREDIT_CARD' ? { ...pm, usedLimit: usedByCard.get(pm.id) ?? 0 } : pm,
  );
  res.json(withUsedLimit);
});

router.use(
  simpleCrudRouter('paymentMethod', {
    fields: ['name', 'type', 'dueDay', 'closingDay', 'color', 'sortOrder', 'creditLimit', 'dueDateFollowsPurchase'],
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
      return null;
    },
  }),
);

module.exports = router;
