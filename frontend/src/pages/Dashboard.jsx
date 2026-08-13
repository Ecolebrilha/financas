import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import Card from '../components/Card';
import PeriodPicker from '../components/PeriodPicker';
import MonthOverview from '../components/MonthOverview';
import PersonBreakdown from '../components/PersonBreakdown';
import BarListChart from '../components/BarListChart';
import CardDueList from '../components/CardDueList';
import InstallmentsList from '../components/InstallmentsList';
import CreditLimits from '../components/CreditLimits';
import { currentMonthKey, formatCurrency, formatDate } from '../lib/format';

export default function Dashboard() {
  const { paymentMethods, activePeople } = useAppData();
  const [month, setMonth] = useState(currentMonthKey());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    api.summary
      .get(month)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [month]);

  const totalPending = summary ? summary.cardInvoices.reduce((s, c) => s + (c.totalPending || 0), 0) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Painel mensal</h1>
      <PeriodPicker month={month} onChange={setMonth} period={summary?.period} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !summary && <p className="text-muted text-center py-10">Carregando…</p>}

      {summary && (
        <>
          <Card>
            <MonthOverview
              expenses={summary.totals.expenses}
              householdExpenses={summary.totals.householdExpenses}
              income={summary.totals.income}
              balance={summary.totals.balance}
              isFuture={summary.totals.isFuture}
              projectedBalance={summary.totals.projectedBalance}
              carryOver={summary.totals.carryOver}
            />
          </Card>

          <Card
            title="Gasto por pessoa"
            action={
              <Link to="/extrato" className="text-xs font-medium" style={{ color: '#2a78d6' }}>
                Ver extrato →
              </Link>
            }
          >
            <PersonBreakdown data={summary.byPerson} expenses={summary.expenses} payments={summary.payments} onChanged={load} />
          </Card>

          <Card
            title="Vencimento dos cartões"
            action={
              totalPending > 0 && (
                <span className="text-xs font-medium" style={{ color: '#d03b3b' }}>
                  {formatCurrency(totalPending)} pendente
                </span>
              )
            }
          >
            <p className="text-xs text-muted -mt-2 mb-1">
              Sempre com base em hoje, independente do mês selecionado acima. Escolha a pessoa e toque num cartão pra ver
              (e quitar, no caso dos cartões de crédito) as compras dela.
            </p>
            <CardDueList cardInvoices={summary.cardInvoices} people={activePeople} onSettled={load} />
          </Card>

          <Card title="Limites de crédito">
            <p className="text-xs text-muted -mt-2 mb-2">Atualizado manualmente por você em Mais → Cartões e Pix.</p>
            <CreditLimits paymentMethods={paymentMethods} />
          </Card>

          <Card title="Gasto por método de pagamento">
            <BarListChart data={summary.byPaymentMethod} />
          </Card>

          <Card title="Gasto por categoria">
            <BarListChart data={summary.byCategory} />
          </Card>

          <Card title="Parcelas em aberto">
            <p className="text-xs text-muted -mt-2 mb-1">Todas as parcelas futuras, de qualquer mês.</p>
            <InstallmentsList items={summary.openInstallments} />
          </Card>

          <Card title="Receitas fixas do mês">
            {summary.recurringIncomes.length === 0 ? (
              <p className="text-sm text-muted py-2">Nenhuma receita fixa lançada neste mês.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {summary.recurringIncomes.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.description}</p>
                      <p className="text-xs text-muted">
                        {i.person ? `${i.person.name} · ` : ''}
                        {formatDate(i.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#0ca30c' }}>
                      {formatCurrency(i.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Gastos fixos do mês">
            {summary.recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted py-2">Nenhum gasto fixo lançado neste mês.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {summary.recurringExpenses.map((e) => (
                  <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted">
                        {e.person.name} · {e.paymentMethod.name} · {formatDate(e.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
