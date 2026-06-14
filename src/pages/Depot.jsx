import { useState, useEffect, useMemo } from 'react';
import { Warehouse, Image, TrendingDown, Search, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCurrentStock, fetchArticleMovements } from '../data/stock';
import { PageLoader } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { formatMAD, formatQty, formatDateTime } from '../lib/utils';

const TYPE_LABEL = {
  inventaire_initial: 'Inventaire initial',
  ajustement:         'Ajustement',
  achat:              'Achat',
  prelevement:        'Prélèvement',
  retour:             'Retour',
  perte:              'Perte',
};

const TYPE_COLOR = {
  inventaire_initial: 'text-blue-500',
  ajustement:         'text-purple-500',
  achat:              'text-green-500',
  prelevement:        'text-accent',
  retour:             'text-green-500',
  perte:              'text-red-500',
};

// ── Panneau mouvements ────────────────────────────────────────
const MovementsPanel = ({ article, onClose }) => {
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!article) return;
    setLoading(true);
    fetchArticleMovements(article.article_id)
      .then(setMovements)
      .catch(() => toast.error('Erreur'))
      .finally(() => setLoading(false));
  }, [article?.article_id]);

  if (!article) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl flex flex-col z-50">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <p className="font-semibold text-[var(--color-text)]">{article.name}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Stock actuel : <span className="font-medium">{formatQty(article.quantity)} {article.units?.abbreviation}</span>
              {' · '}{formatMAD(article.stock_value)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* Mouvements */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-border)]">
            10 derniers mouvements
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-center py-12 text-sm text-[var(--color-text-faint)]">Aucun mouvement enregistré.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {movements.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                  <div className={`text-xs font-semibold mt-0.5 w-24 flex-shrink-0 ${TYPE_COLOR[m.type] ?? 'text-[var(--color-text-muted)]'}`}>
                    {TYPE_LABEL[m.type] ?? m.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${Number(m.quantity) >= 0 ? 'text-green-600' : 'text-accent'}`}>
                      {Number(m.quantity) >= 0 ? '+' : ''}{formatQty(m.quantity)} {article.units?.abbreviation}
                    </p>
                    {m.event_name && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{m.event_name}</p>
                    )}
                    {m.note && (
                      <p className="text-xs text-[var(--color-text-faint)] truncate">{m.note}</p>
                    )}
                    <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                      {m.users?.full_name} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Page Dépôt ────────────────────────────────────────────────
const Depot = () => {
  const [stock,     setStock]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    fetchCurrentStock()
      .then(setStock)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const seen = new Set();
    return stock
      .filter((s) => s.active && s.categories)
      .map((s) => s.categories)
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
  }, [stock]);

  const grouped = useMemo(() => {
    const map = {};
    stock
      .filter((s) => {
        if (!s.active) return false;
        if (search    && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterCat && s.category_id !== filterCat) return false;
        return true;
      })
      .forEach((s) => {
        const catId = s.category_id;
        if (!map[catId]) map[catId] = { cat: s.categories, items: [] };
        map[catId].items.push(s);
      });
    return Object.values(map).sort(
      (a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99)
    );
  }, [stock, search, filterCat]);

  const totalValue = useMemo(
    () => stock.filter((s) => s.active).reduce((sum, s) => sum + Number(s.stock_value ?? 0), 0),
    [stock]
  );

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Dépôt</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Stock physique en temps réel</p>
        </div>
        <div className="bg-primary text-white rounded-[var(--radius-lg)] px-6 py-4 shadow-md">
          <p className="text-white/60 text-xs uppercase tracking-wider font-medium">Valeur totale</p>
          <p className="font-display text-3xl font-bold mt-1">{formatMAD(totalValue)}</p>
        </div>
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            className="w-full h-11 pl-9 pr-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Rechercher un article…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="h-11 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tableau par catégorie */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          Aucun article correspondant.
        </div>
      ) : (
        grouped.map(({ cat, items }) => {
          const catValue = items.reduce((s, i) => s + Number(i.stock_value ?? 0), 0);
          return (
            <section key={cat?.id ?? 'x'} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                  {cat?.name ?? '—'}
                  <span className="text-sm font-normal text-[var(--color-text-faint)] font-sans">({items.length})</span>
                </h2>
                <span className="text-sm font-medium text-[var(--color-text-muted)]">{formatMAD(catValue)}</span>
              </div>

              <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Article</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                      <th className="px-4 py-3 text-right">Quantité</th>
                      <th className="px-4 py-3 text-right hidden md:table-cell">Prix unit.</th>
                      <th className="px-4 py-3 text-right">Valeur</th>
                      <th className="px-4 py-3 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isLow = item.low_stock_threshold != null && Number(item.quantity) <= Number(item.low_stock_threshold);
                      return (
                        <tr
                          key={item.article_id}
                          className={`border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-warm-50/30'}`}
                          onClick={() => setSelected(item)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {item.photo_url ? (
                                <img src={item.photo_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-warm-100 flex items-center justify-center flex-shrink-0">
                                  <Image size={12} className="text-[var(--color-text-faint)]" />
                                </div>
                              )}
                              <span className="font-medium text-[var(--color-text)]">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant={item.type}>{item.type}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${isLow ? 'text-accent' : 'text-[var(--color-text)]'}`}>
                              {formatQty(item.quantity)}
                            </span>
                            <span className="text-xs text-[var(--color-text-faint)] ml-1">{item.units?.abbreviation}</span>
                            {isLow && <TrendingDown size={12} className="inline ml-1 text-accent" />}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">
                            {formatMAD(item.last_purchase_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--color-text)]">
                            {formatMAD(item.stock_value)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronRight size={14} className="text-[var(--color-text-faint)]" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <MovementsPanel article={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Depot;
