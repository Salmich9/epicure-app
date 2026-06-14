import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit2, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import { fetchArticles, deactivateArticle } from '../data/articles';
import { fetchCategories } from '../data/categories';
import { fetchCurrentStock } from '../data/stock';
import ArticleFormModal from '../components/ArticleFormModal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty } from '../lib/utils';

// ── Page Catalogue ────────────────────────────────────────────
const Catalogue = () => {
  const { user } = useAuth();
  const canCreate = usePermission('articles.create');
  const canUpdate = usePermission('articles.update');
  const canDelete = usePermission('articles.delete');

  const [articles,     setArticles]     = useState([]);
  const [stock,        setStock]        = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterCat,    setFilterCat]    = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterAlert,  setFilterAlert]  = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const stockMap = useMemo(() => {
    const m = {};
    stock.forEach((s) => { m[s.article_id] = s; });
    return m;
  }, [stock]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s, c] = await Promise.all([fetchArticles(), fetchCurrentStock(), fetchCategories(true)]);
      setArticles(a);
      setStock(s);
      setCategories(c);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

      <ArticleFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onCreated={() => { setModalOpen(false); setEditTarget(null); load(); }}
        initial={editTarget}
      />

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
