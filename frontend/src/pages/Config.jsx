import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../api/client';
import Card from '../components/Card';
import EntityManager from '../components/EntityManager';
import IncomesManager from '../components/IncomesManager';
import RecurringManager from '../components/RecurringManager';
import RecurringIncomeManager from '../components/RecurringIncomeManager';
import { PAYMENT_TYPE_LABELS } from '../lib/constants';
import { formatCurrency } from '../lib/format';

const TABS = [
  { value: 'receitas', label: 'Receitas' },
  { value: 'receitas_fixas', label: 'Receitas fixas' },
  { value: 'fixos', label: 'Gastos fixos' },
  { value: 'pessoas', label: 'Pessoas' },
  { value: 'categorias', label: 'Categorias' },
  { value: 'cartoes', label: 'Cartões e Pix' },
];

const PAYMENT_TYPE_OPTIONS = Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function Config() {
  const { people, categories, paymentMethods, reload } = useAppData();
  const [tab, setTab] = useState('receitas');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mais</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border ${
              tab === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-black/10 dark:border-white/15 text-ink2 dark:text-ink2dk'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'receitas' && <IncomesManager />}
        {tab === 'receitas_fixas' && <RecurringIncomeManager />}
        {tab === 'fixos' && <RecurringManager />}
        {tab === 'pessoas' && (
          <EntityManager
            title="Pessoas"
            api={api.people}
            items={people}
            onChanged={reload}
            fields={[
              { key: 'name', label: 'Nome', type: 'text', required: true },
              { key: 'isSelf', label: 'Essa pessoa é você (usado pro saldo pessoal do Painel)', type: 'checkbox' },
            ]}
            describe={(item) => (item.isSelf ? `${item.name} (você)` : item.name)}
          />
        )}
        {tab === 'categorias' && (
          <EntityManager
            title="Categorias"
            api={api.categories}
            items={categories}
            onChanged={reload}
            fields={[{ key: 'name', label: 'Nome', type: 'text', required: true }]}
            describe={(item) => item.name}
          />
        )}
        {tab === 'cartoes' && (
          <EntityManager
            title="Cartões"
            api={api.paymentMethods}
            items={paymentMethods}
            onChanged={reload}
            fields={[
              { key: 'name', label: 'Nome', type: 'text', required: true },
              { key: 'type', label: 'Tipo', type: 'select', options: PAYMENT_TYPE_OPTIONS, required: true },
              { key: 'dueDay', label: 'Dia de vencimento (se for cartão)', type: 'number', min: 1, max: 31 },
              { key: 'creditLimit', label: 'Limite máximo (opcional)', type: 'number', min: 0 },
              { key: 'usedLimit', label: 'Limite utilizado atualmente (opcional)', type: 'number', min: 0 },
            ]}
            describe={(item) => {
              let text = `${item.name} — ${PAYMENT_TYPE_LABELS[item.type]}`;
              if (item.dueDay) text += ` · vence dia ${item.dueDay}`;
              if (item.creditLimit != null) {
                const available = item.creditLimit - (item.usedLimit || 0);
                text += ` · disponível ${formatCurrency(available)} de ${formatCurrency(item.creditLimit)}`;
              }
              return text;
            }}
          />
        )}
      </Card>
    </div>
  );
}
