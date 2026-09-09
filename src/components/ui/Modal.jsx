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
      {/* Panneau.
          `max-h-[85svh]` + colonne flex + corps scrollable : sans ça, un
          contenu plus haut que l'écran déborde PAR LE HAUT — on est en
          `items-end` sur mobile — hors de tout conteneur scrollable. Le
          formulaire d'achat fait ~750 px : sur un écran de 667, son titre et
          son premier champ étaient inatteignables.

          `svh` et non `dvh` : `dvh` grandit quand la barre d'URL de Safari se
          rétracte, et le panneau sauterait pendant le défilement. La petite
          hauteur, elle, ne bouge jamais. */}
      <div
        className={cn(
          'relative z-10 w-full bg-white rounded-[var(--radius-lg)] shadow-xl',
          'max-h-[85svh] flex flex-col',
          widths[size],
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
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
        {/* Corps. `overscroll-contain` empêche le défilement de se propager à
            la page derrière une fois arrivé en bout de course. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
