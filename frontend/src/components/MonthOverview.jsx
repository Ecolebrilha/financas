import { formatCurrency } from '../lib/format';
import { STATUS } from '../lib/colors';

// Mesmo padrão "tanque" das outras seções: a barra ilustra quanto da
// receita já foi consumida pelos gastos. Enche em verde enquanto sobra
// margem, passa a laranja perto de zerar, e vira uma barra cheia em
// vermelho quando os gastos já passaram da receita (saldo negativo) — em
// vez de simplesmente sumir, o que deixaria o estouro menos visível.
//
// `expenses`/`balance` são sempre a SUA parte (só os gastos da pessoa
// marcada como "você" em Mais → Pessoas) — o que a família gasta nos
// cartões compartilhados é cobrança, não sai do seu bolso de fato.
// `householdExpenses` (o total de todo mundo) fica só como contexto.
//
// Em períodos futuros, o número em destaque vira uma SIMULAÇÃO: soma o
// saldo (ou dívida) acumulado desde hoje — vindo de despesas fixas e
// parcelas já lançadas em cada período no meio do caminho — com a
// receita/gasto previstos do próprio período.
export default function MonthOverview({ expenses, householdExpenses, income, balance, isFuture, projectedBalance, carryOver }) {
  const headline = isFuture ? projectedBalance : balance;
  const isNegative = headline < 0;

  let fillWidth;
  let color;
  if (income <= 0) {
    fillWidth = expenses > 0 ? 100 : 0;
    color = expenses > 0 ? STATUS.critical : STATUS.good;
  } else {
    const percentSpent = (expenses / income) * 100;
    if (percentSpent > 100) {
      fillWidth = 100;
      color = STATUS.critical;
    } else {
      fillWidth = Math.max(percentSpent, 0);
      color = percentSpent >= 85 ? STATUS.warning : STATUS.good;
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-muted">{isFuture ? 'Simulação de saldo' : 'Seu saldo do mês'}</span>
        <span className="text-3xl font-bold tabular-nums" style={{ color: isNegative ? STATUS.critical : STATUS.good }}>
          {formatCurrency(headline)}
        </span>
      </div>
      {isFuture && (
        <p className="text-xs text-muted -mt-1 mb-2">
          {formatCurrency(balance)} deste período {carryOver !== 0 && (carryOver < 0 ? '− ' : '+ ')}
          {carryOver !== 0 && `${formatCurrency(Math.abs(carryOver))} ${carryOver < 0 ? 'de dívida' : 'de sobra'} acumulada até aqui`}
        </p>
      )}
      <div className="h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fillWidth}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs font-medium">
        <span style={{ color: STATUS.critical }}>Seus gastos {formatCurrency(expenses)}</span>
        <span style={{ color: STATUS.good }}>Receita {formatCurrency(income)}</span>
      </div>
      {!isFuture && isNegative && (
        <p className="text-xs mt-2" style={{ color: STATUS.critical }}>
          Você gastou {formatCurrency(Math.abs(balance))} a mais do que recebeu neste mês.
        </p>
      )}
      {isFuture && (
        <p className="text-xs mt-2 text-muted">
          Simulação baseada em despesas fixas e parcelas já lançadas até esse período — gastos avulsos ainda não contam.
        </p>
      )}
      {householdExpenses > expenses && (
        <p className="text-xs text-muted mt-2 pt-2 border-t border-black/5 dark:border-white/10">
          Gasto total da família no período: {formatCurrency(householdExpenses)} (inclui o que ainda vai ser cobrado dos
          outros — veja em Vencimento dos cartões).
        </p>
      )}
    </div>
  );
}
