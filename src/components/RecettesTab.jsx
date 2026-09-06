import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCocktailRecipes, createCocktailRecipe, updateCocktailRecipe } from '../data/cocktailRecipes';
import { fetchCurrentStock } from '../data/stock';
import { cn, formatQty } from '../lib/utils';
import { PageLoader } from './ui/Spinner';
import ConfirmDialog from './ui/ConfirmDialog';
import { supabase } from '../lib/supabase';

const baseInput = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white';

const Label = ({ children }) => (
  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{children}</label>
);

const SelectOne = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => (
      <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-h-[30px]',
          value === opt ? 'bg-primary text-white border-primary' : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-primary/50'
        )}
      >{opt}</button>
    ))}
  </div>
);

// ── Combobox article ──────────────────────────────────────────

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
    ?? stock.find((s) => s.article_id === value) ?? null;

  useEffect(() => { setQuery(selected ? selected.name : ''); }, [selected]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = filteredStock.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  const stockColor = (qty) => qty <= 0 ? 'text-red-500' : qty <= 5 ? 'text-amber-500' : 'text-green-600';

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input type="text" className={cn(baseInput, 'pr-8')} placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(null); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
      </div>
      {selected && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs', stockColor(Number(selected.quantity)))}>
            Stock : {formatQty(selected.quantity)} {selected.units?.abbreviation}
          </span>
          <button type="button" onClick={() => { onChange(null); setQuery(''); }} className="text-xs text-[var(--color-text-faint)] hover:text-red-400">Effacer</button>
        </div>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s) => (
            <button key={s.article_id} type="button"
              onClick={() => { onChange(s.article_id); setQuery(s.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-warm-50 flex items-center justify-between"
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

// ── Formulaire recette (création + édition) ───────────────────

const emptyRecipe = () => ({
  nom: '', type_carte: '', alcool_article_id: null, verre_article_id: null,
  garnish_article_id: null, glacons: '', dosage: '', service_alcool: '',
  est_premix: '', premix_cl: '', notes: '',
});

const RecipeForm = ({ initial, stock, onSaved, onCancel }) => {
  const [fields, setFields] = useState(initial ?? emptyRecipe());
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!fields.nom.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const payload = {
        ...fields,
        premix_cl: fields.premix_cl !== '' ? Number(fields.premix_cl) : null,
      };
      const recipe = fields.id
        ? await updateCocktailRecipe(fields.id, payload)
        : await createCocktailRecipe(payload);
      onSaved(recipe);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[var(--radius-lg)] shadow-xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        <h2 className="font-display text-xl font-bold text-[var(--color-text)]">
          {fields.id ? 'Modifier la recette' : 'Nouvelle recette'}
        </h2>

        <div><Label>Nom du cocktail *</Label>
          <input className={baseInput} value={fields.nom} onChange={(e) => upd('nom', e.target.value)} placeholder="Ex : Mojito Maison" />
        </div>

        <div><Label>Type</Label>
          <SelectOne options={['Classique', 'Signature']} value={fields.type_carte} onChange={(v) => upd('type_carte', v)} />
        </div>

        <div><Label>Alcool principal</Label>
          <ArticleCombobox stock={stock} value={fields.alcool_article_id} onChange={(v) => upd('alcool_article_id', v)}
            placeholder="Sélectionner…" categoryKeywords={['alcool', 'spiritueux', 'whisky', 'vodka', 'rhum', 'gin', 'tequila', 'liqueur', 'bière', 'vin', 'champagne']} />
        </div>

        <div><Label>Verre</Label>
          <ArticleCombobox stock={stock} value={fields.verre_article_id} onChange={(v) => upd('verre_article_id', v)}
            placeholder="Sélectionner…" categoryKeywords={['verr', 'verre', 'verrerie']} />
        </div>

        <div><Label>Garnish</Label>
          <ArticleCombobox stock={stock} value={fields.garnish_article_id} onChange={(v) => upd('garnish_article_id', v)}
            placeholder="Sélectionner…" categoryKeywords={['garnish', 'garniture', 'déco', 'fruit']} />
        </div>

        <div><Label>Type de glaçons</Label>
          <SelectOne options={['Sans', 'Cube alimentaire', 'Transparent']} value={fields.glacons} onChange={(v) => upd('glacons', v)} />
        </div>

        <div><Label>Dosage alcool</Label>
          <SelectOne options={['2cl', '3cl', '4cl', '5cl', '6cl']} value={fields.dosage} onChange={(v) => upd('dosage', v)} />
        </div>

        <div><Label>Service alcool</Label>
          <SelectOne options={["Bouteille d'origine", 'Carafe', 'Bouteille noire']} value={fields.service_alcool} onChange={(v) => upd('service_alcool', v)} />
        </div>

        <div><Label>Service à la minute ou premix ?</Label>
          <SelectOne options={['À la minute', 'Premix']} value={fields.est_premix} onChange={(v) => upd('est_premix', v)} />
        </div>

        {fields.est_premix === 'Premix' && (
          <div><Label>Quantité premix (en cl)</Label>
            <input className={baseInput} type="number" min="0" step="0.5" value={fields.premix_cl ?? ''}
              onChange={(e) => upd('premix_cl', e.target.value)} placeholder="Ex : 500" />
          </div>
        )}

        <div><Label>Notes</Label>
          <textarea className={cn(baseInput, 'resize-y min-h-[60px]')} value={fields.notes ?? ''} onChange={(e) => upd('notes', e.target.value)} rows={2} />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-[var(--color-border)]">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-[var(--radius-md)] text-sm border border-[var(--color-border)] hover:bg-warm-50 min-h-[40px]">Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 min-h-[40px]">
            {saving ? 'Sauvegarde…' : fields.id ? 'Enregistrer' : 'Créer la recette'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Onglet Recettes ───────────────────────────────────────────

const RecettesTab = () => {
  const [recipes,      setRecipes]      = useState([]);
  const [stock,        setStock]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const load = async () => {
    try {
      const [r, s] = await Promise.all([fetchCocktailRecipes(), fetchCurrentStock()]);
      setRecipes(r);
      setStock(s);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stockName = (id) => stock.find((s) => s.article_id === id)?.name ?? '—';

  const handleSaved = (recipe) => {
    setRecipes((prev) => {
      const exists = prev.find((r) => r.id === recipe.id);
      const next = exists
        ? prev.map((r) => r.id === recipe.id ? recipe : r)
        : [...prev, recipe];
      return next.sort((a, b) => a.nom.localeCompare(b.nom));
    });
    setFormOpen(false);
    setEditTarget(null);
    toast.success(editTarget ? 'Recette mise à jour' : 'Recette créée');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('cocktail_recipes').update({ actif: false }).eq('id', deleteTarget.id);
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Recette archivée');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-muted)]">{recipes.length} recette{recipes.length !== 1 ? 's' : ''}</p>
        <button type="button"
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors min-h-[40px]"
        >
          <Plus size={16} /> Nouvelle recette
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="mb-2">Aucune recette créée.</p>
          <p className="text-sm">Créez vos recettes ici pour garder vos fiches à portée de main.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recipes.map((r) => (
            <div key={r.id}
              className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-[var(--color-text)]">{r.nom}</p>
                  {r.type_carte && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r.type_carte}</span>
                  )}
                  {r.est_premix && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      r.est_premix === 'Premix' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    )}>{r.est_premix}{r.premix_cl ? ` — ${r.premix_cl}cl` : ''}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {r.alcool_article_id  && <span className="text-xs text-[var(--color-text-muted)]">🥃 {stockName(r.alcool_article_id)}</span>}
                  {r.verre_article_id   && <span className="text-xs text-[var(--color-text-muted)]">🥂 {stockName(r.verre_article_id)}</span>}
                  {r.garnish_article_id && <span className="text-xs text-[var(--color-text-muted)]">🍋 {stockName(r.garnish_article_id)}</span>}
                  {r.glacons            && <span className="text-xs text-[var(--color-text-muted)]">🧊 {r.glacons}</span>}
                  {r.dosage             && <span className="text-xs text-[var(--color-text-muted)]">⚗️ {r.dosage}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button"
                  onClick={() => { setEditTarget(r); setFormOpen(true); }}
                  className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-warm-100 hover:text-primary transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Edit2 size={15} />
                </button>
                <button type="button"
                  onClick={() => setDeleteTarget(r)}
                  className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <RecipeForm
          initial={editTarget}
          stock={stock}
          onSaved={handleSaved}
          onCancel={() => { setFormOpen(false); setEditTarget(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archiver la recette ?"
        message={`La recette « ${deleteTarget?.nom} » sera archivée et ne s'affichera plus dans le catalogue.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
};

export default RecettesTab;
