import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from './Modal';
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
// numa lista só.
export default function CreditLimitDetailModal({ paymentMethodId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.paymentMethods
      .usedLimitDetail(paymentMethodId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [paymentMethodId]);

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
                      <li key={item.id} className="py-2 px-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {item.description}
                            {item.installmentTotal && (
                              <span className="ml-1.5 text-xs text-muted">
                                (parcela {item.installmentNumber}/{item.installmentTotal})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {item.person.name} · lançado em {formatDate(item.date)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold">Total usado</span>
            <span className="text-base font-bold tabular-nums">{formatCurrency(detail.total)}</span>
          </div>
        </>
      )}
    </Modal>
  );
}
