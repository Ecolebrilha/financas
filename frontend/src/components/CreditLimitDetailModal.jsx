import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import ExpenseEditForm from './ExpenseEditForm';
import { IconEdit, IconTrash } from './icons';
import { STATUS } from '../lib/colors';
import { formatCurrency, formatDate, formatMonthLabel, currentPeriodLabel } from '../lib/format';

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Agrupa por fatura (periodLabel) — já vem ordenado por fatura e depois
// por data do backend, então só precisa separar em "baldes" na ordem em
// que aparece, sem reordenar nada.
function groupByInvoice(items) {
  const byLabel = new Map();
  const order = [];
  for (const item of items) {
    if (!byLabel.has(item.periodLabel)) {
      byLabel.set(item.periodLabel, { periodLabel: item.periodLabel, items: [], total: 0 });
      order.push(item.periodLabel);
    }
    const group = byLabel.get(item.periodLabel);
    group.items.push(item);
    group.total += item.amount;
  }
  return order.map((label) => {
    const g = byLabel.get(label);
    return { ...g, total: round2(g.total) };
  });
}

// Lista o que está contando no "usado" de um cartão (fatura atual em
// aberto + parcelas futuras já lançadas), agrupado por fatura — cada
// grupo com seu próprio subtotal, pra deixar claro quanto é da fatura
// que já vai fechar e quanto é parcela ainda por vir, sem misturar tudo
// numa lista só. Editar/apagar aqui mexe direto no lançamento, sem
// precisar sair pra outra tela.
export default function CreditLimitDetailModal({ paymentMethodId, onClose, onChanged }) {
  const showToast = useToast();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.paymentMethods
      .usedLimitDetail(paymentMethodId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [paymentMethodId]);

  async function handleSave(payload) {
    setSaving(true);
    try {
      await api.expenses.update(editing.id, payload);
      showToast('Gasto atualizado!');
      setEditing(null);
      load();
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    let scope;
    if (item.installmentGroupId) {
      const deleteAll = window.confirm(
        'Esse gasto faz parte de um parcelamento.\n\nOK = apagar esta parcela e todas as futuras dela\nCancelar = apagar só esta parcela',
      );
      scope = deleteAll ? 'group' : undefined;
    } else if (!window.confirm(`Apagar "${item.description}"?`)) {
      return;
    }
    try {
      await api.expenses.remove(item.id, scope ? { scope } : undefined);
      showToast('Gasto apagado.');
      load();
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const today = currentPeriodLabel();
  const groups = detail ? groupByInvoice(detail.items) : [];

  return (
    <Modal title={detail ? `O que está usando o limite — ${detail.paymentMethod.name}` : 'Carregando…'} onClose={onClose}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!detail && !error && <p className="text-sm text-muted py-4 text-center">Carregando…</p>}
      {detail && (
        <>
          {groups.length === 0 ? (
            <p className="text-sm text-muted py-2">Nada pendente nesse cartão agora.</p>
          ) : (
            groups.map((g) => {
              const isCurrent = g.periodLabel === today;
              const color = isCurrent ? STATUS.warning : STATUS.good;
              return (
                <div key={g.periodLabel} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                      {isCurrent ? 'Fatura atual em aberto' : 'Parcela futura'} · {formatMonthLabel(g.periodLabel)}
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>
                      {formatCurrency(g.total)}
                    </span>
                  </div>
                  <ul className="divide-y divide-black/5 dark:divide-white/10 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
                    {g.items.map((item) => (
                      <li key={item.id} className="py-2 px-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium flex items-baseline gap-1.5 min-w-0">
                            <span className="truncate min-w-0">{item.description}</span>
                            {item.installmentTotal && (
                              <span className="text-xs text-muted shrink-0">
                                (parcela {item.installmentNumber}/{item.installmentTotal})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {item.person.name} · lançado em {formatDate(item.date)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk shrink-0"
                          aria-label="Editar"
                        >
                          <IconEdit width={14} height={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-critical shrink-0"
                          aria-label="Excluir"
                        >
                          <IconTrash width={14} height={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/10 space-y-1">
            {detail.deduction > 0 && (
              <div className="flex items-center justify-between text-xs text-muted">
                <span>já desconta {formatCurrency(detail.deduction)}/mês embutido nos lançamentos acima (ver Mais → Cartões)</span>
                <span>-{formatCurrency(detail.deduction)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total usado</span>
              <span className="text-base font-bold tabular-nums">{formatCurrency(detail.total)}</span>
            </div>
          </div>
        </>
      )}
      {editing && (
        <Modal title="Editar gasto" onClose={() => setEditing(null)}>
          <ExpenseEditForm expense={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </Modal>
  );
}
