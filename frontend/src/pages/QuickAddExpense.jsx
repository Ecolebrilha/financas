import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { TextField, NumberField, DateField, TextAreaField, SelectField, SegmentedControl, PrimaryButton } from '../components/fields';
import { toInputDate } from '../lib/format';

const TIPOS = [
  { value: 'unico', label: 'Único' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'fixo', label: 'Fixo mensal' },
  { value: 'estorno', label: 'Estorno' },
];

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
    if (!form.description.trim() || !form.amount || !form.personId || !form.paymentMethodId || !form.categoryId) {
      showToast('Preencha descrição, valor, pessoa, método e categoria.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (tipo === 'fixo') {
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
          billingDate: showBillingOverride && form.billingDate ? form.billingDate : undefined,
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
          <NumberField label="Valor (R$)" placeholder="0,00" min="0.01" value={form.amount} onChange={set('amount')} required />
          <DateField label={tipo === 'fixo' ? 'Primeiro lançamento' : 'Data'} value={form.date} onChange={set('date')} required />
        </div>

        <SelectField label="Pessoa" value={form.personId} onChange={set('personId')} required>
          <option value="" disabled>
            Selecione
          </option>
          {activePeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>

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
                <DateField label="Fatura prevista para" value={form.billingDate} onChange={set('billingDate')} />
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
