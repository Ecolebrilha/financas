import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import ExpenseEditForm from './ExpenseEditForm';
import { IconEdit, IconTrash } from './icons';
import { formatCurrency, formatMonthLabel } from '../lib/format';

export default function InstallmentsList({ items, onChanged }) {
  const showToast = useToast();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!items || items.length === 0) {
    return <p className="text-sm text-muted py-2">Nenhuma parcela em aberto.</p>;
  }

  async function openEdit(group) {
    try {
      const expense = await api.expenses.get(group.nextExpenseId);
      setEditing(expense);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await api.expenses.update(editing.id, payload);
      showToast('Parcela atualizada!');
      setEditing(null);
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group) {
    const deleteAll = window.confirm(
      `"${group.description}" faz parte de um parcelamento.\n\nOK = apagar esta parcela e todas as futuras dela\nCancelar = apagar só esta parcela`,
    );
    try {
      await api.expenses.remove(group.nextExpenseId, deleteAll ? { scope: 'group' } : undefined);
      showToast('Parcela apagada.');
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  return (
    <>
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {items.map((g) => (
          <li key={g.installmentGroupId} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{g.description}</p>
              <p className="text-xs text-muted">
                {g.person.name} · {g.paymentMethod.name} · parcela {g.installmentsPaid + 1}/{g.installmentTotal}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(g.remainingAmount)}</p>
              <p className="text-xs text-muted">até {formatMonthLabel(g.finalDate.slice(0, 7))}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(g)}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk"
                aria-label="Editar parcela"
              >
                <IconEdit width={15} height={15} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-critical"
                aria-label="Excluir parcela"
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title="Editar parcela" onClose={() => setEditing(null)}>
          <ExpenseEditForm expense={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </>
  );
}
