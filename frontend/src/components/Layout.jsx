import { NavLink, Outlet } from 'react-router-dom';
import { IconPlus, IconDashboard, IconList, IconTrend, IconMore } from './icons';

const TABS = [
  { to: '/', label: 'Lançar', icon: IconPlus, end: true },
  { to: '/dashboard', label: 'Painel', icon: IconDashboard },
  { to: '/gastos', label: 'Gastos', icon: IconList },
  { to: '/historico', label: 'Histórico', icon: IconTrend },
  { to: '/config', label: 'Mais', icon: IconMore },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-page dark:bg-pagedk flex flex-col">
      <main className="flex-1 pb-20 max-w-2xl w-full mx-auto px-4 pt-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface dark:bg-surfacedk border-t border-black/10 dark:border-white/10 safe-bottom z-20">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 text-xs ${isActive ? '' : 'text-muted'}`}
              style={({ isActive }) => (isActive ? { color: '#2a78d6' } : undefined)}
            >
              <Icon width={20} height={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
