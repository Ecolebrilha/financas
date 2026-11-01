import { useState } from 'react';
import { formatCurrency } from '../lib/format';
import { STATUS } from '../lib/colors';
import BalanceDetailModal from './BalanceDetailModal';

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
export default function MonthOverview({
  expenses,
  expensesImmediate,
  expensesCard,
  householdExpenses,
  income,
  incomeRegular,
  incomeFromOthers,
  balance,
  isFuture,
  paidExcluded,
  projectedBalance,
  carryOver,
  incomesList,
  expensesList,
  owedByPerson,
}) {
  const [showDetail, setShowDetail] = useState(false);
  const headline = isFuture ? projectedBalance : balance;
  const isNegative = headline < 0;
  const canShowDetail = incomesList != null && expensesList != null;

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
      <button
        type="button"
        onClick={() => canShowDetail && setShowDetail(true)}
        disabled={!canShowDetail}
        className="w-full flex items-baseline justify-between mb-2 text-left"
      >
        <span className="text-sm text-muted">
          {isFuture ? 'Simulação de saldo' : 'Seu saldo do mês'}
          {canShowDetail && <span className="text-[11px]"> (toque pra detalhar)</span>}
        </span>
        <span className="text-3xl font-bold tabular-nums" style={{ color: isNegative ? STATUS.critical : STATUS.good }}>
          {formatCurrency(headline)}
        </span>
      </button>
      {isFuture && (
        <p className="text-xs text-muted -mt-1 mb-2">
          {formatCurrency(balance)} deste período {carryOver !== 0 && (carryOver < 0 ? '− ' : '+ ')}
          {carryOver !== 0 && `${formatCurrency(Math.abs(carryOver))} ${carryOver < 0 ? 'do saque no cartão a pagar' : 'de sobra'} do mês anterior`}
        </p>
      )}
      <div className="h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fillWidth}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs font-medium">
        <span style={{ color: STATUS.critical }}>Seus gastos {formatCurrency(expenses)}</span>
        <span style={{ color: STATUS.good }}>Receita {formatCurrency(income)}</span>
      </div>
      {expensesImmediate != null && expensesCard != null && (
        <div className="flex items-center justify-between mt-1 text-[11px] text-muted">
          <span>já pago (Pix/Débito/Flash) {formatCurrency(expensesImmediate)}{paidExcluded ? ' — fora da conta' : ''}</span>
          <span>cartão a vencer {formatCurrency(expensesCard)}</span>
        </div>
      )}
      {incomeRegular != null && incomeFromOthers != null && incomeFromOthers > 0 && (
        <div className="flex items-center justify-between mt-1 text-[11px] text-muted">
          <span>salário/fixa {formatCurrency(incomeRegular)}</span>
          <span>a receber de outros (Pix/Flash) {formatCurrency(incomeFromOthers)}</span>
        </div>
      )}
      {isNegative && (
        <p className="text-xs mt-2" style={{ color: STATUS.critical }}>
          {isFuture
            ? `Projeção fica ${formatCurrency(Math.abs(headline))} negativa`
            : `Você gastou ${formatCurrency(Math.abs(balance))} a mais do que recebeu neste mês`}
          {' — pra cobrir, precisaria puxar '}
          {formatCurrency(Math.abs(headline))}
          {' do limite do cartão.'}
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
      {showDetail && canShowDetail && (
        <BalanceDetailModal
          onClose={() => setShowDetail(false)}
          incomes={incomesList}
          expenses={expensesList}
          owedByPerson={owedByPerson}
          totals={{ income, incomeRegular, incomeFromOthers, expenses, expensesImmediate, expensesCard, balance, paidExcluded }}
        />
      )}
    </div>
  );
}
