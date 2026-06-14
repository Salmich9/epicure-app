import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit2, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import { fetchArticles, createArticle, updateArticle, deactivateArticle, uploadArticlePhoto } from '../data/articles';
import { fetchCategories } from '../data/categories';
import { fetchUnits } from '../data/units';
import { fetchCurrentStock } from '../data/stock';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Select } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty } from '../lib/utils';

// ── Formulaire d'article ──────────────────────────────────────
const ArticleForm = ({ initial, categories, units, onSave, onClose, loading }) => {
  const [form, setForm] = useState({
    name: '', category_id: '', unit_id: '', type: 'retournable',
    last_purchase_price: '', low_stock_threshold: '', photo_url: '',
    ...initial,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || '');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    if (!form.category_id) { toast.error('Catégorie requise'); return; }
    if (!form.unit_id)     { toast.error('Unité requise'); return; }
    onSave(form, photoFile);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nom de l'article *"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Ex : Vodka Grey Goose 70cl"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Catégorie *" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">— Choisir —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>

        <Select label="Unité *" value={form.unit_id} onChange={(e) => set('unit_id', e.target.value)}>
          <option value="">— Choisir —</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Type *" value={form.type} onChange={(e) => set('type', e.target.value)}>
          <option value="retournable">Retournable</option>
          <option value="consommable">Consommable</option>
        </Select>

        <Input
          label="Dernier prix (MAD)"
          type="number" min="0" step="0.01"
          value={form.last_purchase_price}
          onChange={(e) => set('last_purchase_price', e.target.value)}
          placeholder="0.00"
        />
      </div>

      <Input
        label="Seuil d'alerte stock (optionnel)"
        type="number" min="0" step="0.001"
        value={form.low_stock_threshold}
        onChange={(e) => set('low_stock_threshold', e.target.value)}
        placeholder="Ex : 5"
      />

      {/* Photo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]">Photo (optionnel)</label>
        <div className="flex items-center gap-3">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="w-16 h-16 rounded-lg object-cover border border-[var(--color-border)]" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-warm-100 flex items-center justify-center border border-[var(--color-border)]">
              <Image size={20} className="text-[var(--color-text-faint)]" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-warm-100 transition-colors">
              <Image size={14} /> Choisir
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {initial?.id ? 'Enregistrer' : 'Ajouter l\'article'}
        </Button>
      </div>
    </form>
  );
};

// ── Page Catalogue ────────────────────────────────────────────
const Catalogue = () => {
  const { user } = useAuth();
  const canCreate = usePermission('articles.create');
  const canUpdate = usePermission('articles.update');
  const canDelete = usePermission('articles.delete');

  const [articles,   setArticles]   = useState([]);
  const [stock,      setStock]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [units,      setUnits]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAlert,setFilterAlert]= useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stockMap = useMemo(() => {
    const m = {};
    stock.forEach((s) => { m[s.article_id] = s; });
    return m;
  }, [stock]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s, c, u] = await Promise.all([
        fetchArticles(),
        fetchCurrentStock(),
        fetchCategories(true),
        fetchUnits(true),
      ]);
      setArticles(a);
      setStock(s);
      setCategories(c);
      setUnits(u);
    } catch (e) {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filtre + groupement par catégorie
  const grouped = useMemo(() => {
    const filtered = articles.filter((a) => {
      if (search     && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat  && a.category_id !== filterCat)  return false;
      if (filterType && a.type        !== filterType)  return false;
      if (filterAlert) {
        const s = stockMap[a.id];
        const qty = Number(s?.quantity ?? 0);
        if (a.low_stock_threshold == null || qty > Number(a.low_stock_threshold)) return false;
      }
      return true;
    });
    const map = {};
    filtered.forEach((a) => {
      const catId = a.category_id;
      if (!map[catId]) map[catId] = { cat: a.categories, items: [] };
      map[catId].items.push(a);
    });
    return Object.values(map).sort((a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99));
  }, [articles, search, filterCat, filterType, filterAlert, stockMap]);

  const handleSave = async (form, photoFile) => {
    setSaving(true);
    try {
      const fields = {
        name:                form.name.trim(),
        category_id:         form.category_id,
        unit_id:             form.unit_id,
        type:                form.type,
        last_purchase_price: parseFloat(form.last_purchase_price) || 0,
        low_stock_threshold: form.low_stock_threshold ? parseFloat(form.low_stock_threshold) : null,
      };

      if (editTarget?.id) {
        // Mise à jour
        if (photoFile) {
          fields.photo_url = await uploadArticlePhoto(photoFile, editTarget.id);
        }
        await updateArticle(editTarget.id, fields, user.id);
        toast.success('Article mis à jour');
      } else {
        // Création (upload photo après pour avoir l'ID)
        const newArt = await createArticle({ ...fields, photo_url: null }, user.id);
        if (photoFile) {
          const url = await uploadArticlePhoto(photoFile, newArt.id);
          await updateArticle(newArt.id, { photo_url: url }, user.id);
        }
        toast.success('Article ajouté');
      }
      setModalOpen(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deactivateArticle(deleteTarget.id, user.id);
      toast.success('Article supprimé (archivé)');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Catalogue</h1>
        {canCreate && (
          <Button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="gap-2"
          >
            <Plus size={18} /> Ajouter
          </Button>
        )}
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            className="w-full h-11 pl-9 pr-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Rechercher un article…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Filtre catégorie */}
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-9 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Filtre type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">Tous les types</option>
            <option value="retournable">Retournable</option>
            <option value="consommable">Consommable</option>
          </select>

          {/* Filtre alerte stock */}
          <button
            onClick={() => setFilterAlert((v) => !v)}
            className={`h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filterAlert
                ? 'bg-accent text-white border-accent'
                : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-warm-100'
            }`}
          >
            ⚠ En alerte
          </button>

          {/* Reset */}
          {(filterCat || filterType || filterAlert) && (
            <button
              onClick={() => { setFilterCat(''); setFilterType(''); setFilterAlert(false); }}
              className="h-9 px-3 rounded-[var(--radius-md)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Articles groupés par catégorie */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          {search ? 'Aucun résultat pour cette recherche.' : 'Aucun article dans le catalogue.'}
        </div>
      ) : (
        grouped.map(({ cat, items }) => (
          <section key={cat?.id ?? 'uncategorized'} className="mb-8">
            <h2 className="font-display text-lg font-semibold text-primary mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
              {cat?.name ?? '—'}
              <span className="text-sm font-normal text-[var(--color-text-faint)] font-sans">({items.length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a) => {
                const s = stockMap[a.id];
                const qty = s?.quantity ?? 0;
                const isLow = a.low_stock_threshold != null && qty <= a.low_stock_threshold;
                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 flex gap-3 hover:shadow-sm transition-shadow"
                  >
                    {/* Photo */}
                    <div className="flex-shrink-0">
                      {a.photo_url ? (
                        <img src={a.photo_url} alt={a.name} className="w-14 h-14 rounded-lg object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-warm-100 flex items-center justify-center">
                          <Image size={20} className="text-[var(--color-text-faint)]" />
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text)] text-sm leading-snug truncate">{a.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{a.units?.name}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={a.type}>{a.type}</Badge>
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          {formatMAD(a.last_purchase_price)}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 font-medium ${isLow ? 'text-accent' : 'text-[var(--color-text-muted)]'}`}>
                        Stock : {formatQty(qty)} {a.units?.abbreviation}
                        {isLow && ' ⚠'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {canUpdate && (
                        <button
                          onClick={() => { setEditTarget(a); setModalOpen(true); }}
                          className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Modal ajout / modification */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        title={editTarget ? 'Modifier l\'article' : 'Ajouter un article'}
        size="md"
      >
        <ArticleForm
          initial={editTarget}
          categories={categories}
          units={units}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          loading={saving}
        />
      </Modal>

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer l'article ?"
        message={`"${deleteTarget?.name}" sera archivé (l'historique est conservé).`}
        confirmLabel="Supprimer"
        danger
        loading={deleting}
      />
    </div>
  );
};

export default Catalogue;
