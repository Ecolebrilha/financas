import { toInputDate } from './format';

// Usado nos 3 lugares que editam um Expense (PersonBreakdown,
// InstallmentsList, Dashboard): quando a data de uma parcela muda,
// pergunta se corrige o mesmo dia do mês nas parcelas futuras do grupo
// também — sem isso, cada parcela futura mantém a data base errada da
// compra original (que foi o motivo da correção), parcela por parcela.
export function confirmGroupDateScope(editing, payload) {
  if (!editing?.installmentGroupId) return undefined;
  if (payload.date === undefined || payload.date === toInputDate(editing.date)) return undefined;
  const applyToFuture = window.confirm(
    'Essa compra faz parte de um parcelamento.\n\nOK = corrigir essa mesma data (dia do mês) nas parcelas futuras também\nCancelar = corrigir só esta parcela',
  );
  return applyToFuture ? 'group' : undefined;
}
