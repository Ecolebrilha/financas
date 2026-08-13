import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import { TextField, NumberField, DateField, SelectField, PrimaryButton } from './fields';
import { IconEdit, IconPlus } from './icons';
import { formatCurrency, toInputDate } from '../lib/format';

function RecurringForm({ initial, onSubmit, onCancel, saving }) {
  const { activePeople, activeCategories, activePaymentMethods } = useAppData();
  const [form, setForm] = useState({
    description: initial?.description || '',
    amount: initial ? String(initial.amount) : '',
    personId: initial?.personId || activePeople[0]?.id || '',
    paymentMethodId: initial?.paymentMethodId || activePaymentMethods[0]?.id || '',
    categoryId: initial?.categoryId || activeCategories[0]?.id || '',
    dayOfMonth: initial ? String(initial.dayOfMonth) : '1',
    startDate: initial ? toInputDate(initial.startDate) : toInputDate(new Date()),
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      description: form.description.trim(),
      amount: Number(form.amount),
      personId: form.personId,
      paymentMethodId: form.paymentMethodId,
      categoryId: form.categoryId,
      dayOfMonth: Number(form.dayOfMonth),
      startDate: form.startDate,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextField label="Descrição" value={form.description} onChange={set('description')} required />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Valor (R$)" min="0.01" value={form.amount} onChange={set('amount')} required />
        <NumberField label="Dia do mês" min="1" max="28" step="1" value={form.dayOfMonth} onChange={set('dayOfMonth')} required />
      </div>
      <SelectField label="Pessoa" value={form.personId} onChange={set('personId')} required>
        {activePeople.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Método de pagamento" value={form.paymentMethodId} onChange={set('paymentMethodId')} required>
        {activePaymentMethods.map((pm) => (
          <option key={pm.id} value={pm.id}>
            {pm.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Categoria" value={form.categoryId} onChange={set('categoryId')} required>
        {activeCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <DateField label="A partir de" value={form.startDate} onChange={set('startDate')} required />
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

export default function RecurringManager() {
  const showToast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.recurring
      .list({ includeInactive: true })
      .then(setItems)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function handleCreate(data) {
    setSaving(true);
    try {
      await api.recurring.create(data);
      showToast('Gasto fixo cadastrado!');
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
      await api.recurring.update(editing.id, data);
      showToast('Atualizado!');
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      if (item.active) await api.recurring.remove(item.id);
      else await api.recurring.update(item.id, { active: true });
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  if (loading) return <p className="text-sm text-muted py-2">Carregando…</p>;

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm font-medium text-blue-600">
          <IconPlus width={16} height={16} /> Novo gasto fixo
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted py-2">Nenhum gasto fixo cadastrado.</p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((item) => (
            <li key={item.id} className={`py-2.5 flex items-center justify-between gap-3 ${!item.active ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted truncate">
                  {item.person.name} · {item.paymentMethod.name} · todo dia {item.dayOfMonth}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className="text-xs px-2 py-1 rounded-full border border-black/10 dark:border-white/15"
                >
                  {item.active ? 'Pausar' : 'Reativar'}
                </button>
                <button type="button" onClick={() => setEditing(item)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Editar">
                  <IconEdit width={16} height={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal title="Novo gasto fixo" onClose={() => setCreating(false)}>
          <RecurringForm onSubmit={handleCreate} onCancel={() => setCreating(false)} saving={saving} />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar gasto fixo" onClose={() => setEditing(null)}>
          <RecurringForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
