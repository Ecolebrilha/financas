import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import PeriodPicker from '../components/PeriodPicker';
import { STATUS } from '../lib/colors';
import { currentMonthKey, formatCurrency, formatDate, formatPeriodRange } from '../lib/format';
import { IconChevronRight } from '../components/icons';

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Texto pronto pra colar e mandar pra pessoa (WhatsApp etc): cada gasto
// listado, estornos e abatimentos separados, e o total pendente no final.
function buildStatementText(group, period) {
  const lines = [`Extrato de ${group.person.name} — ${formatPeriodRange(period.start, period.end)}`, ''];

  if (group.normal.length > 0) {
    lines.push('Gastos:');
    for (const e of group.normal) {
      lines.push(`• ${formatDate(e.date)} - ${e.description} - ${formatCurrency(e.amount)}${e.settledAt ? ' (já quitado)' : ''}`);
    }
    lines.push('');
  }

  if (group.refunds.length > 0) {
    lines.push('Estornos:');
    for (const e of group.refunds) {
      lines.push(`• ${formatDate(e.date)} - ${e.description} - ${formatCurrency(e.amount)}`);
    }
    lines.push('');
  }

  if (group.payments.length > 0) {
    lines.push('Abatimentos já registrados:');
    for (const p of group.payments) {
      lines.push(`• ${formatDate(p.date)} - ${p.notes || 'Abatimento'} - -${formatCurrency(p.amount)}`);
    }
    lines.push('');
  }

  lines.push(`Total pendente: ${formatCurrency(group.pending)}`);
  return lines.join('\n');
}

function copyViaTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export default function Statement() {
  const { activePeople } = useAppData();
  const showToast = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.summary
      .get(month)
      .then(setSummary)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (loading && !summary) return <p className="text-muted text-center py-10">Carregando…</p>;
  if (!summary) return null;

  const groups = activePeople
    .map((person) => {
      const items = summary.expenses.filter((e) => e.personId === person.id);
      const normal = items.filter((e) => e.amount >= 0);
      const refunds = items.filter((e) => e.amount < 0);
      const payments = summary.payments.filter((p) => p.personId === person.id);
      // Não desconta gastos marcados como "quitado" no cartão — isso é
      // controle da fatura, separado do total que a pessoa te deve (só o
      // abatimento avulso desconta daqui, ver PersonBreakdown).
      const total = items.reduce((s, e) => s + e.amount, 0);
      const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
      return { person, items, normal, refunds, payments, pending: round2(total - paymentsTotal) };
    })
    .filter((g) => g.items.length > 0 || g.payments.length > 0);

  async function handleCopy(group) {
    const text = buildStatementText(group, summary.period);
    // navigator.clipboard.writeText pode ficar pendurado esperando
    // permissão em vez de rejeitar (varia por navegador/contexto) —
    // corrida com um fallback via execCommand pra nunca travar o botão.
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);
      showToast(`Extrato de ${group.person.name} copiado! Já pode colar e enviar.`);
    } catch {
      if (copyViaTextarea(text)) {
        showToast(`Extrato de ${group.person.name} copiado! Já pode colar e enviar.`);
      } else {
        showToast('Não consegui copiar automaticamente — copie o texto manualmente.', 'error');
      }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Extrato por pessoa</h1>
      <PeriodPicker month={month} onChange={setMonth} period={summary.period} />
      <p className="text-xs text-muted -mt-2">
        Todos os gastos individuais de cada pessoa nesse período, com estornos e abatimentos já descontados do total. Toque
        em "Copiar" pra levar um texto pronto pra mandar pra ela.
      </p>

      {groups.length === 0 ? (
        <p className="text-muted text-center py-10">Sem lançamentos nesse período.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = expandedId === g.person.id;
            const isCredit = g.pending < 0;
            return (
              <Card key={g.person.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 text-left"
                  onClick={() => setExpandedId(isOpen ? null : g.person.id)}
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <IconChevronRight width={16} height={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{g.person.name}</p>
                      <p className="text-xs text-muted">{g.items.length} gasto(s)</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold tabular-nums shrink-0" style={isCredit ? { color: STATUS.good } : undefined}>
                    {isCredit ? `crédito ${formatCurrency(Math.abs(g.pending))}` : formatCurrency(g.pending)}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                    <ul className="divide-y divide-black/5 dark:divide-white/10 mb-3">
                      {g.items.map((e) => (
                        <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm truncate ${e.settledAt ? 'line-through text-muted' : ''}`}>
                              {e.description}
                              {e.installmentTotal && (
                                <span className="ml-1.5 text-xs text-muted">
                                  ({e.installmentNumber}/{e.installmentTotal})
                                </span>
                              )}
                              {e.amount < 0 && (
                                <span className="ml-1.5 text-[11px] font-medium" style={{ color: STATUS.good }}>
                                  estorno
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDate(e.date)} · {e.paymentMethod?.name}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-medium tabular-nums shrink-0 ${e.settledAt ? 'text-muted line-through' : ''}`}
                            style={e.amount < 0 ? { color: STATUS.good } : undefined}
                          >
                            {formatCurrency(e.amount)}
                          </span>
                        </li>
                      ))}
                      {g.payments.map((p) => (
                        <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate" style={{ color: STATUS.good }}>
                              Abatimento{p.notes ? ` — ${p.notes}` : ''}
                            </p>
                            <p className="text-xs text-muted">{formatDate(p.date)}</p>
                          </div>
                          <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: STATUS.good }}>
                            -{formatCurrency(p.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleCopy(g)}
                      className="w-full rounded-xl border border-black/10 dark:border-white/15 py-2.5 text-sm font-medium"
                    >
                      Copiar extrato de {g.person.name}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
