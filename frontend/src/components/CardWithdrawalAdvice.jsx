import { formatCurrency, formatMonthLabel } from '../lib/format';

// Só aparece quando o saldo do período fica negativo. Sugere como sacar
// a diferença no limite do cartão via Mercado Pago (1x ou 2x, as duas
// únicas opções usadas na prática) e recomenda uma com base em como o
// MÊS SEGUINTE ficaria se a dívida fosse paga de cada jeito — 1x é mais
// barato no total, mas só vale quando não deixa o próximo mês no
// vermelho; senão, parcelar em 2x (mais caro, porém mais leve por mês)
// é a escolha certa.
export default function CardWithdrawalAdvice({ data }) {
  if (!data) return null;
  const { amountNeeded, options, recommended, nextMonth, nextMonthBalanceIf1x } = data;

  return (
    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
      <p className="text-sm font-semibold mb-1">Saque no limite do cartão (Mercado Pago)</p>
      <p className="text-xs text-muted mb-2">Pra cobrir {formatCurrency(amountNeeded)} que faltam:</p>
      <div className="space-y-2">
        {[1, 2].map((n) => {
          const opt = options[n];
          const isRecommended = recommended === n;
          return (
            <div
              key={n}
              className={`rounded-xl p-2.5 border ${
                isRecommended ? 'border-blue-500' : 'border-black/10 dark:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {n}x
                  {isRecommended && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                      recomendado
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(opt.total)}</span>
              </div>
              <p className="text-xs text-muted">
                taxa {(opt.feeRate * 100).toFixed(2).replace('.', ',')}% ({formatCurrency(opt.fee)})
                {n === 2 && ` · 2x de ${formatCurrency(opt.perInstallment)}`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-2">
        {recommended === 2
          ? `Pagar tudo em 1x deixaria ${formatMonthLabel(nextMonth)} negativo em ${formatCurrency(
              Math.abs(nextMonthBalanceIf1x),
            )} — parcelar em 2x é mais caro no total, mas cabe melhor no fluxo de caixa.`
          : `Dá pra pagar tudo em 1x sem deixar ${formatMonthLabel(nextMonth)} no vermelho — mais barato no total.`}
      </p>
    </div>
  );
}
