import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import QuickAddExpense from './pages/QuickAddExpense';
import Dashboard from './pages/Dashboard';
import ExpensesList from './pages/ExpensesList';
import History from './pages/History';
import Statement from './pages/Statement';
import Config from './pages/Config';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<QuickAddExpense />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/gastos" element={<ExpensesList />} />
        <Route path="/historico" element={<History />} />
        <Route path="/extrato" element={<Statement />} />
        <Route path="/config" element={<Config />} />
      </Route>
    </Routes>
  );
}
