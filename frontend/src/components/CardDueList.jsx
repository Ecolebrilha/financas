import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../lib/format';
import { STATUS } from '../lib/colors';
import { IconCheck, IconChevronRight, IconEdit } from './icons';
import Modal from './Modal';
import ExpenseEditForm from './ExpenseEditForm';

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function daysUntil(dateStr) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(dateStr);
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.round((dueUtc - todayUtc) / 86400000);
}

const ALL_ID = '__all__';

function ItemRow({ item, onSettled, personName, onEdit, showSettle }) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const settled = !!item.settledAt;
  const isRefund = item.amount < 0;

  async function toggle() {
    setBusy(true);
    try {
      await api.expenses.settle(item.id, !settled);
      showToast(settled ? 'Marcado como pendente.' : `Quitado: ${item.description} · ${formatCurrency(item.amount)}`);
      onSettled();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-2 pl-3 border-l-2 border-black/10 dark:border-white/10">
      {isRefund ? (
        <span
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ color: STATUS.good }}
          title="Estorno: já desconta da fatura, não precisa quitar"
        >
          −
        </span>
      ) : showSettle ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="shrink-0 w-5 h-5 rounded-md border flex items-center justify-center disabled:opacity-50"
          style={{
            borderColor: settled ? STATUS.good : 'rgba(137,135,129,0.5)',
            backgroundColor: settled ? STATUS.good : 'transparent',
          }}
          aria-label={settled ? 'Marcar como pendente' : 'Marcar como quitado'}
        >
          {settled && <IconCheck width={12} height={12} color="white" />}
        </button>
      ) : (
        <span className="shrink-0 w-5 h-5" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm truncate ${settled ? 'line-through text-muted' : ''}`}>
          {item.description}
          {isRefund && <span className="ml-1.5 text-[11px] font-medium" style={{ color: STATUS.good }}>estorno</span>}
        </p>
        <p className="text-xs text-muted">
          {personName && `${personName} · `}
          {formatDate(item.date)}
        </p>
      </div>
      <span
        className={`text-sm font-medium tabular-nums shrink-0 ${settled ? 'text-muted line-through' : ''}`}
        style={isRefund ? { color: STATUS.good } : undefined}
      >
        {formatCurrency(item.amount)}
      </span>
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk shrink-0"
        aria-label="Editar"
      >
        <IconEdit width={15} height={15} />
      </button>
    </li>
  );
}

export default function CardDueList({ cardInvoices, people, onSettled }) {
  const showToast = useToast();
  const [expanded, setExpanded] = useState(null);
  const defaultPersonId = people?.find((p) => p.isSelf)?.id || people?.[0]?.id || null;
  const [selectedPersonId, setSelectedPersonId] = useState(defaultPersonId);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!cardInvoices || cardInvoices.length === 0) {
    return <p className="text-sm text-muted py-2">Nenhum cartão de crédito cadastrado.</p>;
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await api.expenses.update(editing.id, payload);
      showToast('Gasto atualizado!');
      setEditing(null);
      onSettled();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const activePersonId = selectedPersonId || defaultPersonId;
  const sorted = [...cardInvoices].sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));

  return (
    <div>
      {people && people.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedPersonId(ALL_ID)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${
              activePersonId === ALL_ID
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-black/10 dark:border-white/15 text-ink2 dark:text-ink2dk'
            }`}
          >
            Todos
          </button>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPersonId(p.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${
                activePersonId === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-black/10 dark:border-white/15 text-ink2 dark:text-ink2dk'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {sorted.map((c) => {
          // Só cartão de crédito de verdade tem "dívida" (fatura que
          // alguém precisa te pagar de volta). Pix já sai pago na hora —
          // não tem o que quitar, só interessa o total gasto. Flash é o
          // crédito do benefício (750): interessa quanto sobra dele, não
          // "quem deve".
          const isDebt = c.paymentMethod.type === 'CREDIT_CARD';
          const isBenefit = c.paymentMethod.type === 'VOUCHER' && c.paymentMethod.creditLimit != null;
          const benefitAvailable = isBenefit ? round2(c.paymentMethod.creditLimit - c.openInvoiceTotal) : null;

          const days = daysUntil(c.nextDueDate);
          let badgeColor = STATUS.good;
          let badgeText = `em ${days} dias`;
          if (days <= 0) {
            badgeColor = STATUS.critical;
            badgeText = days === 0 ? 'vence hoje' : 'vencido';
          } else if (days <= 3) {
            badgeColor = STATUS.critical;
          } else if (days <= 7) {
            badgeColor = STATUS.warning;
          }

          const isOpen = expanded === c.paymentMethod.id;
          const isAll = activePersonId === ALL_ID;
          const personBucket = isAll
            ? {
                items: c.byPerson
                  .flatMap((row) => row.items.map((item) => ({ ...item, personName: row.person.name })))
                  .sort((a, b) => new Date(b.date) - new Date(a.date)),
                spent: c.openInvoiceTotal,
                pending: c.totalPending,
              }
            : c.byPerson.find((row) => row.person.id === activePersonId);
          const hasAnyBreakdown = c.byPerson && c.byPerson.length > 0;

          return (
            <li key={c.paymentMethod.id} className="py-2.5">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 text-left"
                onClick={() => hasAnyBreakdown && setExpanded(isOpen ? null : c.paymentMethod.id)}
              >
                <div className="min-w-0 flex items-center gap-1">
                  {hasAnyBreakdown && (
                    <IconChevronRight width={14} height={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.paymentMethod.name}</p>
                    <p className="text-xs text-muted">{isDebt ? `Vence ${formatDate(c.nextDueDate)}` : 'Sem fatura — já sai pago na hora'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isDebt ? (
                    <>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.totalPending)}</p>
                      {c.totalPending < c.openInvoiceTotal && (
                        <p className="text-[11px] text-muted tabular-nums">de {formatCurrency(c.openInvoiceTotal)} no total</p>
                      )}
                      <p className="text-xs font-medium" style={{ color: badgeColor }}>
                        {badgeText}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.openInvoiceTotal)}</p>
                      <p className="text-[11px] text-muted">gasto no período</p>
                      {isBenefit && (
                        <p
                          className="text-xs font-medium"
                          style={{
                            color:
                              benefitAvailable < 0
                                ? STATUS.critical
                                : benefitAvailable <= c.paymentMethod.creditLimit * 0.15
                                  ? STATUS.warning
                                  : STATUS.good,
                          }}
                        >
                          {benefitAvailable < 0
                            ? `excedeu em ${formatCurrency(Math.abs(benefitAvailable))}`
                            : `sobram ${formatCurrency(benefitAvailable)} de ${formatCurrency(c.paymentMethod.creditLimit)}`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="mt-2">
                  {!personBucket || personBucket.items.length === 0 ? (
                    <p className="text-xs text-muted pl-3 py-1">
                      {isAll ? 'Sem gastos nessa fatura.' : 'Sem gastos dessa pessoa nessa fatura.'}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted pl-3 mb-1">
                        {isDebt
                          ? personBucket.pending > 0
                            ? `falta quitar ${formatCurrency(personBucket.pending)} de ${formatCurrency(personBucket.spent)}`
                            : `tudo quitado (${formatCurrency(personBucket.spent)})`
                          : `${formatCurrency(personBucket.spent)} no período`}
                      </p>
                      <ul className="space-y-1">
                        {personBucket.items.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            onSettled={onSettled}
                            personName={isAll ? item.personName : null}
                            onEdit={setEditing}
                            showSettle={isDebt}
                          />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing && (
        <Modal title="Editar gasto" onClose={() => setEditing(null)}>
          <ExpenseEditForm expense={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
