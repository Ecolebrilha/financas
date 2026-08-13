import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import { SegmentedControl } from '../components/fields';
import { categoricalColor, CHART_INK, isDarkMode } from '../lib/colors';
import { formatCurrency, formatCurrencyCompact, formatMonthShort } from '../lib/format';

const RANGE_OPTIONS = [
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
];

const TOP_CATEGORIES = 6;

export default function History() {
  const showToast = useToast();
  const [months, setMonths] = useState('12');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const dark = isDarkMode();

  useEffect(() => {
    setLoading(true);
    api.summary
      .history(months)
      .then(setHistory)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const totalsData = useMemo(
    () => history.map((h) => ({ month: formatMonthShort(h.month), Gastos: h.totalExpenses, Receitas: h.totalIncome })),
    [history],
  );

  const { categoryData, topCategoryNames } = useMemo(() => {
    const totalsByCategory = new Map();
    for (const h of history) {
      for (const c of h.byCategory) {
        totalsByCategory.set(c.name, (totalsByCategory.get(c.name) || 0) + c.total);
      }
    }
    const top = [...totalsByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIES)
      .map(([name]) => name);

    const rows = history.map((h) => {
      const row = { month: formatMonthShort(h.month) };
      for (const name of top) {
        const found = h.byCategory.find((c) => c.name === name);
        row[name] = found ? found.total : 0;
      }
      return row;
    });
    return { categoryData: rows, topCategoryNames: top };
  }, [history]);

  const gridColor = dark ? CHART_INK.gridDark : CHART_INK.grid;
  const tickColor = CHART_INK.muted;
  const inkColor = dark ? CHART_INK.primaryDark : CHART_INK.primary;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Histórico</h1>
      <SegmentedControl options={RANGE_OPTIONS} value={months} onChange={setMonths} />

      {loading ? (
        <p className="text-muted text-center py-10">Carregando…</p>
      ) : (
        <>
          <Card title="Gastos x Receitas por mês">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={totalsData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                  <YAxis tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatCurrencyCompact} width={64} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: inkColor }} />
                  <Line type="monotone" dataKey="Gastos" stroke={categoricalColor(7, dark)} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Receitas" stroke={categoricalColor(2, dark)} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Gastos por categoria (top 6)">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                  <YAxis tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatCurrencyCompact} width={64} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: inkColor }} />
                  {topCategoryNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="cat" fill={categoricalColor(i, dark)} radius={i === topCategoryNames.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
