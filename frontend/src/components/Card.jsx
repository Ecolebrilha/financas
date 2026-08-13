export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={`bg-surface dark:bg-surfacedk rounded-2xl border border-black/5 dark:border-white/10 p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold text-ink2 dark:text-ink2dk uppercase tracking-wide">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
