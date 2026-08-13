// Todas as datas são tratadas como "dia civil" em UTC (meia-noite UTC),
// evitando problemas de fuso horário para uma aplicação de uso local.

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampDay(year, monthIndex, day) {
  return Math.min(day, daysInMonth(year, monthIndex));
}

function startOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function endOfMonthExclusive(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 1));
}

// "YYYY-MM" -> { year, monthIndex, start, end }
function parseMonthParam(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const year = y;
  const monthIndex = m - 1;
  return {
    year,
    monthIndex,
    start: startOfMonth(year, monthIndex),
    end: endOfMonthExclusive(year, monthIndex),
  };
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  return monthKey(new Date());
}

// "2026-08" + 1 -> "2026-09"
function shiftMonthKey(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  result.setUTCDate(clampDay(result.getUTCFullYear(), result.getUTCMonth(), day));
  return result;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// Data de vencimento da fatura em que uma compra feita em `date` vai cair,
// dado o dia de vencimento do cartão. Assume-se que a fatura fecha no
// próprio dia do vencimento (não temos o dia de fechamento exato de cada
// cartão): compra até o dia do vencimento (inclusive) cai na fatura deste
// mês; depois disso, cai na fatura do mês seguinte.
function dueDateOnOrAfter(date, dueDay) {
  if (!dueDay) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const monthIndex = d.getUTCMonth();
  const day = d.getUTCDate();
  const dueDayThisMonth = clampDay(year, monthIndex, dueDay);
  if (day <= dueDayThisMonth) {
    return new Date(Date.UTC(year, monthIndex, dueDayThisMonth));
  }
  const nextMonth = addMonths(startOfMonth(year, monthIndex), 1);
  const nextYear = nextMonth.getUTCFullYear();
  const nextMonthIndex = nextMonth.getUTCMonth();
  return new Date(Date.UTC(nextYear, nextMonthIndex, clampDay(nextYear, nextMonthIndex, dueDay)));
}

// Último dia útil (segunda a sexta) do mês — não considera feriados, só
// fins de semana.
function lastBusinessDayOfMonth(year, monthIndex) {
  const day = daysInMonth(year, monthIndex);
  const date = new Date(Date.UTC(year, monthIndex, day));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

// Dia de corte usado pelo Painel mensal pra agrupar por "período de
// fatura" em vez de mês civil — bate com o ciclo que o usuário usa na
// maioria dos cartões (vence dia 10). Um "período" rotulado como
// YYYY-MM vai do dia 11 do mês anterior até o dia 10 do próprio mês
// (ambos inclusive), o mesmo corte usado em invoiceDueDateForExpense.
const PRIMARY_CYCLE_DAY = 10;

// "YYYY-MM" -> { year, monthIndex, start, end } representando o período
// de fatura (dia 11 do mês anterior até dia 10 do mês, inclusive).
function invoicePeriodForMonthParam(monthStr, cutoffDay = PRIMARY_CYCLE_DAY) {
  const [y, m] = monthStr.split('-').map(Number);
  const year = y;
  const monthIndex = m - 1;
  const end = new Date(Date.UTC(year, monthIndex, cutoffDay + 1));
  const prevMonthStart = addMonths(startOfMonth(year, monthIndex), -1);
  const start = new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth(), cutoffDay + 1));
  return { year, monthIndex, start, end };
}

module.exports = {
  daysInMonth,
  clampDay,
  startOfMonth,
  endOfMonthExclusive,
  parseMonthParam,
  monthKey,
  currentMonthKey,
  shiftMonthKey,
  addMonths,
  sameDay,
  lastBusinessDayOfMonth,
  invoiceDueDateForExpense: dueDateOnOrAfter,
  nextDueDate: dueDateOnOrAfter,
  PRIMARY_CYCLE_DAY,
  invoicePeriodForMonthParam,
};
