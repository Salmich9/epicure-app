import { useState, useEffect, useMemo } from 'react';
import { Warehouse, Image, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCurrentStock } from '../data/stock';
import { PageLoader } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { formatMAD, formatQty } from '../lib/utils';

const Depot = () => {
  const [stock,   setStock]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentStock()
      .then(setStock)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    stock
      .filter((s) => s.active)
      .forEach((s) => {
        const catId = s.category_id;
        if (!map[catId]) map[catId] = { cat: s.categories, items: [] };
        map[catId].items.push(s);
      });
    return Object.values(map).sort(
      (a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99)
    );
  }, [stock]);

  const totalValue = useMemo(
    () => stock.filter((s) => s.active).reduce((sum, s) => sum + Number(s.stock_value ?? 0), 0),
    [stock]
  );

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* En-tête + valeur totale */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Dépôt</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Stock physique en temps réel</p>
        </div>
        <div className="bg-primary text-white rounded-[var(--radius-lg)] px-6 py-4 shadow-md">
          <p className="text-white/60 text-xs uppercase tracking-wider font-medium">Valeur totale du dépôt</p>
          <p className="font-display text-3xl font-bold mt-1">{formatMAD(totalValue)}</p>
        </div>
      </div>

      {/* Tableau par catégorie */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          Aucun article actif dans le dépôt.
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
                <span className="text-sm font-medium text-[var(--color-text-muted)]">
                  {formatMAD(catValue)}
                </span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isLow = item.low_stock_threshold != null && Number(item.quantity) <= Number(item.low_stock_threshold);
                      return (
                        <tr
                          key={item.article_id}
                          className={`border-b border-[var(--color-border)] last:border-0 ${idx % 2 === 0 ? '' : 'bg-warm-50/50'}`}
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
                            <span className="text-xs text-[var(--color-text-faint)] ml-1">
                              {item.units?.abbreviation}
                            </span>
                            {isLow && <TrendingDown size={12} className="inline ml-1 text-accent" />}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">
                            {formatMAD(item.last_purchase_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--color-text)]">
                            {formatMAD(item.stock_value)}
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
    </div>
  );
};

export default Depot;
