import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import MonthPicker from './MonthPicker';
import { NumberField, DateField, SelectField, TextField, PrimaryButton } from './fields';
import { IconEdit, IconPlus, IconTrash } from './icons';
import { INCOME_TYPE_LABELS } from '../lib/constants';
import { currentMonthKey, formatCurrency, formatDate, toInputDate } from '../lib/format';

function IncomeForm({ initial, onSubmit, onCancel, saving }) {
  const { activePeople } = useAppData();
  const [form, setForm] = useState({
    description: initial?.description || '',
    amount: initial ? String(initial.amount) : '',
    date: initial ? toInputDate(initial.date) : toInputDate(new Date()),
    type: initial?.type || 'SALARY',
    personId: initial?.personId || '',
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      description: form.description.trim(),
      amount: Number(form.amount),
      date: form.date,
      type: form.type,
      personId: form.personId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextField label="Descrição" placeholder="Ex: salário de agosto" value={form.description} onChange={set('description')} required />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Valor (R$)" min="0.01" value={form.amount} onChange={set('amount')} required />
        <DateField label="Data" value={form.date} onChange={set('date')} required />
      </div>
      <SelectField label="Tipo" value={form.type} onChange={set('type')} required>
        {Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Pessoa (opcional)" value={form.personId} onChange={set('personId')}>
        <option value="">Geral / não se aplica</option>
        {activePeople.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-black/10 dark:border-white/15 py-3 font-medium">
          Cancelar
        </button>
        <PrimaryButton className="flex-1" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </PrimaryButton>
      </div>
    </form>
  );
}

export default function IncomesManager() {
  const showToast = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.incomes
      .list({ month })
      .then(setItems)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [month]);

  async function handleCreate(data) {
    setSaving(true);
    try {
      await api.incomes.create(data);
      showToast('Receita lançada!');
      setCreating(false);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data) {
    setSaving(true);
    try {
      await api.incomes.update(editing.id, data);
      showToast('Atualizado!');
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Apagar "${item.description}"?`)) return;
    try {
      await api.incomes.remove(item.id);
      showToast('Receita apagada.');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-3">
      <MonthPicker month={month} onChange={setMonth} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Total: {formatCurrency(total)}</span>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm font-medium text-blue-600">
          <IconPlus width={16} height={16} /> Nova receita
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-2">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted py-2">Nenhuma receita neste mês.</p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((item) => (
            <li key={item.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted truncate">
                  {formatDate(item.date)} · {INCOME_TYPE_LABELS[item.type]}
                  {item.person ? ` · ${item.person.name}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#0ca30c' }}>
                {formatCurrency(item.amount)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setEditing(item)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Editar">
                  <IconEdit width={16} height={16} />
                </button>
                <button type="button" onClick={() => handleDelete(item)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-critical" aria-label="Excluir">
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal title="Nova receita" onClose={() => setCreating(false)}>
          <IncomeForm onSubmit={handleCreate} onCancel={() => setCreating(false)} saving={saving} />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar receita" onClose={() => setEditing(null)}>
          <IncomeForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
