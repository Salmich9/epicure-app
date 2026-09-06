import { useState, useEffect, useMemo, useCallback } from 'react';
import { Image, TrendingDown, Search, X, ChevronRight, Plus, Pencil, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import {
  fetchDepotEvolution, fetchDepotDecomposition,
  fetchInventaireCouverture, fetchArticleMovements,
} from '../data/stock';
import { fetchArticles, deactivateArticle } from '../data/articles';
import { fetchSuppliers } from '../data/purchases';
import PurchaseModal from '../components/PurchaseModal';
import ArticleFormModal from '../components/ArticleFormModal';
import { PageLoader } from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
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

const jourMois = (iso) => {
  if (!iso) return null;
  // Découpage manuel : `new Date('2026-09-06')` est interprété en UTC et
  // reculerait d'un jour dans tout fuseau derrière Greenwich.
  const [, m, j] = iso.split('-');
  return `${j}/${m}`;
};

// ── L'en-tête : la valeur, et d'où elle vient ─────────────────
//
// Jamais le chiffre nu. Un total sans son origine ne répond pas à la seule
// question qu'on se pose en le lisant : quelle part repose sur des yeux, et
// quelle part sur de la paperasse ?
const Entete = ({ evo, couverture }) => {
  if (!evo) return null;

  const postes = [
    { k: 'valeur_achats',       signe: '+', mot: 'achetés' },
    { k: 'valeur_prelevements', signe: '−', mot: 'sortis' },
    { k: 'valeur_retours',      signe: '+', mot: 'rentrés' },
    { k: 'valeur_ajustements',  signe: '±', mot: 'ajustés' },
    { k: 'valeur_pertes',       signe: '−', mot: 'perdus' },
  ].filter((p) => Number(evo[p.k]) !== 0);

  const date = jourMois(evo.inventaire_date);
  const nonComptes = Number(couverture?.non_comptes_avec_stock ?? 0);

  return (
    <div className="bg-primary text-white rounded-[var(--radius-lg)] px-6 py-5 shadow-md max-w-md">
      <p className="text-white/60 text-xs uppercase tracking-wider font-medium">Valeur du dépôt</p>
      <p className="font-display text-4xl font-bold mt-1">{formatMAD(evo.valeur_totale)}</p>

      <p className="text-white/75 text-sm mt-2 leading-relaxed">
        {date ? (
          <>
            <span className="font-medium">{formatMAD(evo.valeur_comptee)}</span> comptés le {date}
            {postes.map((p) => (
              <span key={p.k}>
                {' · '}{p.signe} {formatMAD(Math.abs(Number(evo[p.k])))} {p.mot}
              </span>
            ))}
          </>
        ) : (
          <>Aucun inventaire validé — ce chiffre ne repose que sur les mouvements saisis.</>
        )}
      </p>

      {/* Un contrôle qui ne tombe pas juste doit se voir, pas se taire. */}
      {Number(evo.controle) !== 0 && (
        <p className="mt-2 text-xs bg-white/15 rounded px-2 py-1 inline-flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Écart de contrôle : {formatMAD(evo.controle)} — signalez-le.
        </p>
      )}

      {nonComptes > 0 && (
        <p className="mt-2 text-xs text-white/70">
          {nonComptes} article{nonComptes > 1 ? 's' : ''} non compté{nonComptes > 1 ? 's' : ''} au
          dernier inventaire {nonComptes > 1 ? 'portent' : 'porte'} du stock
          {' '}({formatMAD(couverture.valeur_non_comptee)}).
        </p>
      )}
    </div>
  );
};

// ── Panneau article : ses mouvements, et sa fiche ─────────────
const ArticlePanel = ({ ligne, article, onClose, onEdit, onArchive, canUpdate, canDelete }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ligne) return;
    setLoading(true);
    fetchArticleMovements(ligne.article_id)
      .then(setMovements)
      .catch(() => toast.error('Erreur'))
      .finally(() => setLoading(false));
  }, [ligne?.article_id]);

  if (!ligne) return null;

  const depuis = [
    ['Acheté', ligne.qte_achats],
    ['Sorti',  ligne.qte_prelevements],
    ['Rentré', ligne.qte_retours],
    ['Ajusté', ligne.qte_ajustements],
  ].filter(([, q]) => Number(q) !== 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl flex flex-col z-50">
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text)]">{ligne.article}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Stock actuel : <span className="font-medium">{formatQty(ligne.qte_actuelle)} {ligne.unite}</span>
              {' · '}{formatMAD(ligne.valeur_actuelle)}
            </p>
            {depuis.length > 0 && (
              <p className="text-xs text-[var(--color-text-faint)] mt-1">
                Depuis l'inventaire : {depuis.map(([mot, q]) => `${mot} ${formatQty(Math.abs(Number(q)))}`).join(' · ')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {(canUpdate || canDelete) && article && (
          <div className="flex gap-2 px-5 py-3 border-b border-[var(--color-border)]">
            {canUpdate && (
              <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(article)}>
                <Pencil size={14} /> Modifier la fiche
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" className="gap-2 text-accent" onClick={() => onArchive(ligne)}>
                Archiver
              </Button>
            )}
          </div>
        )}

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
                      {Number(m.quantity) >= 0 ? '+' : ''}{formatQty(m.quantity)} {ligne.unite}
                    </p>
                    {m.event_name && <p className="text-xs text-[var(--color-text-muted)] truncate">{m.event_name}</p>}
                    {m.note && <p className="text-xs text-[var(--color-text-faint)] truncate">{m.note}</p>}
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
  const { user } = useAuth();
  const canBuy = usePermission('purchases.create');
  const canUpdate = usePermission('articles.update');
  const canDelete = usePermission('articles.delete');

  const [evo, setEvo] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [couverture, setCouverture] = useState(null);
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [selected, setSelected] = useState(null);
  const [achatOuvert, setAchatOuvert] = useState(false);
  const [ficheArticle, setFicheArticle] = useState(null);
  const [ficheOuverte, setFicheOuverte] = useState(false);
  const [aArchiver, setAArchiver] = useState(null);

  // Une seule fonction de chargement, appelée au montage ET après chaque
  // écriture. L'ancienne version avait un `useEffect([])` sans rechargement :
  // rien de saisi ici n'apparaissait avant un rafraîchissement manuel — ce qui
  // n'était pas gênant sur un écran de consultation, et le devient dès qu'on y
  // saisit des achats.
  const load = useCallback(async () => {
    try {
      const [e, d, c, a, s] = await Promise.all([
        fetchDepotEvolution(),
        fetchDepotDecomposition(),
        fetchInventaireCouverture(),
        fetchArticles(),
        fetchSuppliers(true),
      ]);
      setEvo(e); setLignes(d); setCouverture(c); setArticles(a); setSuppliers(s);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const vues = new Map();
    lignes.forEach((l) => {
      if (l.category_id && !vues.has(l.category_id)) {
        vues.set(l.category_id, { id: l.category_id, name: l.categorie, ordre: l.categorie_ordre ?? 99 });
      }
    });
    return [...vues.values()].sort((a, b) => a.ordre - b.ordre);
  }, [lignes]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = {};
    lignes
      .filter((l) => {
        if (q && !l.article.toLowerCase().includes(q)) return false;
        if (filterCat && l.category_id !== filterCat) return false;
        return true;
      })
      .forEach((l) => {
        const k = l.category_id ?? 'x';
        if (!map[k]) map[k] = { nom: l.categorie, ordre: l.categorie_ordre ?? 99, items: [] };
        map[k].items.push(l);
      });
    return Object.values(map).sort((a, b) => a.ordre - b.ordre);
  }, [lignes, search, filterCat]);

  const archiver = async () => {
    if (!aArchiver) return;
    try {
      await deactivateArticle(aArchiver.article_id, user.id);
      toast.success(`« ${aArchiver.article} » archivé`);
      setAArchiver(null);
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Dépôt</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {lignes.length} articles · stock en temps réel
          </p>
          {canBuy && (
            <Button className="gap-2 mt-3" onClick={() => setAchatOuvert(true)}>
              <Plus size={16} /> Nouvel achat
            </Button>
          )}
        </div>
        <Entete evo={evo} couverture={couverture} />
      </div>

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

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">Aucun article correspondant.</div>
      ) : (
        grouped.map(({ nom, ordre, items }) => {
          const valeurCat = items.reduce((s, i) => s + Number(i.valeur_actuelle ?? 0), 0);
          return (
            <section key={`${nom}-${ordre}`} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                  {nom ?? '—'}
                  <span className="text-sm font-normal text-[var(--color-text-faint)] font-sans">({items.length})</span>
                </h2>
                <span className="text-sm font-medium text-[var(--color-text-muted)]">{formatMAD(valeurCat)}</span>
              </div>

              <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Article</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                      <th className="px-4 py-3 text-right">Quantité</th>
                      <th className="px-4 py-3 text-right hidden md:table-cell">CMP</th>
                      <th className="px-4 py-3 text-right">Valeur</th>
                      <th className="px-4 py-3 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((l, idx) => (
                      <tr
                        key={l.article_id}
                        className={`border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-warm-50/30'}`}
                        onClick={() => setSelected(l)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {l.photo_url ? (
                              <img src={l.photo_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-warm-100 flex items-center justify-center flex-shrink-0">
                                <Image size={12} className="text-[var(--color-text-faint)]" />
                              </div>
                            )}
                            <span className="font-medium text-[var(--color-text)]">{l.article}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant={l.nature}>{l.nature}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${l.en_alerte ? 'text-accent' : 'text-[var(--color-text)]'}`}>
                            {formatQty(l.qte_actuelle)}
                          </span>
                          <span className="text-xs text-[var(--color-text-faint)] ml-1">{l.unite}</span>
                          {l.en_alerte && <TrendingDown size={12} className="inline ml-1 text-accent" />}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">
                          {formatMAD(l.cout_moyen)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[var(--color-text)]">
                          {formatMAD(l.valeur_actuelle)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight size={14} className="text-[var(--color-text-faint)]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <ArticlePanel
        ligne={selected}
        article={articles.find((a) => a.id === selected?.article_id)}
        onClose={() => setSelected(null)}
        onEdit={(a) => { setFicheArticle(a); setFicheOuverte(true); }}
        onArchive={setAArchiver}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />

      <PurchaseModal
        open={achatOuvert}
        onClose={() => setAchatOuvert(false)}
        onSaved={load}
        articles={articles}
        suppliers={suppliers.filter((s) => s.active)}
        onArticleCreated={load}
        onSupplierCreated={load}
      />

      <ArticleFormModal
        open={ficheOuverte}
        onClose={() => { setFicheOuverte(false); setFicheArticle(null); }}
        onCreated={() => { setSelected(null); load(); }}
        initial={ficheArticle}
      />

      <ConfirmDialog
        open={Boolean(aArchiver)}
        onClose={() => setAArchiver(null)}
        onConfirm={archiver}
        title="Archiver cet article ?"
        message={aArchiver
          ? `« ${aArchiver.article} » disparaîtra du dépôt. Son historique de mouvements est conservé, et son stock sort du total.`
          : ''}
        confirmLabel="Archiver"
      />
    </div>
  );
};

export default Depot;
