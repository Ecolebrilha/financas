// Seletor de pessoa em pills com ícone + cor próprios, pra identificar
// cada pessoa de cara na hora de lançar um gasto (em vez de um <select>
// de texto simples, fácil de confundir entre pessoas parecidas).
export default function PersonPicker({ label = 'Pessoa', people, value, onChange }) {
  return (
    <div>
      <span className="block text-sm font-medium text-ink2 dark:text-ink2dk mb-1">{label}</span>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const active = p.id === value;
          const color = p.color || '#64748b';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border-2 transition-colors ${
                active ? 'text-white' : 'bg-transparent text-ink dark:text-inkdk'
              }`}
              style={{ borderColor: color, backgroundColor: active ? color : 'transparent' }}
            >
              <span className="text-base leading-none">{p.icon || '👤'}</span>
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
