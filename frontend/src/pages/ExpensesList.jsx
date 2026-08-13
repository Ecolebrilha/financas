import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import MonthPicker from '../components/MonthPicker';
import Modal from '../components/Modal';
import ExpenseEditForm from '../components/ExpenseEditForm';
import { SelectField, TextField, SegmentedControl } from '../components/fields';
import { IconEdit, IconTrash } from '../components/icons';
import { currentMonthKey, formatCurrency, formatDate } from '../lib/format';
import { STATUS } from '../lib/colors';

const PERIOD_MODES = [
  { value: 'month', label: 'Mês' },
  { value: 'range', label: 'Período' },
];

export default function ExpensesList() {
  const { activePeople, activeCategories, activePaymentMethods } = useAppData();
  const showToast = useToast();

  const [periodMode, setPeriodMode] = useState('month');
  const [month, setMonth] = useState(currentMonthKey());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [personId, setPersonId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    const params = { personId, paymentMethodId, categoryId, search };
    if (periodMode === 'month') params.month = month;
    else {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    api.expenses
      .list(params)
      .then(setExpenses)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [periodMode, month, from, to, personId, paymentMethodId, categoryId, search]);

  async function handleSave(data) {
    setSaving(true);
    try {
      await api.expenses.update(editing.id, data);
      showToast('Gasto atualizado!');
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense) {
    let scope;
    if (expense.installmentGroupId) {
      const deleteAll = window.confirm(
        'Esse gasto faz parte de um parcelamento.\n\nOK = apagar esta parcela e todas as futuras dela\nCancelar = apagar só esta parcela',
      );
      scope = deleteAll ? 'group' : undefined;
    } else if (!window.confirm(`Apagar "${expense.description}"?`)) {
      return;
    }
    try {
      await api.expenses.remove(expense.id, scope ? { scope } : undefined);
      showToast('Gasto apagado.');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Gastos</h1>

      <Card>
        <div className="space-y-3">
          <SegmentedControl options={PERIOD_MODES} value={periodMode} onChange={setPeriodMode} />
          {periodMode === 'month' ? (
            <MonthPicker month={month} onChange={setMonth} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <TextField label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}

          <TextField label="Buscar" placeholder="Descrição contém…" value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="grid grid-cols-1 gap-3">
            <SelectField label="Pessoa" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Todas</option>
              {activePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Método de pagamento" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
              <option value="">Todos</option>
              {activePaymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted">{expenses.length} lançamento(s)</span>
        <span className="text-sm font-semibold">{formatCurrency(total)}</span>
      </div>

      {loading ? (
        <p className="text-muted text-center py-10">Carregando…</p>
      ) : expenses.length === 0 ? (
        <p className="text-muted text-center py-10">Nenhum gasto encontrado com esses filtros.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li key={e.id} className="bg-surface dark:bg-surfacedk rounded-2xl border border-black/5 dark:border-white/10 p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {e.description}
                  {e.installmentTotal && (
                    <span className="ml-1.5 text-xs text-muted">
                      ({e.installmentNumber}/{e.installmentTotal})
                    </span>
                  )}
                  {e.amount < 0 && <span className="ml-1.5 text-xs font-medium" style={{ color: STATUS.good }}>estorno</span>}
                </p>
                <p className="text-xs text-muted truncate">
                  {formatDate(e.date)} · {e.person.name} · {e.category.name} · {e.paymentMethod.name}
                  {e.billingDate ? ` · fatura ${formatDate(e.billingDate)}` : ''}
                </p>
              </div>
              <span
                className="text-sm font-semibold tabular-nums shrink-0"
                style={e.amount < 0 ? { color: STATUS.good } : undefined}
              >
                {formatCurrency(e.amount)}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk"
                  aria-label="Editar"
                >
                  <IconEdit width={16} height={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(e)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-critical"
                  aria-label="Excluir"
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title="Editar gasto" onClose={() => setEditing(null)}>
          <ExpenseEditForm expense={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
