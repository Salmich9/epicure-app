import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchBriefing, saveBriefingAnswers } from '../../data/briefing';
import { fetchCurrentStock } from '../../data/stock';
import { cn, formatQty } from '../../lib/utils';
import { PageLoader } from '../ui/Spinner';

const baseInput = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white';

const Label = ({ children }) => (
  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{children}</label>
);

const Field = ({ label, children, col }) => (
  <div className={col}><Label>{label}</Label>{children}</div>
);

const SelectOne = ({ options, value, onChange, small }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => (
      <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
        className={cn(
          'border transition-colors',
          small ? 'px-2.5 py-1 rounded-full text-xs font-medium min-h-[28px]' : 'px-3 py-2 rounded-full text-sm font-medium min-h-[36px]',
          value === opt ? 'bg-primary text-white border-primary' : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-primary/50'
        )}
      >{opt}</button>
    ))}
  </div>
);

// ── Combobox article avec stock live ─────────────────────────
// categoryKeywords : tableau de mots-clés pour filtrer par nom de catégorie (insensible à la casse)
// Ex : ['alcool', 'spiritueux'] → affiche uniquement les articles dont la catégorie contient ces mots

const ArticleCombobox = ({ stock, value, onChange, placeholder, categoryKeywords }) => {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  const filteredStock = categoryKeywords?.length
    ? stock.filter((s) => {
        const cat = (s.categories?.name ?? '').toLowerCase();
        return categoryKeywords.some((kw) => cat.includes(kw.toLowerCase()));
      })
    : stock;

  const selected = filteredStock.find((s) => s.article_id === value)
    ?? stock.find((s) => s.article_id === value)  // fallback si hors catégorie
    ?? null;

  useEffect(() => {
    setQuery(selected ? selected.name : '');
  }, [selected]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = filteredStock.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20);

  const stockColor = (qty) => {
    if (qty <= 0) return 'text-red-500';
    if (qty <= 5) return 'text-amber-500';
    return 'text-green-600';
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input type="text" className={cn(baseInput, 'pr-8')} placeholder={placeholder ?? 'Rechercher un article…'}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(null); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
      </div>
      {selected && (
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs font-medium', stockColor(Number(selected.quantity)))}>
            Stock : {formatQty(selected.quantity)} {selected.units?.abbreviation}
          </span>
          <button type="button" onClick={() => { onChange(null); setQuery(''); }} className="text-xs text-[var(--color-text-faint)] hover:text-red-400">Effacer</button>
        </div>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((s) => (
            <button key={s.article_id} type="button"
              onClick={() => { onChange(s.article_id); setQuery(s.name); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-warm-50 transition-colors flex items-center justify-between"
            >
              <span className="font-medium truncate">{s.name}</span>
              <span className={cn('text-xs ml-2 flex-shrink-0', stockColor(Number(s.quantity)))}>
                {formatQty(s.quantity)} {s.units?.abbreviation}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Ligne cocktail ────────────────────────────────────────────

const emptycocktail = () => ({
  id: crypto.randomUUID(),
  type_carte: '',         // Classique | Signature
  article_id: null,       // alcool principal
  nom_custom: '',         // si pas dans catalogue
  verre_id: null,
  glacons: '',
  garnish_id: null,
  dosage: '',             // 2cl 3cl 4cl 5cl 6cl
  service_alcool: '',     // bouteille d'origine | carafe | bouteille noire
  nb_servis: '',
  est_premix: '',         // Oui | Non
  premix_litres: '',
  premix_service: '',
  facturation_alcool: '',
  facturation_garnish: '',
  shots_prevus: '',       // Oui | Non
});

const emptyShot = () => ({
  id: crypto.randomUUID(),
  lie_cocktail: '',       // Oui | Non
  cocktail_ref_id: '',    // id du cocktail lié
  article_id: null,
  dosage: '',
  nb_servis: '',
  facturation: '',
});

const ENTITES = ['Epicure Catering', 'Central Bistro', 'Business Boys', 'KPI Gestion', 'Espèces'];
const DOSAGES = ['2cl', '3cl', '4cl', '5cl', '6cl'];
const SERVICES_ALCOOL = ["Bouteille d'origine", 'Carafe', 'Bouteille noire'];
const GLACONS_OPTS = ['Sans', 'Cube alimentaire', 'Transparent'];

// ── Ligne cocktail UI ─────────────────────────────────────────

const CocktailRow = ({ index, cocktail, stock, onChange, onRemove, canRemove }) => {
  const upd = (k, v) => onChange({ ...cocktail, [k]: v });
  const nb_adultes_hint = ''; // sera injecté depuis answers si besoin

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex flex-col gap-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Cocktail {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-[var(--color-text-faint)] hover:text-red-400 p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Type">
          <SelectOne options={['Classique', 'Signature']} value={cocktail.type_carte} onChange={(v) => upd('type_carte', v)} small />
        </Field>
        <Field label="Alcool principal">
          <ArticleCombobox stock={stock} value={cocktail.article_id} onChange={(v) => upd('article_id', v)} placeholder="Sélectionner l'alcool…" categoryKeywords={['alcool', 'spiritueux', 'whisky', 'vodka', 'rhum', 'gin', 'tequila', 'liqueur', 'bière', 'vin', 'champagne']} />
        </Field>
        <Field label="Nom / intitulé carte">
          <input className={baseInput} value={cocktail.nom_custom} onChange={(e) => upd('nom_custom', e.target.value)} placeholder="Ex : Mojito Maison, Signature Sunset…" />
        </Field>
        <Field label="Verre">
          <ArticleCombobox stock={stock} value={cocktail.verre_id} onChange={(v) => upd('verre_id', v)} placeholder="Sélectionner le verre…" categoryKeywords={['verr', 'verre', 'verrerie', 'glass']} />
        </Field>
        <Field label="Glaçons">
          <SelectOne options={GLACONS_OPTS} value={cocktail.glacons} onChange={(v) => upd('glacons', v)} small />
        </Field>
        <Field label="Garnish">
          <ArticleCombobox stock={stock} value={cocktail.garnish_id} onChange={(v) => upd('garnish_id', v)} placeholder="Sélectionner le garnish…" categoryKeywords={['garnish', 'garniture', 'déco', 'deco', 'fruit', 'herbe']} />
        </Field>
        <Field label="Dosage alcool">
          <SelectOne options={DOSAGES} value={cocktail.dosage} onChange={(v) => upd('dosage', v)} small />
        </Field>
        <Field label="Service alcool">
          <SelectOne options={SERVICES_ALCOOL} value={cocktail.service_alcool} onChange={(v) => upd('service_alcool', v)} small />
        </Field>
        <Field label="Nombre de cocktails servis">
          <input className={baseInput} type="number" min="0" value={cocktail.nb_servis} onChange={(e) => upd('nb_servis', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Shots prévus ?">
          <SelectOne options={['Oui', 'Non']} value={cocktail.shots_prevus} onChange={(v) => upd('shots_prevus', v)} small />
        </Field>
      </div>

      {/* Facturation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border)]">
        <Field label="Facturation alcool">
          <SelectOne options={ENTITES} value={cocktail.facturation_alcool} onChange={(v) => upd('facturation_alcool', v)} small />
        </Field>
        <Field label="Facturation garnish">
          <SelectOne options={ENTITES} value={cocktail.facturation_garnish} onChange={(v) => upd('facturation_garnish', v)} small />
        </Field>
      </div>

      {/* Premix */}
      <div className="pt-2 border-t border-[var(--color-border)] flex flex-col gap-3">
        <Field label="Service à la minute ou premix ?">
          <SelectOne options={['À la minute', 'Premix']} value={cocktail.est_premix} onChange={(v) => upd('est_premix', v)} small />
        </Field>
        {cocktail.est_premix === 'Premix' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 border-l-2 border-primary/20">
            <Field label="Litres à produire">
              <input className={baseInput} type="number" min="0" step="0.1" value={cocktail.premix_litres} onChange={(e) => upd('premix_litres', e.target.value)} placeholder="Ex : 5" />
            </Field>
            <Field label="Mode de service premix">
              <SelectOne options={['Ready service', 'Carafe', 'Bouteille noire']} value={cocktail.premix_service} onChange={(v) => upd('premix_service', v)} small />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Ligne shot UI ─────────────────────────────────────────────

const ShotRow = ({ index, shot, stock, cocktails, onChange, onRemove, canRemove }) => {
  const upd = (k, v) => onChange({ ...shot, [k]: v });

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex flex-col gap-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Shot {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-[var(--color-text-faint)] hover:text-red-400 p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <Field label="Lié à un cocktail du menu ?">
        <SelectOne options={['Oui', 'Non — indépendant']} value={shot.lie_cocktail} onChange={(v) => upd('lie_cocktail', v)} small />
      </Field>

      {shot.lie_cocktail === 'Oui' && cocktails.length > 0 && (
        <Field label="Quel cocktail ?">
          <div className="flex flex-wrap gap-1.5">
            {cocktails.map((c) => (
              <button key={c.id} type="button"
                onClick={() => upd('cocktail_ref_id', shot.cocktail_ref_id === c.id ? '' : c.id)}
                className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px]',
                  shot.cocktail_ref_id === c.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-[var(--color-border)] hover:border-amber-400'
                )}
              >
                {c.nom_custom || 'Cocktail ' + (cocktails.indexOf(c) + 1)}
              </button>
            ))}
          </div>
        </Field>
      )}

      {shot.lie_cocktail === 'Non — indépendant' && (
        <Field label="Article (alcool shot)">
          <ArticleCombobox stock={stock} value={shot.article_id} onChange={(v) => upd('article_id', v)} placeholder="Sélectionner l'alcool…" categoryKeywords={['alcool', 'spiritueux', 'whisky', 'vodka', 'rhum', 'gin', 'tequila', 'liqueur']} />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Dosage">
          <SelectOne options={DOSAGES} value={shot.dosage} onChange={(v) => upd('dosage', v)} small />
        </Field>
        <Field label="Nombre de shots">
          <input className={baseInput} type="number" min="0" value={shot.nb_servis} onChange={(e) => upd('nb_servis', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Facturation">
          <SelectOne options={ENTITES} value={shot.facturation} onChange={(v) => upd('facturation', v)} small />
        </Field>
      </div>
    </div>
  );
};

// ── Panel par bar ─────────────────────────────────────────────

const BarMenuPanel = ({ barIndex, stock, cocktails, shots, onCocktailsChange, onShotsChange }) => {
  const addCocktail = () => {
    if (cocktails.length >= 8) { toast.error('Maximum 8 cocktails par bar'); return; }
    onCocktailsChange([...cocktails, emptycocktail()]);
  };

  const addShot = () => onShotsChange([...shots, emptyShot()]);

  const updateCocktail = (idx, val) => {
    const next = [...cocktails]; next[idx] = val; onCocktailsChange(next);
  };
  const removeCocktail = (idx) => onCocktailsChange(cocktails.filter((_, i) => i !== idx));

  const updateShot = (idx, val) => {
    const next = [...shots]; next[idx] = val; onShotsChange(next);
  };
  const removeShot = (idx) => onShotsChange(shots.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-6">

      {/* Cocktails */}
      <section className="bg-warm-50 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display text-sm font-semibold text-[var(--color-text)]">
            Cocktails <span className="text-[var(--color-text-faint)] font-normal text-xs">({cocktails.length}/8)</span>
          </h4>
          <button type="button" onClick={addCocktail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors min-h-[32px]"
          >
            <Plus size={13} /> Ajouter un cocktail
          </button>
        </div>

        {cocktails.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)] text-center py-4">Aucun cocktail ajouté.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cocktails.map((c, i) => (
              <CocktailRow key={c.id} index={i} cocktail={c} stock={stock}
                onChange={(val) => updateCocktail(i, val)}
                onRemove={() => removeCocktail(i)}
                canRemove={cocktails.length > 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Shots */}
      <section className="bg-warm-50 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display text-sm font-semibold text-[var(--color-text)]">Shots</h4>
          <button type="button" onClick={addShot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors min-h-[32px]"
          >
            <Plus size={13} /> Ajouter un shot
          </button>
        </div>

        {shots.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)] text-center py-4">Aucun shot prévu.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {shots.map((s, i) => (
              <ShotRow key={s.id} index={i} shot={s} stock={stock} cocktails={cocktails}
                onChange={(val) => updateShot(i, val)}
                onRemove={() => removeShot(i)}
                canRemove={shots.length > 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ── Composant principal Section 3 ─────────────────────────────

const BriefingSection3 = ({ eventId }) => {
  const [answers,    setAnswers]    = useState({});
  const [stock,      setStock]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [activeBar,  setActiveBar]  = useState(0);

  // cocktails[barIndex] = array, shots[barIndex] = array
  const [cocktailsByBar, setCocktailsByBar] = useState({});
  const [shotsByBar,     setShotsByBar]     = useState({});

  useEffect(() => {
    Promise.all([fetchBriefing(eventId), fetchCurrentStock()])
      .then(([ans, stk]) => {
        setAnswers(ans);
        setStock(stk);

        // Désérialise cocktails et shots depuis event_briefing
        const cb = {}, sb = {};
        const nb = Math.min(5, Math.max(1, parseInt(ans.nb_bars ?? '1') || 1));
        for (let i = 0; i < nb; i++) {
          try { cb[i] = JSON.parse(ans[`bar_${i + 1}_cocktails`] ?? '[]'); } catch { cb[i] = []; }
          try { sb[i] = JSON.parse(ans[`bar_${i + 1}_shots`]    ?? '[]'); } catch { sb[i] = []; }
        }
        setCocktailsByBar(cb);
        setShotsByBar(sb);
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const nbBars = Math.min(5, Math.max(1, parseInt(answers.nb_bars ?? '1') || 1));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...answers };
      for (let i = 0; i < nbBars; i++) {
        payload[`bar_${i + 1}_cocktails`] = JSON.stringify(cocktailsByBar[i] ?? []);
        payload[`bar_${i + 1}_shots`]     = JSON.stringify(shotsByBar[i]     ?? []);
      }
      await saveBriefingAnswers(eventId, payload);
      toast.success('Section 3 sauvegardée');
    } catch (e) {
      toast.error(e.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const barTabs = Array.from({ length: nbBars }, (_, i) => `Bar ${i + 1}`);

  return (
    <div className="flex flex-col gap-4">

      {/* Tabs par bar */}
      {nbBars > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {barTabs.map((label, i) => (
            <button key={i} type="button" onClick={() => setActiveBar(i)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex-shrink-0 min-h-[36px]',
                activeBar === i ? 'bg-primary text-white border-primary' : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-primary/40'
              )}
            >{label}</button>
          ))}
        </div>
      )}

      {nbBars === 0 && (
        <div className="text-sm text-[var(--color-text-faint)] text-center py-8">
          Configurez d'abord le nombre de bars dans la Section 2.
        </div>
      )}

      {nbBars > 0 && (
        <BarMenuPanel
          barIndex={activeBar}
          stock={stock}
          cocktails={cocktailsByBar[activeBar] ?? []}
          shots={shotsByBar[activeBar] ?? []}
          onCocktailsChange={(val) => setCocktailsByBar((p) => ({ ...p, [activeBar]: val }))}
          onShotsChange={(val) => setShotsByBar((p) => ({ ...p, [activeBar]: val }))}
        />
      )}

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          <Save size={16} />
          {saving ? 'Sauvegarde…' : 'Sauvegarder la section 3'}
        </button>
      </div>
    </div>
  );
};

export default BriefingSection3;
