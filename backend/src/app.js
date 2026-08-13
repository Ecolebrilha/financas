const express = require('express');
const cors = require('cors');

const peopleRouter = require('./routes/people');
const categoriesRouter = require('./routes/categories');
const paymentMethodsRouter = require('./routes/paymentMethods');
const expensesRouter = require('./routes/expenses');
const incomesRouter = require('./routes/incomes');
const recurringRouter = require('./routes/recurring');
const recurringIncomesRouter = require('./routes/recurringIncomes');
const paymentsRouter = require('./routes/payments');
const summaryRouter = require('./routes/summary');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/people', peopleRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/incomes', incomesRouter);
app.use('/api/recurring', recurringRouter);
app.use('/api/recurring-incomes', recurringIncomesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/summary', summaryRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

module.exports = app;
