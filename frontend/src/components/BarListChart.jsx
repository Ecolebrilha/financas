import { categoricalColor } from '../lib/colors';
import { formatCurrency } from '../lib/format';

// "Bar list": comparação de magnitude entre poucas categorias, formato
// compacto e legível em mobile. Cor categórica por posição (ordem fixa),
// valor sempre na ponta da barra (nunca dentro, evita clipping).
export default function BarListChart({ data, emptyLabel = 'Sem lançamentos neste mês.' }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted py-2">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-ink2 dark:text-ink2dk truncate">{d.name}</span>
          <div className="flex-1 h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((d.total / max) * 100, 3)}%`, backgroundColor: categoricalColor(i) }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">{formatCurrency(d.total)}</span>
        </div>
      ))}
    </div>
  );
}
