import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown } from 'lucide-react';

/**
 * Champ de recherche avec liste déroulante et création à la volée.
 *
 * Il existait trois copies quasi identiques de ce composant — articles et
 * fournisseurs dans Achats, articles dans les recettes. Elles divergeaient
 * déjà : seule celle des recettes savait filtrer par famille. Trois copies,
 * c'est trois endroits où corriger le même défaut, et deux qu'on oublie.
 *
 * `getSecondary` rend la mention grise à droite d'une ligne — l'unité pour un
 * article, le téléphone pour un fournisseur. Optionnel : ce qui n'a rien à
 * dire n'affiche rien.
 *
 * `allowEmpty` ajoute une entrée « aucun » en tête. Un fournisseur peut
 * légitimement manquer ; un article, jamais.
 */
const Combobox = ({
  label,
  items,
  value,
  onChange,
  onRequestCreate,
  placeholder = 'Rechercher…',
  emptyLabel = 'Aucun résultat.',
  allowEmpty = false,
  emptyOptionLabel = '— Aucun —',
  getSecondary = null,
  required = false,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Le libellé suit `value` quand il change de l'extérieur — après une
  // création à la volée, par exemple.
  useEffect(() => {
    const found = items.find((i) => i.id === value);
    setQuery(found ? found.name : '');
  }, [value, items]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

  // Un nom déjà pris ne se recrée pas. La comparaison ignore la casse et les
  // espaces de bord, comme le fait `enregistrer_achat` côté base : les deux
  // doivent s'accorder, sinon l'app propose « Créer » là où la base réutilise.
  const exact = items.some((i) => i.name.trim().toLowerCase() === q);
  const showCreate = Boolean(onRequestCreate) && q.length > 0 && !exact;

  const choisir = (item) => { onChange(item); setQuery(item.name); setOpen(false); };

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--color-text)]">
          {label}{required && ' *'}
        </label>
      )}
      <div className="relative">
        <input
          className="w-full h-11 pl-3 pr-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />

        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg max-h-56 overflow-y-auto">
            {allowEmpty && (
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-faint)] hover:bg-warm-50 italic"
                onMouseDown={(e) => { e.preventDefault(); onChange(null); setQuery(''); setOpen(false); }}
              >
                {emptyOptionLabel}
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <p className="px-4 py-3 text-sm text-[var(--color-text-faint)]">{emptyLabel}</p>
            )}

            {filtered.map((item) => {
              const secondaire = getSecondary?.(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-warm-50 flex items-center justify-between gap-3"
                  onMouseDown={(e) => { e.preventDefault(); choisir(item); }}
                >
                  <span className="font-medium text-[var(--color-text)]">{item.name}</span>
                  {secondaire && (
                    <span className="text-xs text-[var(--color-text-faint)] flex-shrink-0">{secondaire}</span>
                  )}
                </button>
              );
            })}

            {showCreate && (
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-primary font-medium hover:bg-primary-50 border-t border-[var(--color-border)] flex items-center gap-2"
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); onRequestCreate(query.trim()); }}
              >
                <Plus size={14} />
                Créer «{query.trim()}»
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Combobox;
