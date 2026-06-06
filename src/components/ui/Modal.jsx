import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const Modal = ({ open, onClose, title, children, size = 'md', className }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full bg-white rounded-[var(--radius-lg)] shadow-xl',
          'animate-in fade-in slide-in-from-bottom-4 duration-200',
          widths[size],
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">{title}</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-warm-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        {/* Body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
