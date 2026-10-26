import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import PeriodPicker from '../components/PeriodPicker';
import MonthOverview from '../components/MonthOverview';
import CardWithdrawalAdvice from '../components/CardWithdrawalAdvice';
import PersonBreakdown from '../components/PersonBreakdown';
import BarListChart from '../components/BarListChart';
import CardDueList from '../components/CardDueList';
import InstallmentsList from '../components/InstallmentsList';
import CreditLimits from '../components/CreditLimits';
import Modal from '../components/Modal';
import { RecurringForm } from '../components/RecurringManager';
import { RecurringIncomeForm } from '../components/RecurringIncomeManager';
import { IconEdit, IconPlus } from '../components/icons';
import { currentPeriodLabel, formatCurrency, formatDate } from '../lib/format';

export default function Dashboard() {
  const { paymentMethods, activePeople } = useAppData();
  const showToast = useToast();
  const [month, setMonth] = useState(currentPeriodLabel());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editar aqui no Painel mexe sempre no TEMPLATE recorrente (não só no
  // lançamento já materializado deste mês) — é o mesmo dado de Mais →
  // Receitas/Gastos fixos, só que sem precisar sair daqui. Como o item
  // materializado só carrega o id do template, busca a lista completa
  // (pequena) e pega o registro certo antes de abrir o form.
  const [editingRecurringIncome, setEditingRecurringIncome] = useState(null);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState(null);
  const [creatingRecurringIncome, setCreatingRecurringIncome] = useState(false);
  const [creatingRecurringExpense, setCreatingRecurringExpense] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);

  function load() {
    setLoading(true);
    api.summary
      .get(month)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [month]);

  const totalPending = summary
    ? summary.cardInvoices.reduce((s, c) => s + (c.totalPending || 0) + (c.priorPendingTotal || 0), 0)
    : 0;

  async function openEditRecurringIncome(materialized) {
    try {
      const all = await api.recurringIncomes.list({ includeInactive: true });
      const template = all.find((t) => t.id === materialized.recurringIncomeId);
      if (!template) return showToast('Não achei o template dessa receita fixa.', 'error');
      setEditingRecurringIncome(template);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function openEditRecurringExpense(materialized) {
    try {
      const all = await api.recurring.list({ includeInactive: true });
      const template = all.find((t) => t.id === materialized.recurringTemplateId);
      if (!template) return showToast('Não achei o template desse gasto fixo.', 'error');
      setEditingRecurringExpense(template);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleSaveRecurringIncome(data) {
    setSavingRecurring(true);
    try {
      if (editingRecurringIncome) {
        await api.recurringIncomes.update(editingRecurringIncome.id, data);
      } else {
        await api.recurringIncomes.create(data);
      }
      showToast('Receita fixa salva!');
      setEditingRecurringIncome(null);
      setCreatingRecurringIncome(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSavingRecurring(false);
    }
  }

  async function handleSaveRecurringExpense(data) {
    setSavingRecurring(true);
    try {
      if (editingRecurringExpense) {
        await api.recurring.update(editingRecurringExpense.id, data);
      } else {
        await api.recurring.create(data);
      }
      showToast('Gasto fixo salvo!');
      setEditingRecurringExpense(null);
      setCreatingRecurringExpense(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSavingRecurring(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Painel mensal</h1>
      <PeriodPicker month={month} onChange={setMonth} period={summary?.period} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !summary && <p className="text-muted text-center py-10">Carregando…</p>}

      {summary && (
        <>
          <Card>
            <MonthOverview
              expenses={summary.totals.expenses}
              expensesImmediate={summary.totals.expensesImmediate}
              expensesCard={summary.totals.expensesCard}
              householdExpenses={summary.totals.householdExpenses}
              income={summary.totals.income}
              incomeRegular={summary.totals.incomeRegular}
              incomePayments={summary.totals.incomePayments}
              balance={summary.totals.balance}
              isFuture={summary.totals.isFuture}
              projectedBalance={summary.totals.projectedBalance}
              carryOver={summary.totals.carryOver}
            />
            <CardWithdrawalAdvice data={summary.cardWithdrawal} />
          </Card>

          <Card
            title="Gasto por pessoa"
            action={
              <Link to="/extrato" className="text-xs font-medium" style={{ color: '#2a78d6' }}>
                Ver extrato →
              </Link>
            }
          >
            <PersonBreakdown
              data={summary.byPerson}
              expenses={summary.expenses}
              payments={summary.payments}
              period={summary.period}
              onChanged={load}
            />
          </Card>

          <Card
            title="Vencimento dos cartões"
            action={
              totalPending > 0 && (
                <span className="text-xs font-medium" style={{ color: '#d03b3b' }}>
                  {formatCurrency(totalPending)} pendente
                </span>
              )
            }
          >
            <p className="text-xs text-muted -mt-2 mb-1">
              Mostra as compras do período selecionado acima. Se ainda sobrar algo pendente de fatura(s) anteriores,
              aparece à parte, sem misturar com o total do período. Escolha a pessoa e toque num cartão pra ver (e quitar,
              no caso dos cartões de crédito) as compras dela.
            </p>
            <CardDueList cardInvoices={summary.cardInvoices} people={activePeople} onSettled={load} />
          </Card>

          <Card title="Limites de crédito">
            <p className="text-xs text-muted -mt-2 mb-2">
              Calculado automaticamente: fatura atual em aberto + parcelas futuras já lançadas de cada cartão.
            </p>
            <CreditLimits paymentMethods={paymentMethods} />
          </Card>

          <Card title="Gasto por método de pagamento">
            <BarListChart data={summary.byPaymentMethod} />
          </Card>

          <Card title="Gasto por categoria">
            <BarListChart data={summary.byCategory} />
          </Card>

          <Card title="Parcelas em aberto">
            <p className="text-xs text-muted -mt-2 mb-1">Todas as parcelas futuras, de qualquer mês.</p>
            <InstallmentsList items={summary.openInstallments} />
          </Card>

          <Card
            title="Receitas fixas do mês"
            action={
              <button
                type="button"
                onClick={() => setCreatingRecurringIncome(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600"
              >
                <IconPlus width={14} height={14} /> Nova
              </button>
            }
          >
            {summary.recurringIncomes.length === 0 ? (
              <p className="text-sm text-muted py-2">Nenhuma receita fixa lançada neste mês.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {summary.recurringIncomes.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.description}</p>
                      <p className="text-xs text-muted">
                        {i.person ? `${i.person.name} · ` : ''}
                        {formatDate(i.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#0ca30c' }}>
                      {formatCurrency(i.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditRecurringIncome(i)}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk shrink-0"
                      aria-label="Editar receita fixa"
                    >
                      <IconEdit width={15} height={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Gastos fixos do mês"
            action={
              <button
                type="button"
                onClick={() => setCreatingRecurringExpense(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600"
              >
                <IconPlus width={14} height={14} /> Novo
              </button>
            }
          >
            {summary.recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted py-2">Nenhum gasto fixo lançado neste mês.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {summary.recurringExpenses.map((e) => (
                  <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted">
                        {e.person.name} · {e.paymentMethod.name} · {formatDate(e.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
                    <button
                      type="button"
                      onClick={() => openEditRecurringExpense(e)}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk shrink-0"
                      aria-label="Editar gasto fixo"
                    >
                      <IconEdit width={15} height={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {(editingRecurringIncome || creatingRecurringIncome) && (
        <Modal
          title={editingRecurringIncome ? 'Editar receita fixa' : 'Nova receita fixa'}
          onClose={() => {
            setEditingRecurringIncome(null);
            setCreatingRecurringIncome(false);
          }}
        >
          <RecurringIncomeForm
            initial={editingRecurringIncome}
            onSubmit={handleSaveRecurringIncome}
            onCancel={() => {
              setEditingRecurringIncome(null);
              setCreatingRecurringIncome(false);
            }}
            saving={savingRecurring}
          />
        </Modal>
      )}

      {(editingRecurringExpense || creatingRecurringExpense) && (
        <Modal
          title={editingRecurringExpense ? 'Editar gasto fixo' : 'Novo gasto fixo'}
          onClose={() => {
            setEditingRecurringExpense(null);
            setCreatingRecurringExpense(false);
          }}
        >
          <RecurringForm
            initial={editingRecurringExpense}
            onSubmit={handleSaveRecurringExpense}
            onCancel={() => {
              setEditingRecurringExpense(null);
              setCreatingRecurringExpense(false);
            }}
            saving={savingRecurring}
          />
        </Modal>
      )}
    </div>
  );
}
