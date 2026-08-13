const inputClass =
  'w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-400 dark:text-white';

function Wrapper({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink2 dark:text-ink2dk mb-1">{label}</span>
      {children}
    </label>
  );
}

export function TextField({ label, ...props }) {
  return (
    <Wrapper label={label}>
      <input type="text" className={inputClass} {...props} />
    </Wrapper>
  );
}

export function NumberField({ label, ...props }) {
  return (
    <Wrapper label={label}>
      <input type="number" inputMode="decimal" step="0.01" className={inputClass} {...props} />
    </Wrapper>
  );
}

export function DateField({ label, ...props }) {
  return (
    <Wrapper label={label}>
      <input type="date" className={inputClass} {...props} />
    </Wrapper>
  );
}

export function TextAreaField({ label, ...props }) {
  return (
    <Wrapper label={label}>
      <textarea className={inputClass} rows={2} {...props} />
    </Wrapper>
  );
}

export function SelectField({ label, children, ...props }) {
  return (
    <Wrapper label={label}>
      <select className={inputClass} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="grid rounded-xl bg-black/5 dark:bg-white/10 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
            value === opt.value ? 'bg-surface dark:bg-surfacedk shadow text-ink dark:text-inkdk' : 'text-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="submit"
      className={`w-full rounded-xl bg-blue-600 text-white font-semibold py-3 text-base active:scale-[0.99] disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
