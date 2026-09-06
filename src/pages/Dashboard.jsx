import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Warehouse, CalendarDays, AlertTriangle, TrendingDown,
  Clock, PackageMinus, CheckCircle2, ArrowRight, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchDashboardStats, fetchUpcomingEvents,
  fetchAlertArticles, fetchRecentActivity,
} from '../data/dashboard';
import { fetchSettings } from '../data/settings';
import { withCache } from '../lib/cache';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty, formatDate, formatDateTime } from '../lib/utils';

// ── Carte KPI ─────────────────────────────────────────────────
// Un chiffre de stock se lit avec la date de l'inventaire qui le fonde :
// 34 915 MAD relevés il y a 25 jours ne se lisent pas comme le chiffre d'hier.
const sousTitreInventaire = (stats) => {
  if (!stats?.inventaire_date) return 'aucun inventaire validé';
  // Decoupage manuel plutot que `new Date` : une date seule est interpretee
  // en UTC, et reculerait d'un jour dans tout fuseau derriere Greenwich.
  const [, mois, jourDuMois] = stats.inventaire_date.split('-');
  const jour = `${jourDuMois}/${mois}`;
  const jours = stats.inventaire_jours;
  if (jours === null || jours === undefined) return `inventaire du ${jour}`;
  if (jours === 0) return `inventaire d'aujourd'hui`;
  return `inventaire du ${jour} · ${jours} j`;
};

const KpiCard = ({ icon: Icon, label, value, sub, color, onClick }) => (
  <button
    onClick={onClick}
    className={`
      bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]
      p-5 text-left w-full hover:shadow-md transition-shadow
      ${onClick ? 'cursor-pointer' : 'cursor-default'}
    `}
  >
    <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center mb-3 ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">{label}</p>
    <p className="font-display text-2xl font-bold text-[var(--color-text)] mt-1">{value}</p>
    {sub && <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{sub}</p>}
  </button>
);

// ── Icône action audit ────────────────────────────────────────
const ACTION_LABEL = {
  create:             'Création',
  update:             'Modification',
  delete:             'Suppression',
  validate:           'Validation',
  returns_validated:  'Retours validés',
  withdrawal:         'Prélèvement',
  reorder:            'Réorganisation',
  activate:           'Activation',
  deactivate:         'Désactivation',
  status_change:      'Changement statut',
};

const ENTITY_LABEL = {
  article:   'Article',
  category:  'Catégorie',
  unit:      'Unité',
  inventory: 'Inventaire',
  event:     'Événement',
  user:      'Utilisateur',
};

// ── Page Dashboard ────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [stats,    setStats]    = useState(null);
  const [events,   setEvents]   = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [activity, setActivity] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    try {
      const cfg = await fetchSettings();
      setSettings(cfg);
      const ttl = Number(cfg.dashboard_cache_ttl ?? 120) * 1000;
      const [s, e, a, ac] = await Promise.all([
        force ? fetchDashboardStats()    : withCache('dashboard_stats',    fetchDashboardStats,    ttl),
        force ? fetchUpcomingEvents()    : withCache('dashboard_events',   fetchUpcomingEvents,    ttl),
        force ? fetchAlertArticles()     : withCache('dashboard_alerts',   fetchAlertArticles,     ttl),
        force ? fetchRecentActivity()    : withCache('dashboard_activity', fetchRecentActivity,    ttl),
      ]);
      setStats(s); setEvents(e); setAlerts(a); setActivity(ac);
    } catch (e) {
      toast.error('Erreur de chargement du tableau de bord');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = () => { setRefreshing(true); load(true); };

  const statusIcon = {
    brouillon: <Clock size={14} className="text-yellow-500" />,
    en_cours:  <PackageMinus size={14} className="text-accent" />,
    cloture:   <CheckCircle2 size={14} className="text-green-500" />,
  };

  if (loading) return <PageLoader />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">
            {greeting}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Actualiser"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Warehouse}
          label="Valeur du dépôt"
          value={formatMAD(stats?.depot_value ?? 0)}
          sub={sousTitreInventaire(stats)}
          color="bg-primary"
          onClick={() => navigate('/depot')}
        />
        <KpiCard
          icon={CalendarDays}
          label="Événements en cours"
          value={stats?.events_en_cours ?? 0}
          sub={stats?.events_en_cours === 0 ? 'aucun actif' : 'en cours'}
          color="bg-accent"
          onClick={() => navigate('/evenements')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Articles en alerte"
          value={stats?.articles_alerte ?? 0}
          sub="stock sous le seuil"
          color={stats?.articles_alerte > 0 ? 'bg-orange-500' : 'bg-green-500'}
          onClick={() => navigate('/depot')}
        />
        <KpiCard
          icon={TrendingDown}
          label="Écarts du mois"
          value={formatMAD(stats?.ecarts_mois ?? 0)}
          sub="pertes constatées"
          color={
            (stats?.ecarts_mois ?? 0) >= Number(settings.seuil_ecart_valeur ?? 500)
              ? 'bg-red-500'
              : (stats?.ecarts_mois ?? 0) > 0
              ? 'bg-orange-400'
              : 'bg-green-500'
          }
          onClick={() => navigate('/historique')}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Prochains événements */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">Prochains événements</h2>
            <button onClick={() => navigate('/evenements')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          {events.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-text-faint)]">Aucun événement à venir.</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => navigate('/evenements')}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-warm-50 transition-colors text-left"
                >
                  {statusIcon[ev.status]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{ev.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(ev.date)}{ev.venue && ` · ${ev.venue}`}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Articles en alerte */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">Articles en alerte stock</h2>
            <button onClick={() => navigate('/depot')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Catalogue <ArrowRight size={12} />
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-text-faint)]">
              <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
              Tous les stocks sont suffisants.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {alerts.slice(0, 6).map((a) => (
                <div key={a.article_id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{a.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{a.categories?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent">{formatQty(a.quantity)} {a.units?.abbreviation}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">seuil : {formatQty(a.low_stock_threshold)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">Activité récente</h2>
          <button onClick={() => navigate('/historique')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Historique complet <ArrowRight size={12} />
          </button>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[var(--color-text-faint)]">Aucune activité enregistrée.</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {activity.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-2 h-2 rounded-full bg-primary-200 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)]">
                    <span className="font-medium">{log.users?.full_name ?? '—'}</span>
                    {' · '}
                    <span className="text-[var(--color-text-muted)]">
                      {ACTION_LABEL[log.action] ?? log.action} {ENTITY_LABEL[log.entity] ?? log.entity}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-faint)] flex-shrink-0">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
