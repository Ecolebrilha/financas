const { simpleCrudRouter } = require('../utils/crudFactory');

module.exports = simpleCrudRouter('category', {
  fields: ['name', 'color', 'icon', 'sortOrder'],
  requiredFields: ['name'],
});
