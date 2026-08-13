import { formatCurrency, formatMonthLabel } from '../lib/format';

export default function InstallmentsList({ items }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted py-2">Nenhuma parcela em aberto.</p>;
  }

  return (
    <ul className="divide-y divide-black/5 dark:divide-white/10">
      {items.map((g) => (
        <li key={g.installmentGroupId} className="py-2.5">
          <div className="flex items-center justify-between gap-3">
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
          </div>
        </li>
      ))}
    </ul>
  );
}
