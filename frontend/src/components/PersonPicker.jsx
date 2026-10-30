// Seletor de pessoa em pills com ícone + cor próprios, pra identificar
// cada pessoa de cara na hora de lançar um gasto (em vez de um <select>
// de texto simples, fácil de confundir entre pessoas parecidas).
//
// Com `multiple`, `value` é um array de ids em vez de um id só, e cada
// toque liga/desliga aquela pessoa na seleção (usado em despesa dividida,
// pra marcar entre quem o valor vai ser rateado).
export default function PersonPicker({ label = 'Pessoa', people, value, onChange, multiple = false }) {
  function isActive(p) {
    return multiple ? value.includes(p.id) : p.id === value;
  }

  function handleClick(p) {
    if (!multiple) return onChange(p.id);
    onChange(value.includes(p.id) ? value.filter((id) => id !== p.id) : [...value, p.id]);
  }

  return (
    <div>
      <span className="block text-sm font-medium text-ink2 dark:text-ink2dk mb-1">{label}</span>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const active = isActive(p);
          const color = p.color || '#64748b';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleClick(p)}
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
