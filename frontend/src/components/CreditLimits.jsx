import { formatCurrency } from '../lib/format';
import { STATUS } from '../lib/colors';

// Meter "tanque de combustível": o preenchimento representa quanto ainda
// está disponível (não quanto foi usado) — um cartão/Flash saudável mostra
// uma barra verde bem cheia, dando a ideia de dinheiro livre; perto do
// limite vira aviso; e ao estourar o limite a barra fica cheia em
// vermelho (alarme forte, em vez de sumir). Inclui qualquer método de
// pagamento com limite cadastrado, não só cartão de crédito — o Flash
// entra na mesma lógica.
function meterFor(available, creditLimit) {
  if (available < 0) return { color: STATUS.critical, fillWidth: 100 };
  const percentAvailable = creditLimit > 0 ? (available / creditLimit) * 100 : 0;
  const color = percentAvailable <= 15 ? STATUS.warning : STATUS.good;
  return { color, fillWidth: Math.min(Math.max(percentAvailable, 0), 100) };
}

export default function CreditLimits({ paymentMethods }) {
  const items = paymentMethods
    .filter((pm) => pm.creditLimit != null)
    .map((pm) => {
      const used = pm.usedLimit || 0;
      const available = pm.creditLimit - used;
      const percentUsed = pm.creditLimit > 0 ? (used / pm.creditLimit) * 100 : 0;
      return { pm, used, available, percentUsed };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);

  if (items.length === 0) {
    return <p className="text-sm text-muted py-2">Nenhum cartão com limite cadastrado ainda.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map(({ pm, used, available }) => {
        const { color, fillWidth } = meterFor(available, pm.creditLimit);
        return (
          <li key={pm.id}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-sm font-medium truncate">{pm.name}</span>
              <span className="text-xs font-medium shrink-0" style={{ color }}>
                {available < 0 ? `excedido em ${formatCurrency(Math.abs(available))}` : `disponível ${formatCurrency(available)}`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${fillWidth}%`, backgroundColor: color }} />
            </div>
            <p className="text-xs text-muted mt-1">
              {formatCurrency(used)} usado de {formatCurrency(pm.creditLimit)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
