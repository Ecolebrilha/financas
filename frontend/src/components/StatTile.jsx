import { formatCurrency } from '../lib/format';

// Contrato da skill de dataviz: label (sem dois pontos) + value em destaque
// + delta opcional (sinal + cor pela direção "boa" definida por goodIsUp).
export default function StatTile({ label, value, delta, goodIsUp = true, tone }) {
  const toneColor = tone === 'critical' ? '#d03b3b' : tone === 'good' ? '#0ca30c' : undefined;

  let deltaColor;
  let deltaText;
  if (delta !== undefined && delta !== null) {
    const isUp = delta >= 0;
    const isGood = isUp === goodIsUp;
    deltaColor = isGood ? '#0ca30c' : '#d03b3b';
    deltaText = `${isUp ? '+' : ''}${formatCurrency(delta)}`;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-semibold" style={{ color: toneColor }}>
        {formatCurrency(value)}
      </span>
      {deltaText && (
        <span className="text-xs font-medium" style={{ color: deltaColor }}>
          {deltaText} vs mês anterior
        </span>
      )}
    </div>
  );
}
