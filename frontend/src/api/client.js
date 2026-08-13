const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // resposta sem corpo JSON
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export const api = {
  people: {
    list: (params) => request(`/people${qs(params)}`),
    create: (data) => request('/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/people/${id}`, { method: 'DELETE' }),
  },
  categories: {
    list: (params) => request(`/categories${qs(params)}`),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  paymentMethods: {
    list: (params) => request(`/payment-methods${qs(params)}`),
    create: (data) => request('/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/payment-methods/${id}`, { method: 'DELETE' }),
  },
  expenses: {
    list: (params) => request(`/expenses${qs(params)}`),
    get: (id) => request(`/expenses/${id}`),
    create: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id, params) => request(`/expenses/${id}${qs(params)}`, { method: 'DELETE' }),
    settle: (id, settled) => request(`/expenses/${id}/settle`, { method: 'PUT', body: JSON.stringify({ settled }) }),
  },
  incomes: {
    list: (params) => request(`/incomes${qs(params)}`),
    create: (data) => request('/incomes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/incomes/${id}`, { method: 'DELETE' }),
  },
  recurring: {
    list: (params) => request(`/recurring${qs(params)}`),
    create: (data) => request('/recurring', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),
    materialize: (month) => request('/recurring/materialize', { method: 'POST', body: JSON.stringify({ month }) }),
  },
  recurringIncomes: {
    list: (params) => request(`/recurring-incomes${qs(params)}`),
    create: (data) => request('/recurring-incomes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/recurring-incomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/recurring-incomes/${id}`, { method: 'DELETE' }),
    materialize: (month) => request('/recurring-incomes/materialize', { method: 'POST', body: JSON.stringify({ month }) }),
  },
  payments: {
    list: (params) => request(`/payments${qs(params)}`),
    create: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/payments/${id}`, { method: 'DELETE' }),
  },
  summary: {
    get: (month) => request(`/summary${qs({ month })}`),
    history: (months) => request(`/summary/history${qs({ months })}`),
  },
};
