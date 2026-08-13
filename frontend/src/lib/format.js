export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function formatCurrencyCompact(value) {
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
}

// "2026-08" -> "Agosto de 2026"
export function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthShort(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date);
  return label.replace('.', '');
}

export function formatDate(isoOrDate) {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDateShort(isoOrDate) {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date);
}

// Date -> "YYYY-MM-DD" (pra inputs type=date, sempre em UTC)
export function toInputDate(isoOrDate) {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return date.toISOString().slice(0, 10);
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-07-11T00:00:00.000Z", "2026-08-10T23:59:59.999Z" -> "11 jul – 10 ago de 2026"
export function formatPeriodRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dayMonth = (d) => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
    return `${day} ${month}`;
  };
  return `${dayMonth(start)} – ${dayMonth(end)} de ${end.getUTCFullYear()}`;
}

export function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
