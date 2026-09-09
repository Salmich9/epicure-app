import { useState, useEffect } from 'react';
import { Search, Filter, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAuditLog } from '../data/auditLog';
import { fetchPurchases } from '../data/purchases';
import { PageLoader } from '../components/ui/Spinner';
import { formatDateTime, formatDate, formatMAD, formatQty } from '../lib/utils';

const ENTITIES = ['', 'article', 'category', 'unit', 'inventory', 'purchase',
                  'supplier', 'stock_movement', 'user'];

const ACTION_COLOR = {
  create:   'text-green-600 bg-green-50 border-green-200',
  update:   'text-blue-600 bg-blue-50 border-blue-200',
  delete:   'text-red-600 bg-red-50 border-red-200',
  validate: 'text-primary bg-primary-50 border-primary-200',
  deactivate: 'text-orange-600 bg-orange-50 border-orange-200',
  activate:   'text-green-600 bg-green-50 border-green-200',
  reorder:    'text-purple-600 bg-purple-50 border-purple-200',
};

// ── Les achats ────────────────────────────────────────────────
//
// La page Achats a disparu : la saisie est passée dans le Dépôt, la relecture
// vient ici. Le journal d'audit voisin dit QUI a fait quoi ; ce tableau dit ce
// qui est entré, à quel prix, chez qui.
const AchatsTab = () => {
  const [achats, setAchats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchPurchases(200)
      .then(setAchats)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const filtres = achats.filter((a) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (a.articles?.name ?? '').toLowerCase().includes(s)
        || (a.suppliers?.name ?? '').toLowerCase().includes(s);
  });

  const total = filtres.reduce((s, a) => s + Number(a.total_price ?? 0), 0);

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            className="w-full h-11 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Rechercher un article ou un fournisseur…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {filtres.length > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {filtres.length} achat{filtres.length > 1 ? 's' : ''} · <span className="font-semibold text-primary">{formatMAD(total)}</span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-x-auto">
        {filtres.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-faint)]">
            <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
            Aucun achat enregistré.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Article</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Fournisseur</th>
                <th className="px-4 py-3 text-right">Quantité</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Prix unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((a, idx) => (
                <tr key={a.id} className={`border-b border-[var(--color-border)] last:border-0 ${idx % 2 === 0 ? '' : 'bg-warm-50/30'}`}>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(a.date)}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{a.articles?.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] hidden sm:table-cell">{a.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatQty(a.quantity)} {a.articles?.units?.abbreviation}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">{formatMAD(a.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{formatMAD(a.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const Historique = () => {
  const [tab,       setTab]       = useState('journal');
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [entity,    setEntity]    = useState('');
  const [search,    setSearch]    = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog({
        entity: entity || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo:   dateTo   ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
        limit: 200,
      });
      setLogs(data);
    } catch (e) {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [entity, dateFrom, dateTo]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const payload = JSON.stringify(l.payload ?? '').toLowerCase();
    return (
      l.entity?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      payload.includes(search.toLowerCase())
    );
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-4">Historique</h1>

      <div className="flex gap-1 mb-6 bg-warm-100 p-1 rounded-[var(--radius-md)] w-fit">
        {[{ id: 'journal', label: 'Journal' }, { id: 'achats', label: 'Achats' }].map((o) => (
          <button
            key={o.id}
            onClick={() => setTab(o.id)}
            className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors min-h-[44px] ${
              tab === o.id ? 'bg-white text-primary shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tab === 'achats' && <AchatsTab />}

      {tab === 'journal' && <>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            className="w-full h-11 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="h-11 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ENTITIES.map((e) => <option key={e} value={e}>{e || '— Toutes entités —'}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-11 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none"
          placeholder="Du"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-11 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none"
          placeholder="Au"
        />
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">Aucun événement trouvé.</div>
      ) : (
        <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Qui</th>
                <th className="px-4 py-3 text-left">Entité</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Détail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50/50">
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text)] whitespace-nowrap">
                    {log.users?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{log.entity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLOR[log.action] ?? 'text-[var(--color-text-muted)] bg-warm-100 border-warm-200'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-[var(--color-text-faint)] font-mono truncate max-w-xs block">
                      {log.payload ? JSON.stringify(log.payload).slice(0, 100) : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length >= 200 && (
            <p className="text-center text-xs text-[var(--color-text-faint)] py-3">
              200 entrées affichées — affinez les filtres pour voir plus.
            </p>
          )}
        </div>
      )}
      </>}
    </div>
  );
};

export default Historique;
