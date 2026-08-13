import { formatPeriodRange, shiftMonthKey } from '../lib/format';
import { IconChevronLeft, IconChevronRight } from './icons';

// Navegador do Painel mensal: em vez de mês civil, mostra o período de
// fatura que o usuário realmente usa (dia 11 do mês anterior até dia 10
// do mês), calculado pelo backend e vindo pronto em `period`.
export default function PeriodPicker({ month, onChange, period }) {
  return (
    <div className="flex items-center justify-between bg-surface dark:bg-surfacedk rounded-2xl border border-black/5 dark:border-white/10 px-2 py-2">
      <button
        type="button"
        aria-label="Período anterior"
        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <IconChevronLeft />
      </button>
      <div className="text-center leading-tight">
        <span className="font-semibold block">{period ? formatPeriodRange(period.start, period.end) : '…'}</span>
        <span className="text-[11px] text-muted">período da fatura (dia 11 a dia 10)</span>
      </div>
      <button
        type="button"
        aria-label="Próximo período"
        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <IconChevronRight />
      </button>
    </div>
  );
}
