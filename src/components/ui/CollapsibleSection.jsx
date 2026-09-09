import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Une famille d'articles, repliable.
 *
 * POURQUOI. 36 articles répartis en 19 familles, soit deux par famille : le
 * chrome de chaque section — titre, en-tête de tableau, marge — coûte à peu
 * près autant que son contenu. D'où un dépôt de 4 000 px pour très peu de
 * données. Replié, tout tient sur un écran.
 *
 * CONTRÔLÉ, PAS AUTONOME. Le parent détient l'état, via `useOpenSections`.
 * S'il le gardait pour lui, une recherche ne pourrait pas forcer l'ouverture
 * des sections qui ont des résultats — et la recherche paraîtrait cassée alors
 * qu'elle trouve, mais dans des sections repliées.
 *
 * `ChevronDown` ET NON `ChevronRight` : ce dernier signifie déjà « ouvrir la
 * fiche article » sur chaque ligne du Dépôt. Deux sens pour une icône sur le
 * même écran, c'est un piège.
 *
 * PAS D'ANIMATION D'OUVERTURE, ET C'EST UNE DÉCISION MESURÉE.
 *
 * La technique habituelle — `grid-template-rows: 0fr → 1fr` avec une
 * transition — a été essayée puis retirée : elle ne fonctionne pas. Mesuré
 * dans le navigateur, deux grilles identiques, l'une avec la transition et
 * l'autre sans, basculées de `0fr` à `1fr` :
 *
 *     avec transition   →  0 px, définitivement
 *     sans transition   →  400 px
 *
 * Interpoler vers `1fr` demande un espace libre défini ; une grille en hauteur
 * automatique n'en a pas, donc la valeur reste figée à zéro. Sur Chrome 152 —
 * donc a fortiori sur le Safari iOS où cette app vit.
 *
 * Le contenu replié n'est donc pas monté du tout. Deux bénéfices en prime :
 * les ~36 champs de comptage de l'Inventaire ne re-rendent plus à chaque
 * frappe quand leur famille est fermée, et il n'y a plus de champ invisible
 * atteignable au clavier — donc pas besoin d'`inert`.
 */
const CollapsibleSection = ({
  title,
  count,
  aside,
  open,
  onToggle,
  sticky = false,
  emptyLabel = 'Rien dans cette famille.',
  children,
  className,
}) => {
  // Un accordéon qui s'ouvre sur rien est une promesse trahie : une section
  // vide s'affiche, mais ne se déplie pas et ne prétend pas être un bouton.
  if (count === 0) {
    return (
      <section className={cn('mb-3', className)}>
        <div className="flex items-center gap-2 px-1 py-2 text-[var(--color-text-faint)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-border)] inline-block flex-shrink-0" />
          <span className="font-display text-lg font-semibold">{title}</span>
          <span className="text-sm font-sans ml-auto">{emptyLabel}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={cn('mb-3', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'w-full min-h-touch flex items-center gap-2 px-1 py-2 text-left rounded-[var(--radius-sm)]',
          'hover:bg-warm-50 transition-colors',
          sticky && 'sticky top-0 z-10 bg-[var(--color-bg)]',
        )}
      >
        <ChevronDown
          size={16}
          className={cn(
            'text-[var(--color-text-muted)] transition-transform duration-200 flex-shrink-0',
            'motion-reduce:transition-none',
            !open && '-rotate-90',
          )}
        />
        <span className="w-2 h-2 rounded-full bg-accent inline-block flex-shrink-0" />
        <span className="font-display text-lg font-semibold text-primary truncate">{title}</span>
        <span className="text-sm font-normal text-[var(--color-text-faint)] font-sans flex-shrink-0">
          ({count})
        </span>
        {aside != null && (
          <span className="ml-auto text-sm font-medium text-[var(--color-text-muted)] flex-shrink-0">
            {aside}
          </span>
        )}
      </button>

      {open && <div className="mt-2">{children}</div>}
    </section>
  );
};

export default CollapsibleSection;
