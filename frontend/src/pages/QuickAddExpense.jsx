import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { TextField, NumberField, DateField, MonthField, TextAreaField, SelectField, SegmentedControl, PrimaryButton } from '../components/fields';
import PersonPicker from '../components/PersonPicker';
import { toInputDate, formatCurrency } from '../lib/format';

const TIPOS = [
  { value: 'unico', label: 'Único' },
  { value: 'dividida', label: 'Dividida' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'fixo', label: 'Fixo mensal' },
  { value: 'estorno', label: 'Estorno' },
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Rateia o valor total igualmente entre as pessoas selecionadas, em
// centavos pra não acumular erro de ponto flutuante. Quando não divide
// exato, o(s) centavo(s) que sobra(m) vai(ão) pra quem está com o menor
// valor pendente agora (`pendingByPerson`) — assim, com o tempo, quem já
// deve menos é quem "paga" o arredondamento, e não sempre a mesma pessoa.
function splitAmount(totalAmount, people, pendingByPerson) {
  const totalCents = Math.round(totalAmount * 100);
  const n = people.length;
  if (n === 0) return [];
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;
  const sorted = [...people].sort((a, b) => (pendingByPerson.get(a.id) ?? 0) - (pendingByPerson.get(b.id) ?? 0));
  const extraIds = new Set(sorted.slice(0, remainder).map((p) => p.id));
  return people.map((p) => ({
    person: p,
    amount: round2((baseCents + (extraIds.has(p.id) ? 1 : 0)) / 100),
  }));
}

const EMPTY_FORM = {
  description: '',
  amount: '',
  date: toInputDate(new Date()),
  personId: '',
  paymentMethodId: '',
  categoryId: '',
  notes: '',
  installmentNumber: '1',
  installmentTotal: '2',
  generateFutureInstallments: true,
  billingDate: '',
};

export default function QuickAddExpense() {
  const { activePeople, activeCategories, activePaymentMethods, loading } = useAppData();
  const showToast = useToast();
  const [tipo, setTipo] = useState('unico');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showBillingOverride, setShowBillingOverride] = useState(false);
  const [splitPeopleIds, setSplitPeopleIds] = useState([]);
  const [pendingByPerson, setPendingByPerson] = useState(new Map());
  const [loadingPending, setLoadingPending] = useState(false);

  // Pra decidir quem recebe o centavo de arredondamento, precisa saber
  // quanto cada pessoa já está devendo agora (mesmo total de "Gasto por
  // pessoa" no Painel: gastos do período menos abatimentos já
  // registrados) — só busca isso quando a aba Dividida é aberta, já que
  // o resto do formulário não precisa dessa informação.
  useEffect(() => {
    if (tipo !== 'dividida') return;
    setLoadingPending(true);
    api.summary
      .get()
      .then((summary) => {
        const paymentsByPerson = new Map();
        for (const p of summary.payments || []) {
          paymentsByPerson.set(p.personId, (paymentsByPerson.get(p.personId) || 0) + p.amount);
        }
        const map = new Map();
        for (const b of summary.byPerson || []) {
          map.set(b.id, round2(b.total - (paymentsByPerson.get(b.id) || 0)));
        }
        setPendingByPerson(map);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoadingPending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  // Preenche os selects com o primeiro item assim que os dados carregam
  // (precisa entrar no estado de fato, não só no valor exibido, senão o
  // submit valida contra um personId/... que nunca foi setado).
  useEffect(() => {
    setForm((f) => ({
      ...f,
      personId: f.personId || activePeople[0]?.id || '',
      paymentMethodId: f.paymentMethodId || activePaymentMethods[0]?.id || '',
      categoryId: f.categoryId || activeCategories[0]?.id || '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeople, activePaymentMethods, activeCategories]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || !form.paymentMethodId || !form.categoryId) {
      showToast('Preencha descrição, valor, método e categoria.', 'error');
      return;
    }
    if (tipo === 'dividida') {
      if (splitPeopleIds.length < 2) {
        showToast('Selecione pelo menos 2 pessoas pra dividir.', 'error');
        return;
      }
    } else if (!form.personId) {
      showToast('Preencha descrição, valor, pessoa, método e categoria.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (tipo === 'dividida') {
        const splitPeople = activePeople.filter((p) => splitPeopleIds.includes(p.id));
        const splits = splitAmount(Number(form.amount), splitPeople, pendingByPerson);
        await Promise.all(
          splits.map((s) =>
            api.expenses.create({
              description: form.description.trim(),
              amount: s.amount,
              date: form.date,
              personId: s.person.id,
              paymentMethodId: form.paymentMethodId,
              categoryId: form.categoryId,
              notes: form.notes || undefined,
              billingDate: showBillingOverride && form.billingDate ? `${form.billingDate}-01` : undefined,
            }),
          ),
        );
        showToast(`Gasto dividido entre ${splits.length} pessoas!`);
      } else if (tipo === 'fixo') {
        const dayOfMonth = Number(form.date.split('-')[2]);
        await api.recurring.create({
          description: form.description.trim(),
          amount: Number(form.amount),
          personId: form.personId,
          paymentMethodId: form.paymentMethodId,
          categoryId: form.categoryId,
          dayOfMonth,
          startDate: form.date,
          notes: form.notes || undefined,
        });
        await api.recurring.materialize(form.date.slice(0, 7));
        showToast(`Gasto fixo cadastrado! Vai repetir todo dia ${dayOfMonth}.`);
      } else {
        const payload = {
          description: form.description.trim(),
          amount: Number(form.amount),
          date: form.date,
          personId: form.personId,
          paymentMethodId: form.paymentMethodId,
          categoryId: form.categoryId,
          notes: form.notes || undefined,
          billingDate: showBillingOverride && form.billingDate ? `${form.billingDate}-01` : undefined,
        };
        if (tipo === 'parcelado') {
          payload.installmentNumber = Number(form.installmentNumber);
          payload.installmentTotal = Number(form.installmentTotal);
          payload.generateFutureInstallments = form.generateFutureInstallments;
        }
        if (tipo === 'estorno') {
          payload.isRefund = true;
        }
        await api.expenses.create(payload);
        showToast(tipo === 'estorno' ? 'Estorno lançado! Já desconta da fatura.' : 'Gasto lançado!');
      }
      setForm((f) => ({
        ...EMPTY_FORM,
        personId: f.personId,
        paymentMethodId: f.paymentMethodId,
        categoryId: f.categoryId,
      }));
      setShowBillingOverride(false);
      setSplitPeopleIds([]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-muted text-center py-10">Carregando…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Lançar gasto</h1>

      <SegmentedControl options={TIPOS} value={tipo} onChange={setTipo} />

      <form onSubmit={handleSubmit} className="space-y-3">
        <TextField
          label="Descrição"
          placeholder="Ex: feira do mês, netflix, uber…"
          value={form.description}
          onChange={set('description')}
          autoFocus
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={tipo === 'dividida' ? 'Valor total (R$)' : 'Valor (R$)'}
            placeholder="0,00"
            min="0.01"
            value={form.amount}
            onChange={set('amount')}
            required
          />
          <DateField label={tipo === 'fixo' ? 'Primeiro lançamento' : 'Data'} value={form.date} onChange={set('date')} required />
        </div>

        {tipo === 'dividida' ? (
          <PersonPicker label="Dividir entre" people={activePeople} value={splitPeopleIds} onChange={setSplitPeopleIds} multiple />
        ) : (
          <PersonPicker people={activePeople} value={form.personId} onChange={(id) => setForm((f) => ({ ...f, personId: id }))} />
        )}

        {tipo === 'dividida' && splitPeopleIds.length >= 2 && form.amount > 0 && (
          <div className="rounded-xl bg-black/5 dark:bg-white/10 p-3 text-sm space-y-1">
            {loadingPending ? (
              <p className="text-xs text-muted">Calculando rateio…</p>
            ) : (
              splitAmount(
                Number(form.amount),
                activePeople.filter((p) => splitPeopleIds.includes(p.id)),
                pendingByPerson,
              ).map((s) => (
                <div key={s.person.id} className="flex items-center justify-between">
                  <span>
                    {s.person.icon || '👤'} {s.person.name}
                  </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(s.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}

        <SelectField label="Método de pagamento" value={form.paymentMethodId} onChange={set('paymentMethodId')} required>
          <option value="" disabled>
            Selecione
          </option>
          {activePaymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Categoria" value={form.categoryId} onChange={set('categoryId')} required>
          <option value="" disabled>
            Selecione
          </option>
          {activeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        {tipo === 'parcelado' && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Parcela atual"
              min="1"
              step="1"
              value={form.installmentNumber}
              onChange={set('installmentNumber')}
            />
            <NumberField label="Total de parcelas" min="2" step="1" value={form.installmentTotal} onChange={set('installmentTotal')} />
            <label className="col-span-2 flex items-center gap-2 text-sm text-ink2 dark:text-ink2dk">
              <input type="checkbox" checked={form.generateFutureInstallments} onChange={set('generateFutureInstallments')} className="h-4 w-4" />
              Lançar as parcelas futuras automaticamente (mês a mês)
            </label>
          </div>
        )}

        {tipo === 'fixo' && (
          <p className="text-xs text-muted -mt-1">
            Será lançado todo mês no dia {form.date ? Number(form.date.split('-')[2]) : '—'}, a partir de {form.date.split('-').reverse().join('/')}.
          </p>
        )}

        {tipo === 'estorno' && (
          <p className="text-xs -mt-1" style={{ color: '#0ca30c' }}>
            Digite o valor estornado normalmente (positivo) — ele entra como crédito e desconta da fatura desse cartão.
          </p>
        )}

        {tipo !== 'fixo' && (
          <div>
            <label className="flex items-center gap-2 text-sm text-ink2 dark:text-ink2dk">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showBillingOverride}
                onChange={(e) => setShowBillingOverride(e.target.checked)}
              />
              A cobrança vai cair num mês bem diferente da compra
            </label>
            {showBillingOverride && (
              <div className="mt-2">
                <MonthField label="Fatura prevista para" value={form.billingDate} onChange={set('billingDate')} />
                <p className="text-xs text-muted mt-1">
                  Ex: comprou hoje mas a fatura só vem em dezembro. Deixe desmarcado no dia a dia — a maioria dos gastos usa a
                  própria data da compra.
                </p>
              </div>
            )}
          </div>
        )}

        <TextAreaField label="Observações (opcional)" value={form.notes} onChange={set('notes')} />

        <PrimaryButton disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar gasto'}</PrimaryButton>
      </form>
    </div>
  );
}
