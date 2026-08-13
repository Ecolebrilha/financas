const express = require('express');
const prisma = require('../db');

// Router CRUD simples para entidades de apoio (Person, Category,
// PaymentMethod): listar (com filtro de ativos), criar, editar e
// "excluir" (soft delete via active=false, pra não quebrar histórico de
// gastos já lançados apontando pra essas entidades).
function simpleCrudRouter(modelName, { fields, requiredFields = ['name'], validate } = {}) {
  const router = express.Router();
  const model = prisma[modelName];

  router.get('/', async (req, res) => {
    const where = req.query.includeInactive === 'true' ? {} : { active: true };
    const items = await model.findMany({ where, orderBy: { sortOrder: 'asc' } });
    res.json(items);
  });

  router.post('/', async (req, res) => {
    for (const f of requiredFields) {
      if (!req.body[f]) return res.status(400).json({ error: `${f} é obrigatório` });
    }
    if (validate) {
      const error = validate(req.body);
      if (error) return res.status(400).json({ error });
    }
    const data = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (typeof data.name === 'string') data.name = data.name.trim();
    if (data.sortOrder === undefined) {
      data.sortOrder = await model.count();
    }
    const item = await model.create({ data });
    res.status(201).json(item);
  });

  router.put('/:id', async (req, res) => {
    if (validate) {
      const error = validate(req.body, { partial: true });
      if (error) return res.status(400).json({ error });
    }
    const data = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (typeof data.name === 'string') data.name = data.name.trim();
    if (req.body.active !== undefined) data.active = req.body.active;
    try {
      const item = await model.update({ where: { id: req.params.id }, data });
      res.json(item);
    } catch (e) {
      res.status(404).json({ error: 'Não encontrado' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const item = await model.update({ where: { id: req.params.id }, data: { active: false } });
      res.json(item);
    } catch (e) {
      res.status(404).json({ error: 'Não encontrado' });
    }
  });

  return router;
}

module.exports = { simpleCrudRouter };
