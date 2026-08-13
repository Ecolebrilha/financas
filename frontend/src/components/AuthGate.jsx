import { useEffect, useState } from 'react';
import { setAuthToken } from '../api/client';

// Só aparece quando a API responde 401 (senha configurada em produção e
// ainda não informada, ou errada) — em dev local, sem senha configurada
// no backend, isso nunca acontece e a tela nem chega a existir.
export default function AuthGate({ children }) {
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    const onUnauthorized = () => setLocked(true);
    window.addEventListener('financas:unauthorized', onUnauthorized);
    return () => window.removeEventListener('financas:unauthorized', onUnauthorized);
  }, []);

  if (!locked) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setAuthToken(input.trim());
    // Recarrega pra refazer do zero todas as buscas de dados já com a
    // senha certa no header, em vez de tentar reencaixar retries manuais.
    window.location.reload();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page dark:bg-pagedk px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <h1 className="text-xl font-bold text-center mb-1">Finanças</h1>
        <p className="text-sm text-muted text-center mb-3">Digite a senha pra continuar.</p>
        <input
          type="password"
          autoFocus
          placeholder="Senha"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
        />
        <button type="submit" className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 text-base active:scale-[0.99]">
          Entrar
        </button>
      </form>
    </div>
  );
}
