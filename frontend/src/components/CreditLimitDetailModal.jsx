import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from './Modal';
import { formatCurrency, formatDate, formatMonthLabel } from '../lib/format';

// Lista item a item o que está contando no "usado" de um cartão (fatura
// atual em aberto + parcelas futuras já lançadas) — pra responder "o que
// exatamente está prendendo esse limite" quando a pessoa toca no cartão.
export default function CreditLimitDetailModal({ paymentMethodId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.paymentMethods
      .usedLimitDetail(paymentMethodId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [paymentMethodId]);

  return (
    <Modal title={detail ? `O que está usando o limite — ${detail.paymentMethod.name}` : 'Carregando…'} onClose={onClose}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!detail && !error && <p className="text-sm text-muted py-4 text-center">Carregando…</p>}
      {detail && (
        <>
          {detail.items.length === 0 ? (
            <p className="text-sm text-muted py-2">Nada pendente nesse cartão agora.</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {detail.items.map((item) => (
                <li key={item.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.description}
                      {item.installmentTotal && (
                        <span className="ml-1.5 text-xs text-muted">
                          ({item.installmentNumber}/{item.installmentTotal})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {item.person.name} · {formatDate(item.date)} · fatura {formatMonthLabel(item.periodLabel)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
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
