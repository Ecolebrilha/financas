import Modal from './Modal';
import { STATUS } from '../lib/colors';
import { formatCurrency, formatDate } from '../lib/format';
import { INCOME_TYPE_LABELS } from '../lib/constants';

const IMMEDIATE_TYPES = ['PIX', 'DEBIT_CARD', 'VOUCHER'];

function Section({ title, color, total, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-semibold" style={{ color }}>
          {title}
        </h3>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {formatCurrency(total)}
        </span>
      </div>
      {children}
    </div>
  );
}

// Mesma ideia de SubList, mas pra totais por pessoa (sem data) — usado
// no "a receber de outras pessoas": cada pessoa conta pelo total gasto
// dela no período, não item por item (lista ficaria enorme).
function PersonTotalsList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      {label && <p className="text-xs font-medium text-muted mb-1">{label}</p>}
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {items.map((p) => (
          <li key={p.id} className="py-1.5 flex items-center justify-between gap-3">
            <span className="text-sm truncate">
              {p.icon || '👤'} {p.name}
            </span>
            <span className="text-sm font-medium tabular-nums shrink-0">{formatCurrency(p.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubList({ label, items, renderExtra }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      {label && <p className="text-xs font-medium text-muted mb-1">{label}</p>}
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {items.map((item) => (
          <li key={item.id} className="py-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm truncate">{item.description || 'Abatimento'}</p>
              <p className="text-xs text-muted truncate">
                {formatDate(item.date)}
                {renderExtra ? ` · ${renderExtra(item)}` : ''}
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Detalha item a item exatamente o que entra em cada número do "Seu
// saldo do mês": de onde vem a receita (o que entra de fora, tipo
// salário/Flash, MAIS tudo que as outras pessoas gastaram no período —
// elas vão te devolver esse valor de qualquer jeito, então conta como
// receita já na hora que o gasto delas é lançado, não só quando pagam;
// um abatimento já recebido não soma de novo, só abate o "pendente" em
// Gasto por pessoa) e o que são os SEUS gastos (o que já saiu do bolso
// vs. a dívida de cartão que ainda vai vencer).
export default function BalanceDetailModal({ onClose, incomes, expenses, owedByPerson, totals }) {
  const selfExpenses = expenses.filter((e) => e.person?.isSelf);
  const immediate = selfExpenses.filter((e) => IMMEDIATE_TYPES.includes(e.paymentMethod?.type));
  const card = selfExpenses.filter((e) => !IMMEDIATE_TYPES.includes(e.paymentMethod?.type));

  return (
    <Modal title="De onde vem esse número" onClose={onClose}>
      <Section title="Receita" color={STATUS.good} total={totals.income}>
        <SubList
          label={`Fixa/avulsa — ${formatCurrency(totals.incomeRegular)}`}
          items={incomes}
          renderExtra={(i) => INCOME_TYPE_LABELS[i.type] || i.type}
        />
        <PersonTotalsList label={`A receber de outras pessoas (Pix/Flash) — ${formatCurrency(totals.incomeFromOthers)}`} items={owedByPerson} />
      </Section>

      <Section title="Seus gastos" color={STATUS.critical} total={totals.expenses}>
        <SubList
          label={`Já pago (Pix/Débito/Flash) — ${formatCurrency(totals.expensesImmediate)}${totals.paidExcluded ? ' · já saiu do bolso, não entra no saldo' : ''}`}
          items={immediate}
          renderExtra={(e) => e.paymentMethod?.name}
        />
        <SubList
          label={`Cartão a vencer (suas dívidas) — ${formatCurrency(totals.expensesCard)}`}
          items={card}
          renderExtra={(e) =>
            e.installmentTotal ? `${e.paymentMethod?.name} · parcela ${e.installmentNumber}/${e.installmentTotal}` : e.paymentMethod?.name
          }
        />
      </Section>

      {totals.cashAdjustment !== 0 && totals.cashAdjustment != null && (
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="text-xs text-muted">
            Ajuste pelo dinheiro real (Caixa): saldo em conta e Flash no lugar do que já foi recebido, menos o que está separado
          </span>
          <span className="text-sm font-medium tabular-nums shrink-0">
            {totals.cashAdjustment > 0 ? '+ ' : '− '}
            {formatCurrency(Math.abs(totals.cashAdjustment))}
          </span>
        </div>
      )}
      <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
        <span className="text-sm font-semibold">{totals.paidExcluded ? 'Saldo (igual ao da Caixa)' : 'Saldo (receita − seus gastos)'}</span>
        <span
          className="text-base font-bold tabular-nums"
          style={{ color: totals.balance < 0 ? STATUS.critical : STATUS.good }}
        >
          {formatCurrency(totals.balance)}
        </span>
      </div>
    </Modal>
  );
}
