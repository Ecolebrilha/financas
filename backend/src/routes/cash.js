const express = require('express');
const prisma = require('../db');
const { round2 } = require('../utils/aggregate');
const { getCashOverview } = require('../utils/cashFlow');

const router = express.Router();

// Tela Caixa: em vez do saldo do mês por competência (Painel), mostra o
// DINHEIRO de verdade — ver getCashOverview.
router.get('/', async (req, res) => {
  res.json(await getCashOverview());
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
