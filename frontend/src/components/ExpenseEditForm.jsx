import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { TextField, NumberField, DateField, TextAreaField, SelectField, PrimaryButton } from './fields';
import { toInputDate } from '../lib/format';

export default function ExpenseEditForm({ expense, onSave, onCancel, saving }) {
  const { activePeople, activeCategories, activePaymentMethods } = useAppData();
  const [form, setForm] = useState({
    description: expense.description,
    amount: String(Math.abs(expense.amount)),
    isRefund: expense.amount < 0,
    date: toInputDate(expense.date),
    personId: expense.personId,
    paymentMethodId: expense.paymentMethodId,
    categoryId: expense.categoryId,
    notes: expense.notes || '',
    installmentNumber: expense.installmentNumber || '',
    installmentTotal: expense.installmentTotal || '',
    billingDate: expense.billingDate ? toInputDate(expense.billingDate) : '',
  });

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      description: form.description.trim(),
      amount: Number(form.amount),
      isRefund: form.isRefund,
      date: form.date,
      personId: form.personId,
      paymentMethodId: form.paymentMethodId,
      categoryId: form.categoryId,
      notes: form.notes || null,
      installmentNumber: form.installmentNumber ? Number(form.installmentNumber) : null,
      installmentTotal: form.installmentTotal ? Number(form.installmentTotal) : null,
      billingDate: form.billingDate || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextField label="Descrição" value={form.description} onChange={set('description')} required />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Valor (R$)" min="0.01" value={form.amount} onChange={set('amount')} required />
        <DateField label="Data" value={form.date} onChange={set('date')} required />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink2 dark:text-ink2dk">
        <input type="checkbox" checked={form.isRefund} onChange={set('isRefund')} className="h-4 w-4" />
        É um estorno (desconta da fatura em vez de somar)
      </label>
      <SelectField label="Pessoa" value={form.personId} onChange={set('personId')} required>
        {activePeople.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Método de pagamento" value={form.paymentMethodId} onChange={set('paymentMethodId')} required>
        {activePaymentMethods.map((pm) => (
          <option key={pm.id} value={pm.id}>
            {pm.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Categoria" value={form.categoryId} onChange={set('categoryId')} required>
        {activeCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {expense.installmentGroupId && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Parcela atual" min="1" step="1" value={form.installmentNumber} onChange={set('installmentNumber')} />
          <NumberField label="Total de parcelas" min="1" step="1" value={form.installmentTotal} onChange={set('installmentTotal')} />
        </div>
      )}
      <div>
        <DateField label="Fatura prevista para (opcional)" value={form.billingDate} onChange={set('billingDate')} />
        <p className="text-xs text-muted mt-1">
          Só preencha se a cobrança real vai cair num mês bem diferente da data da compra (ex: comprou hoje mas a fatura só
          vem em dezembro). Deixe em branco pra usar a data da compra normalmente.
        </p>
      </div>
      <TextAreaField label="Observações" value={form.notes} onChange={set('notes')} />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-black/10 dark:border-white/15 py-3 font-medium">
          Cancelar
        </button>
        <PrimaryButton className="flex-1" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </PrimaryButton>
      </div>
    </form>
  );
}
