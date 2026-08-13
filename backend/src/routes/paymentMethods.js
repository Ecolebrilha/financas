const { simpleCrudRouter } = require('../utils/crudFactory');
const { PAYMENT_TYPES } = require('../constants');

module.exports = simpleCrudRouter('paymentMethod', {
  fields: ['name', 'type', 'dueDay', 'closingDay', 'color', 'sortOrder', 'creditLimit', 'usedLimit'],
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
    if (body.usedLimit !== undefined && body.usedLimit !== null && !Number.isFinite(Number(body.usedLimit))) {
      return 'usedLimit deve ser um número';
    }
    return null;
  },
});
