const { simpleCrudRouter } = require('../utils/crudFactory');

module.exports = simpleCrudRouter('person', {
  fields: ['name', 'color', 'sortOrder', 'isSelf'],
  requiredFields: ['name'],
});
