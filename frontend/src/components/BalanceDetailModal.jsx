import Modal from './Modal';
import { STATUS } from '../lib/colors';
import { formatCurrency, formatDate } from '../lib/format';
import { INCOME_TYPE_LABELS } from '../lib/constants';

const IMMEDIATE_TYPES = ['PIX', 'DEBIT_CARD'];

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
// saldo do mês": de onde vem a receita (só o que entra de fora mesmo —
// abatimento de outras pessoas não conta aqui, é só desconto do que
// elas devem, ver PersonBreakdown) e o que são os SEUS gastos (o que já
// saiu do bolso vs. a dívida de cartão que ainda vai vencer).
export default function BalanceDetailModal({ onClose, incomes, expenses, totals }) {
  const selfExpenses = expenses.filter((e) => e.person?.isSelf);
  const immediate = selfExpenses.filter((e) => IMMEDIATE_TYPES.includes(e.paymentMethod?.type));
  const card = selfExpenses.filter((e) => !IMMEDIATE_TYPES.includes(e.paymentMethod?.type));

  return (
    <Modal title="De onde vem esse número" onClose={onClose}>
      <Section title="Receita" color={STATUS.good} total={totals.income}>
        <SubList items={incomes} renderExtra={(i) => INCOME_TYPE_LABELS[i.type] || i.type} />
      </Section>

      <Section title="Seus gastos" color={STATUS.critical} total={totals.expenses}>
        <SubList
          label={`Já pago (Pix/Débito) — ${formatCurrency(totals.expensesImmediate)}`}
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

      <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
        <span className="text-sm font-semibold">Saldo (receita − seus gastos)</span>
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
