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
import { IncomeForm } from '../components/IncomesManager';
import ExpenseEditForm from '../components/ExpenseEditForm';
import { IconEdit, IconPlus, IconTrash } from '../components/icons';
import { currentPeriodLabel, formatCurrency, formatDate } from '../lib/format';
import { confirmGroupDateScope } from '../lib/installments';

export default function Dashboard() {
  const { paymentMethods, activePeople, reload: reloadAppData } = useAppData();
  const showToast = useToast();
  const [month, setMonth] = useState(currentPeriodLabel());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editar/excluir aqui mexe só no lançamento JÁ MATERIALIZADO deste mês
  // (o que você vê na tela) — não no template recorrente, já que o valor
  // de muita receita/gasto "fixo" varia de mês a mês (ex: "Salário
  // (restante)"), então editar aqui não deveria mudar o padrão dos
  // próximos meses. Pra mexer no template em si (dia do mês, valor
  // padrão etc), use Mais → Receitas/Gastos fixos.
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [creatingRecurringIncome, setCreatingRecurringIncome] = useState(false);
  const [creatingRecurringExpense, setCreatingRecurringExpense] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.summary
      .get(month)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // paymentMethods (usado em "Limites de crédito") vem do AppDataContext,
    // carregado só uma vez quando o app abre — sem isso, o usedLimit
    // mostrado aqui fica desatualizado assim que você lança/edita um
    // gasto em qualquer lugar (inclusive fora do Painel), até recarregar
    // a página inteira.
    reloadAppData();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [month]);

  const totalPending = summary
    ? summary.cardInvoices.reduce((s, c) => s + (c.totalPending || 0) + (c.priorPendingTotal || 0), 0)
    : 0;

  async function handleSaveIncome(data) {
    setSaving(true);
    try {
      await api.incomes.update(editingIncome.id, data);
      showToast('Receita atualizada!');
      setEditingIncome(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExpense(data) {
    const scope = confirmGroupDateScope(editingExpense, data);
    setSaving(true);
    try {
      await api.expenses.update(editingExpense.id, data, scope ? { scope } : undefined);
      showToast('Gasto atualizado!');
      setEditingExpense(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIncome(materialized) {
    if (!window.confirm(`Apagar "${materialized.description}" deste mês?`)) return;
    try {
      await api.incomes.remove(materialized.id);
      showToast('Receita apagada.');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleDeleteExpense(materialized) {
    if (!window.confirm(`Apagar "${materialized.description}" deste mês?`)) return;
    try {
      await api.expenses.remove(materialized.id);
      showToast('Gasto apagado.');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleCreateRecurringIncome(data) {
    setSaving(true);
    try {
      await api.recurringIncomes.create(data);
      showToast('Receita fixa cadastrada!');
      setCreatingRecurringIncome(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRecurringExpense(data) {
    setSaving(true);
    try {
      await api.recurring.create(data);
      showToast('Gasto fixo cadastrado!');
      setCreatingRecurringExpense(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
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
              incomeFromOthers={summary.totals.incomeFromOthers}
              balance={summary.totals.balance}
              isFuture={summary.totals.isFuture}
              projectedBalance={summary.totals.projectedBalance}
              carryOver={summary.totals.carryOver}
              incomesList={summary.incomes}
              expensesList={summary.expenses}
              owedByPerson={summary.owedByPerson}
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
            <InstallmentsList items={summary.openInstallments} onChanged={load} />
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingIncome(i)}
                        className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk"
                        aria-label="Editar receita fixa"
                      >
                        <IconEdit width={15} height={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteIncome(i)}
                        className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-critical"
                        aria-label="Excluir receita fixa"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </div>
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingExpense(e)}
                        className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk"
                        aria-label="Editar gasto fixo"
                      >
                        <IconEdit width={15} height={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e)}
                        className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-critical"
                        aria-label="Excluir gasto fixo"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {editingIncome && (
        <Modal title="Editar receita deste mês" onClose={() => setEditingIncome(null)}>
          <IncomeForm initial={editingIncome} onSubmit={handleSaveIncome} onCancel={() => setEditingIncome(null)} saving={saving} />
        </Modal>
      )}

      {editingExpense && (
        <Modal title="Editar gasto deste mês" onClose={() => setEditingExpense(null)}>
          <ExpenseEditForm expense={editingExpense} onSave={handleSaveExpense} onCancel={() => setEditingExpense(null)} saving={saving} />
        </Modal>
      )}

      {creatingRecurringIncome && (
        <Modal title="Nova receita fixa" onClose={() => setCreatingRecurringIncome(false)}>
          <RecurringIncomeForm
            onSubmit={handleCreateRecurringIncome}
            onCancel={() => setCreatingRecurringIncome(false)}
            saving={saving}
          />
        </Modal>
      )}

      {creatingRecurringExpense && (
        <Modal title="Novo gasto fixo" onClose={() => setCreatingRecurringExpense(false)}>
          <RecurringForm
            onSubmit={handleCreateRecurringExpense}
            onCancel={() => setCreatingRecurringExpense(false)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}
