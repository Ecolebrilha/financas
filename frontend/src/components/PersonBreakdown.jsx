import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { categoricalColor, STATUS } from '../lib/colors';
import { formatCurrency, formatDate, toInputDate } from '../lib/format';
import Modal from './Modal';
import ExpenseEditForm from './ExpenseEditForm';
import { NumberField, DateField, TextField } from './fields';
import { IconEdit, IconCheck, IconPlus, IconTrash } from './icons';

function SettleToggle({ expense, onChanged }) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const settled = !!expense.settledAt;

  if (expense.amount < 0) {
    return (
      <span
        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
        style={{ color: STATUS.good }}
        title="Estorno: já desconta da fatura, não precisa quitar"
      >
        −
      </span>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      await api.expenses.settle(expense.id, !settled);
      showToast(settled ? 'Marcado como pendente.' : `Quitado: ${expense.description}`);
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}

// Abatimento: a pessoa adianta um valor sem estar quitando uma compra
// específica (ex: Pix avulso "toma aí 100 reais"). Só desconta do total
// pendente dela aqui — não risca nenhum gasto como pago.
//
// A data decide em qual período o abatimento entra (mesma lógica de
// fatura do resto do app) — por isso o padrão é "hoje" só quando hoje
// cai dentro do período que você está vendo no Painel; se você estiver
// olhando um período que já fechou, sugere o último dia dele, senão o
// abatimento parece "sumir" ao cair sozinho no período seguinte.
function defaultPaymentDate(period) {
  const today = new Date();
  if (!period) return toInputDate(today);
  const start = new Date(period.start);
  const end = new Date(period.end);
  if (today >= start && today <= end) return toInputDate(today);
  return toInputDate(today < start ? start : end);
}

function PaymentForm({ personId, period, onSaved, onCancel }) {
  const showToast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultPaymentDate(period));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    try {
      await api.payments.create({ personId, amount: Number(amount), date, notes: notes || undefined });
      showToast('Abatimento registrado!');
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl bg-black/5 dark:bg-white/10 p-3 mb-2">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Valor (R$)" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <DateField label="Data" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <p className="text-xs text-muted -mt-1">A data decide em qual período o abatimento entra.</p>
      <TextField label="Observação (opcional)" placeholder="Ex: Pix adiantado" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-black/10 dark:border-white/15 py-2 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-blue-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

// Tiles grandes em vez de barrinhas finas — o pedido foi "mais rápido de
// ver quem gastou quanto". O valor em destaque é o total gasto menos os
// abatimentos avulsos já registrados (Pix que a pessoa te mandou) — NÃO
// desconta compras marcadas como "quitado" no cartão, porque isso é
// controle por item de fatura (ver Vencimento dos cartões), separado de
// quanto a pessoa já te devolveu de fato. Tocar num tile expande a lista
// de gastos daquela pessoa, cada um editável e com caixinha de quitar
// (só afeta a fatura do cartão, não esse total), além dos abatimentos já
// registrados.
export default function PersonBreakdown({ data, expenses, payments, period, onChanged }) {
  const showToast = useToast();
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted py-2">Sem lançamentos neste mês.</p>;
  }

  const paymentsByPerson = new Map();
  for (const p of payments || []) {
    paymentsByPerson.set(p.personId, (paymentsByPerson.get(p.personId) || 0) + p.amount);
  }

  const expandedPerson = data.find((d) => d.id === expandedId);
  const expandedExpenses = expandedId ? (expenses || []).filter((e) => e.personId === expandedId) : [];
  const expandedPayments = expandedId ? (payments || []).filter((p) => p.personId === expandedId) : [];

  async function handleSave(payload) {
    setSaving(true);
    try {
      await api.expenses.update(editing.id, payload);
      showToast('Gasto atualizado!');
      setEditing(null);
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePayment(id) {
    try {
      await api.payments.remove(id);
      showToast('Abatimento removido.');
      onChanged?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((d, i) => {
          const rawPending = d.total - (paymentsByPerson.get(d.id) || 0);
          const pending = Math.round((rawPending + Number.EPSILON) * 100) / 100;
          const isCredit = pending < 0;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setExpandedId(expandedId === d.id ? null : d.id);
                setAddingPayment(false);
              }}
              className={`text-left rounded-xl p-3 transition-colors ${
                expandedId === d.id ? 'bg-black/10 dark:bg-white/20' : 'bg-black/5 dark:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoricalColor(i) }} />
                <span className="text-xs text-ink2 dark:text-ink2dk truncate">{d.name}</span>
              </div>
              <span className="text-lg font-bold tabular-nums" style={isCredit ? { color: STATUS.good } : undefined}>
                {isCredit ? `crédito ${formatCurrency(Math.abs(pending))}` : formatCurrency(pending)}
              </span>
              {!isCredit && pending < d.total && (
                <p className="text-[11px] text-muted tabular-nums">de {formatCurrency(d.total)} no total</p>
              )}
            </button>
          );
        })}
      </div>

      {expandedPerson && (
        <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-3">
          <p className="text-xs text-muted mb-2">
            {expandedExpenses.length} gasto(s) de {expandedPerson.name} neste período
          </p>

          {expandedPayments.length > 0 && (
            <ul className="space-y-1 mb-2">
              {expandedPayments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-1.5 pl-3 border-l-2" style={{ borderColor: STATUS.good }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: STATUS.good }}>
                      Abatimento{p.notes ? ` — ${p.notes}` : ''}
                    </p>
                    <p className="text-xs text-muted">{formatDate(p.date)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: STATUS.good }}>
                    -{formatCurrency(p.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeletePayment(p.id)}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-critical shrink-0"
                    aria-label="Remover abatimento"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {addingPayment ? (
            <PaymentForm
              personId={expandedId}
              period={period}
              onSaved={() => {
                setAddingPayment(false);
                onChanged?.();
              }}
              onCancel={() => setAddingPayment(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingPayment(true)}
              className="flex items-center gap-1 text-xs font-medium mb-2"
              style={{ color: STATUS.good }}
            >
              <IconPlus width={14} height={14} /> Registrar abatimento (valor avulso, sem quitar item específico)
            </button>
          )}

          <ul className="divide-y divide-black/5 dark:divide-white/10 max-h-80 overflow-y-auto overflow-x-hidden pr-3 -mr-3">
            {expandedExpenses.map((e) => (
              <li key={e.id} className="py-2 flex items-center gap-3">
                <SettleToggle expense={e} onChanged={onChanged} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${e.settledAt ? 'line-through text-muted' : ''}`}>
                    {e.description}
                    {e.amount < 0 && <span className="ml-1.5 text-[11px] font-medium" style={{ color: STATUS.good }}>estorno</span>}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {formatDate(e.date)} · {e.category?.name} · {e.paymentMethod?.name}
                    {e.billingDate ? ` · fatura ${formatDate(e.billingDate)}` : ''}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums shrink-0 ${e.settledAt ? 'text-muted line-through' : ''}`}
                  style={e.amount < 0 ? { color: STATUS.good } : undefined}
                >
                  {formatCurrency(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink2 dark:text-ink2dk shrink-0"
                  aria-label="Editar"
                >
                  <IconEdit width={15} height={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <Modal title="Editar gasto" onClose={() => setEditing(null)}>
          <ExpenseEditForm expense={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
