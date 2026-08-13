import { IconClose } from './icons';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface dark:bg-surfacedk rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Fechar">
            <IconClose width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
