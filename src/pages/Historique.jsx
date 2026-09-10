import { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, CalendarDays, Warehouse, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAuditLog } from '../data/auditLog';
import { fetchPurchases } from '../data/purchases';
import { fetchEcartsParEvenement, fetchEcartsArticles } from '../data/events';
import { fetchInventoriesValidees } from '../data/inventory';
import BarresValeurs from '../components/ui/BarresValeurs';
import { PageLoader } from '../components/ui/Spinner';
import { formatDateTime, formatDate, formatMAD, formatQty, cn } from '../lib/utils';

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

// ── Les écarts, par événement ─────────────────────────────────
//
// `v_evenements` existe depuis la migration 026 et n'était lue NULLE PART.
// Elle rend déjà une ligne par événement avec l'écart valorisé, le taux de
// retour et le nombre d'articles concernés. Cet onglet ne calcule donc rien —
// et c'est ce qui garantit qu'il affiche le MÊME montant que la page de
// l'événement, dont la valorisation vient d'être alignée sur le coût moyen.
//
// UN ÉVÉNEMENT NON CLÔTURÉ N'A PAS D'ÉCART. Il a des retours non saisis : la
// vue calcule prélevé moins retourné, donc tout ce qui est sorti et pas encore
// rentré. Afficher « 12 400 MAD » pour un événement en cours ferait paniquer
// pour rien. D'où un badge, et pas un montant.
const EcartsTab = () => {
  const [lignes,  setLignes]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [ouvert,  setOuvert]  = useState(null);   // event_id déplié
  const [detail,  setDetail]  = useState({});     // event_id → lignes articles

  useEffect(() => {
    fetchEcartsParEvenement()
      .then(setLignes)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const deplier = async (id) => {
    if (ouvert === id) { setOuvert(null); return; }
    setOuvert(id);
    if (detail[id]) return;
    try {
      const d = await fetchEcartsArticles(id);
      setDetail((p) => ({ ...p, [id]: d }));
    } catch { toast.error('Erreur de chargement du détail'); }
  };

  const clos   = lignes.filter((l) => l.statut === 'cloture');
  const total  = clos.reduce((s, l) => s + Number(l.valeur_ecart ?? 0), 0);

  if (loading) return <PageLoader />;

  if (lignes.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-[var(--color-text-faint)]">
        <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
        Aucun événement enregistré.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4 px-1">
        <span className="text-sm text-[var(--color-text-muted)]">
          {clos.length} événement{clos.length > 1 ? 's' : ''} clôturé{clos.length > 1 ? 's' : ''}
        </span>
        <span className="text-sm">
          Écart cumulé : <span className="font-semibold text-red-600">{formatMAD(total)}</span>
        </span>
      </div>

      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        {lignes.map((l) => {
          const enCours = l.statut !== 'cloture';
          const estOuvert = ouvert === l.event_id;
          return (
            <div key={l.event_id} className="border-b border-[var(--color-border)] last:border-0">
              <button
                onClick={() => deplier(l.event_id)}
                aria-expanded={estOuvert}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-50 min-h-touch"
              >
                <ChevronDown
                  size={15}
                  className={cn('text-[var(--color-text-faint)] flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                                !estOuvert && '-rotate-90')}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{l.evenement}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    {formatDate(l.date_evenement)}
                    {l.articles_concernes > 0 && ` · ${l.articles_concernes} article${l.articles_concernes > 1 ? 's' : ''}`}
                    {l.taux_retour_pct != null && ` · ${l.taux_retour_pct}% retourné`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {enCours ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-warm-100 text-[var(--color-text-muted)] border border-[var(--color-border)]">
                      en cours
                    </span>
                  ) : Number(l.valeur_ecart) > 0 ? (
                    <span className="text-sm font-semibold text-red-600">{formatMAD(l.valeur_ecart)}</span>
                  ) : (
                    <span className="text-sm text-green-600">✓ aucun écart</span>
                  )}
                </div>
              </button>

              {estOuvert && (
                <div className="px-4 pb-3 bg-warm-50/40">
                  {!detail[l.event_id] ? (
                    <p className="text-xs text-[var(--color-text-faint)] py-3">Chargement…</p>
                  ) : detail[l.event_id].filter((a) => Number(a.ecart) > 0).length === 0 ? (
                    <p className="text-xs text-[var(--color-text-faint)] py-3">
                      Tout est revenu — {detail[l.event_id].length} référence{detail[l.event_id].length > 1 ? 's' : ''} prélevée{detail[l.event_id].length > 1 ? 's' : ''}.
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--color-text-muted)] uppercase tracking-wide">
                          <th className="py-2 text-left">Article</th>
                          <th className="py-2 text-right">Écart</th>
                          <th className="py-2 text-right">Valeur</th>
                          <th className="py-2 text-left pl-3">Motif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail[l.event_id].filter((a) => Number(a.ecart) > 0).map((a) => (
                          <tr key={a.article_id} className="border-t border-[var(--color-border)]">
                            <td className="py-1.5 pr-2">
                              <span className="font-medium text-[var(--color-text)]">{a.article}</span>
                              {a.categorie && <span className="text-[var(--color-text-faint)]"> · {a.categorie}</span>}
                            </td>
                            <td className="py-1.5 text-right text-red-600 whitespace-nowrap">
                              −{formatQty(a.ecart)} {a.unite}
                            </td>
                            <td className="py-1.5 text-right font-medium text-red-600 whitespace-nowrap">
                              {formatMAD(a.valeur_ecart)}
                            </td>
                            <td className="py-1.5 pl-3 text-[var(--color-text-muted)]">{a.motifs || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── La valeur du dépôt, inventaire après inventaire ───────────
//
// `total_value` et `signed_at` étaient DÉJÀ chargés par `fetchInventories()` et
// n'étaient affichés pour aucune archive. La variation, elle, se calcule ici :
// c'est une différence entre deux lignes voisines, ce qu'une fonction de
// fenêtrage SQL saurait faire mais qui n'a pas sa place dans une vue lue par
// ailleurs pour d'autres raisons.
const InventairesTab = () => {
  const [lignes,  setLignes]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoriesValidees()
      .then(setLignes)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  // Ordre croissant en entrée : la variation se lit dans le sens du temps.
  const avecVariation = useMemo(() => lignes.map((l, i) => {
    const prec = i > 0 ? Number(lignes[i - 1].total_value ?? 0) : null;
    const val  = Number(l.total_value ?? 0);
    return {
      ...l,
      variation: prec == null ? null : val - prec,
      // Pas de pourcentage à partir de zéro : une division par zéro affichée
      // « +Infinity % » vaut moins qu'un tiret.
      variationPct: prec == null || prec === 0 ? null : ((val - prec) / prec) * 100,
    };
  }), [lignes]);

  const points = useMemo(() => avecVariation.map((l) => ({
    id: l.id,
    valeur: Number(l.total_value ?? 0),
    label: `${l.label} · ${formatDate(l.date)}`,
    abrege: l.date ? l.date.slice(8, 10) + '/' + l.date.slice(5, 7) : '—',
  })), [avecVariation]);

  if (loading) return <PageLoader />;

  if (lignes.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-[var(--color-text-faint)]">
        <Warehouse size={32} className="mx-auto mb-3 opacity-30" />
        Aucun inventaire validé — le premier fera le point de départ.
      </div>
    );
  }

  const dernier = avecVariation[avecVariation.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4 px-1">
        <span className="text-sm text-[var(--color-text-muted)]">
          {lignes.length} inventaire{lignes.length > 1 ? 's' : ''}
        </span>
        <span className="text-sm">
          Dernier comptage : <span className="font-semibold text-primary">{formatMAD(dernier.total_value)}</span>
        </span>
      </div>

      <BarresValeurs points={points} />

      {/* Du plus récent au plus ancien pour la lecture, l'inverse du graphique :
          une table se parcourt en commençant par ce qui vient de se passer. */}
      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Inventaire</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Responsable</th>
              <th className="px-4 py-3 text-right">Valeur</th>
              <th className="px-4 py-3 text-right">Variation</th>
            </tr>
          </thead>
          <tbody>
            {[...avecVariation].reverse().map((l) => (
              <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50/50">
                <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                  {l.label}
                  {l.status === 'archive' && (
                    <span className="ml-2 text-xs text-[var(--color-text-faint)]">archivé</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] hidden sm:table-cell">
                  {l.responsible_name || l.users?.full_name || '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                  {formatMAD(l.total_value)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {l.variation == null ? (
                    <span className="text-xs text-[var(--color-text-faint)]">référence</span>
                  ) : (
                    <span className={l.variation >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {l.variation >= 0 ? '+' : '−'}{formatMAD(Math.abs(l.variation))}
                      {l.variationPct != null && (
                        <span className="block text-xs opacity-70">
                          {l.variationPct >= 0 ? '+' : '−'}{Math.abs(l.variationPct).toFixed(1)} %
                        </span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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

// ── Le journal d'audit ────────────────────────────────────────
//
// Était un fragment inline dans le composant parent, qui portait donc son état
// de chargement, ses quatre filtres et son rendu — plus les onglets. Avec deux
// onglets de plus, le parent devenait un fichier où l'on cherche. Chaque
// onglet est désormais autonome, sur le modèle de `Parametres.jsx` : il charge
// ce dont il a besoin, quand on l'ouvre, et pas avant.
const JournalTab = () => {
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [entity,   setEntity]   = useState('');
  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    fetchAuditLog({
      entity: entity || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo:   dateTo   ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
      limit: 200,
    })
      .then((d) => { if (vivant) setLogs(d); })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => { if (vivant) setLoading(false); });
    return () => { vivant = false; };
  }, [entity, dateFrom, dateTo]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const payload = JSON.stringify(l.payload ?? '').toLowerCase();
    return (
      l.entity?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      l.users?.full_name?.toLowerCase().includes(s) ||
      payload.includes(s)
    );
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
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
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-11 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-base sm:text-sm focus:outline-none"
        />
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">Aucune entrée trouvée.</div>
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────

const ONGLETS = [
  { id: 'ecarts',       label: 'Écarts' },
  { id: 'inventaires',  label: 'Inventaires' },
  { id: 'achats',       label: 'Achats' },
  { id: 'journal',      label: 'Journal' },
];

const Historique = () => {
  // Les écarts d'abord : c'est la question qu'on se pose en ouvrant cette page,
  // et le journal d'audit ne se consulte qu'en cas de doute.
  const [tab, setTab] = useState('ecarts');

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-4">Historique</h1>

      {/* La barre défile horizontalement sur téléphone plutôt que de passer à
          la ligne : quatre onglets sur deux lignes déplacent le contenu vers
          le bas à chaque changement. */}
      <div className="flex gap-1 mb-5 bg-warm-100 p-1 rounded-[var(--radius-md)] overflow-x-auto no-scrollbar">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setTab(o.id)}
            className={cn(
              'px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap flex-shrink-0',
              tab === o.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tab === 'ecarts'      && <EcartsTab />}
      {tab === 'inventaires' && <InventairesTab />}
      {tab === 'achats'      && <AchatsTab />}
      {tab === 'journal'     && <JournalTab />}
    </div>
  );
};

export default Historique;
