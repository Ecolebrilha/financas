import { formatMonthLabel, shiftMonthKey } from '../lib/format';
import { IconChevronLeft, IconChevronRight } from './icons';

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="flex items-center justify-between bg-surface dark:bg-surfacedk rounded-2xl border border-black/5 dark:border-white/10 px-2 py-2">
      <button
        type="button"
        aria-label="Mês anterior"
        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <IconChevronLeft />
      </button>
      <span className="font-semibold">{formatMonthLabel(month)}</span>
      <button
        type="button"
        aria-label="Próximo mês"
        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <IconChevronRight />
      </button>
    </div>
  );
}
