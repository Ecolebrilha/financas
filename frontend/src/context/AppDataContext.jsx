import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [people, setPeople] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c, pm] = await Promise.all([
        api.people.list({ includeInactive: true }),
        api.categories.list({ includeInactive: true }),
        api.paymentMethods.list({ includeInactive: true }),
      ]);
      setPeople(p);
      setCategories(c);
      setPaymentMethods(pm);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      people,
      categories,
      paymentMethods,
      activePeople: people.filter((p) => p.active),
      activeCategories: categories.filter((c) => c.active),
      activePaymentMethods: paymentMethods.filter((pm) => pm.active),
      loading,
      error,
      reload,
    }),
    [people, categories, paymentMethods, loading, error, reload],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData precisa estar dentro de <AppDataProvider>');
  return ctx;
}
