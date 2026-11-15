import { useState, useEffect, Fragment, useMemo, useCallback } from 'react';
import {
  Plus, ChevronRight, ArrowLeft, Calendar, MapPin, Users,
  Trash2, Printer, PackageMinus, PackageCheck, CheckCircle2,
  Clock, Lock, X, UserPlus, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import {
  fetchEvents, fetchEvent, createEvent, updateEvent, updateEventStatus,
  addResponsible, removeResponsible,
  fetchEventWithdrawals, addWithdrawal, deleteWithdrawal,
  fetchEventReturns, validateEventReturns, fetchEcartsArticles,
} from '../data/events';
import { fetchArticles } from '../data/articles';
import { fetchCurrentStock } from '../data/stock';
import { fetchMotifs, corrigerMotifEcart } from '../data/motifs';
import { BonShell, BonEntete, BonSignatures, LigneFamille } from '../components/ui/Bon';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty, formatDate, formatDateTime, cn } from '../lib/utils';

// ── Helpers statut ────────────────────────────────────────────
const statusVariant = { brouillon: 'brouillon', en_cours: 'default', cloture: 'valide' };
const statusLabel   = { brouillon: 'Brouillon', en_cours: 'En cours', cloture: 'Clôturé' };

// ─────────────────────────────────────────────────────────────
// BON DE PRÉLÈVEMENT
//
// CE QUI A DISPARU : les colonnes « Prix unit. » et « Valeur », le bandeau de
// valeur totale, et les 19 tables — une par famille, chacune avec sa bordure,
// son en-tête et sa marge, pour deux lignes en moyenne.
//
// Ce bon sert à charger un camion. Celui qui le tient a besoin de savoir quoi
// prendre et combien ; le prix de la coupette ne l'aide pas et déplace la
// quantité vers la droite de la feuille.
//
// L'UTILISATEUR À L'ORIGINE DU PRÉLÈVEMENT était DÉJÀ chargé —
// `fetchEventWithdrawals` joint `users:created_by(full_name)` — et jeté par
// l'agrégation. Il suffit de ne plus le perdre.
// ─────────────────────────────────────────────────────────────

// « Karim », « Karim, Aziz », puis « Karim, Aziz +2 ». Au-delà de deux noms la
// colonne recommence à s'étaler, ce que toute cette refonte cherche à éviter.
const listerAuteurs = (noms) => {
  const l = [...noms].filter(Boolean).sort();
  if (l.length === 0) return null;
  if (l.length <= 2) return l.join(', ');
  return `${l[0]}, ${l[1]} +${l.length - 2}`;
};

const BonPrelevement = ({ event, responsibles, withdrawals, onClose }) => {
  const byCategory = useMemo(() => {
    const parArticle = {};
    withdrawals.forEach((w) => {
      const id = w.articles?.id; if (!id) return;
      if (!parArticle[id]) parArticle[id] = { article: w.articles, qty: 0, auteurs: new Set() };
      parArticle[id].qty += Math.abs(w.quantity);
      if (w.users?.full_name) parArticle[id].auteurs.add(w.users.full_name);
    });

    const parFamille = {};
    Object.values(parArticle).forEach((a) => {
      const cid = a.article?.categories?.id ?? 'x';
      if (!parFamille[cid]) parFamille[cid] = { cat: a.article?.categories, items: [] };
      parFamille[cid].items.push(a);
    });

    return Object.values(parFamille)
      .sort((a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99))
      .map((f) => ({ ...f, items: f.items.sort((a, b) => a.article.name.localeCompare(b.article.name, 'fr')) }));
  }, [withdrawals]);

  const nbArticles = byCategory.reduce((s, f) => s + f.items.length, 0);

  return (
    <BonShell titre="Bon de prélèvement" onClose={onClose}>
      <BonEntete
        sousTitre="Bon de prélèvement"
        lignes={[
          { label: 'Événement', valeur: event.name },
          { label: 'Date',      valeur: formatDate(event.date) },
          { label: 'Lieu',      valeur: event.venue },
        ]}
      />

      {responsibles.length > 0 && (
        <div className="mb-6 print-groupe">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Responsables</p>
          <div className="flex flex-wrap gap-2">
            {responsibles.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary rounded-full text-sm border border-primary-100">
                <span className="font-semibold">{r.name}</span><span className="text-primary/60">· {r.role_label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          Articles prélevés · {nbArticles} référence{nbArticles > 1 ? 's' : ''}
        </p>

        {nbArticles === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)] py-6 text-center">Aucun article prélevé.</p>
        ) : (
          <table className="w-full text-sm border border-[var(--color-border)] rounded overflow-hidden">
            <thead>
              <tr className="bg-warm-50 text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-right w-32">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(({ cat, items }) => (
                <Fragment key={cat?.id ?? 'x'}>
                  <LigneFamille titre={cat?.name ?? 'Sans famille'} colonnes={2} />
                  {items.map(({ article, qty, auteurs }) => {
                    const par = listerAuteurs(auteurs);
                    return (
                      <tr key={article.id} className="border-t border-[var(--color-border)]">
                        <td className="px-3 py-1.5">
                          <span className="font-medium">{article.name}</span>
                          {par && <span className="text-xs text-[var(--color-text-faint)]"> ({par})</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                          {formatQty(qty)} <span className="font-normal text-[var(--color-text-muted)]">{article.units?.abbreviation}</span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BonSignatures responsibles={responsibles} />
    </BonShell>
  );
};

// ─────────────────────────────────────────────────────────────
// BON D'ÉCART
//
// S'appelait « bon de retour » et listait tout ce qui était sorti, conforme
// compris. Un document qui aligne 20 lignes en règle pour en signaler 3 fait
// chercher les 3 : ne sont imprimées que les lignes en écart, suivies d'une
// ligne de clôture qui compte les autres. Rien n'est caché, tout est dit.
//
// « Prélevé » et « Retourné » fusionnent en « 24 → 21 » : l'information est
// entière, la table perd une colonne.
//
// LE TOTAL EST SCINDÉ. Un consommable qui ne revient pas n'est pas une perte,
// c'est sa destination — la distinction que portent `articles.type` depuis la
// 026 et `motifs_ecart.perte_reelle` depuis la 042. Les additionner produirait
// un « écart » qui grossit à chaque événement réussi.
// ─────────────────────────────────────────────────────────────
const BonEcart = ({ event, responsibles, aggregated, onClose }) => {
  const { ecarts, conformes, totalEcart, totalConsomme } = useMemo(() => {
    const enEcart = aggregated.filter((a) => a.ecart > 0);
    const parFamille = {};
    enEcart.forEach((a) => {
      const cid = a.article?.categories?.id ?? 'x';
      if (!parFamille[cid]) parFamille[cid] = { cat: a.article?.categories, items: [] };
      parFamille[cid].items.push(a);
    });

    // Au coût moyen, comme partout depuis la 027 — et donc identique au montant
    // de `v_evenements.valeur_ecart` que lit l'onglet Historique.
    const valeur = (a) => a.ecart * Number(a.article?.average_cost ?? 0);

    return {
      ecarts: Object.values(parFamille)
        .sort((a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99))
        .map((f) => ({ ...f, items: f.items.sort((x, y) => x.article.name.localeCompare(y.article.name, 'fr')) })),
      conformes: aggregated.length - enEcart.length,
      totalEcart:    enEcart.filter((a) => a.article?.type === 'retournable').reduce((s, a) => s + valeur(a), 0),
      totalConsomme: enEcart.filter((a) => a.article?.type !== 'retournable').reduce((s, a) => s + valeur(a), 0),
    };
  }, [aggregated]);

  const hasEcarts = ecarts.length > 0;

  return (
    <BonShell titre="Bon d'écart" onClose={onClose}>
      <BonEntete
        sousTitre="Bon d'écart — bilan des retours"
        lignes={[
          { label: 'Événement', valeur: event.name },
          { label: 'Date',      valeur: formatDate(event.date) },
          { label: 'Lieu',      valeur: event.venue },
        ]}
      />

      {!hasEcarts ? (
        <div className="py-10 text-center print-groupe">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-green-600" />
          <p className="font-semibold text-green-700">Aucun écart constaté.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {aggregated.length} référence{aggregated.length > 1 ? 's' : ''} prélevée{aggregated.length > 1 ? 's' : ''}, {aggregated.length > 1 ? 'toutes retournées' : 'retournée'} intégralement.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Articles en écart</p>
          <table className="w-full text-sm border border-[var(--color-border)] rounded overflow-hidden">
            <thead>
              <tr className="bg-warm-50 text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                <th className="px-2 py-2 text-left">Article</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">Pris → Rendu</th>
                <th className="px-2 py-2 text-right">Écart</th>
                <th className="px-2 py-2 text-right">Valeur</th>
                <th className="px-2 py-2 text-left">Motif</th>
              </tr>
            </thead>
            <tbody>
              {ecarts.map(({ cat, items }) => (
                <Fragment key={cat?.id ?? 'x'}>
                  <LigneFamille titre={cat?.name ?? 'Sans famille'} colonnes={5} />
                  {items.map(({ article, withdrawn, returned, ecart, motif }) => (
                    <tr key={article.id} className="border-t border-[var(--color-border)] bg-red-50/50">
                      <td className="px-2 py-1.5 font-medium">{article.name}</td>
                      <td className="px-2 py-1.5 text-right text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatQty(withdrawn)} → {formatQty(returned)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-red-600 whitespace-nowrap">
                        −{formatQty(ecart)} <span className="font-normal">{article.units?.abbreviation}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-red-600 whitespace-nowrap">
                        {formatMAD(ecart * Number(article.average_cost ?? 0))}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">{motif || '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {/* La ligne de clôture : ce qui n'est pas imprimé est compté. */}
              {conformes > 0 && (
                <tr className="border-t border-[var(--color-border)] bg-green-50/60">
                  <td colSpan={5} className="px-2 py-2 text-xs text-green-800">
                    ✓ {conformes} autre{conformes > 1 ? 's' : ''} référence{conformes > 1 ? 's' : ''} retournée{conformes > 1 ? 's' : ''} intégralement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap justify-end gap-3 mt-4 print-groupe">
            <div className="px-5 py-3 rounded-[var(--radius-md)] bg-red-600 text-white">
              <span className="text-sm opacity-75">Écart (retournables)</span>
              <span className="font-display text-lg font-bold ml-3">{formatMAD(totalEcart)}</span>
            </div>
            {totalConsomme > 0 && (
              <div className="px-5 py-3 rounded-[var(--radius-md)] bg-warm-100 text-[var(--color-text)] border border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-text-muted)]">Consommé (consommables)</span>
                <span className="font-display text-lg font-bold ml-3">{formatMAD(totalConsomme)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <BonSignatures responsibles={responsibles} />
    </BonShell>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL PRÉLÈVEMENT — panier pré-chargé (tout le stock > 0)
// ─────────────────────────────────────────────────────────────
const WithdrawalModal = ({ open, onClose, onSave, stock }) => {
  const [basket,  setBasket]  = useState([]);  // [{ article, available, qty, note }]
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);

  // Initialise le panier à chaque ouverture
  useEffect(() => {
    if (!open) return;
    const items = stock
      .filter((s) => Number(s.quantity) > 0 && s.active)
      .sort((a, b) => (a.categories?.sort_order ?? 99) - (b.categories?.sort_order ?? 99))
      .map((s) => ({
        article:   s,
        available: Number(s.quantity),
        qty:       '',
        note:      '',
      }));
    setBasket(items);
    setSearch('');
  }, [open, stock]);

  const setQty  = (idx, val) => setBasket((b) => b.map((r, i) => i === idx ? { ...r, qty: val }  : r));
  const setNote = (idx, val) => setBasket((b) => b.map((r, i) => i === idx ? { ...r, note: val } : r));
  const remove  = (idx)      => setBasket((b) => b.filter((_, i) => i !== idx));

  // Lignes visibles selon la recherche
  const visible = useMemo(() =>
    basket.map((r, i) => ({ ...r, _idx: i }))
          .filter((r) => r.article.name.toLowerCase().includes(search.toLowerCase())),
    [basket, search]
  );

  // Groupement par catégorie (sur les lignes visibles)
  const byCategory = useMemo(() => {
    const map = {};
    visible.forEach((r) => {
      const cid = r.article.categories?.id ?? 'x';
      if (!map[cid]) map[cid] = { cat: r.article.categories, rows: [] };
      map[cid].rows.push(r);
    });
    return Object.values(map).sort((a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99));
  }, [visible]);

  const toSubmit = basket.filter((r) => parseFloat(r.qty) > 0);

  const handleSubmit = async () => {
    // Validation
    for (const r of toSubmit) {
      const qty = parseFloat(r.qty);
      if (qty > r.available) {
        toast.error(`Stock insuffisant pour "${r.article.name}" (dispo : ${formatQty(r.available)})`);
        return;
      }
    }
    if (toSubmit.length === 0) { toast.error('Aucune quantité saisie'); return; }
    setLoading(true);
    try {
      await onSave(toSubmit.map((r) => ({ articleId: r.article.article_id, quantity: parseFloat(r.qty), note: r.note })));
      toast.success(`${toSubmit.length} prélèvement${toSubmit.length > 1 ? 's' : ''} enregistré${toSubmit.length > 1 ? 's' : ''}`);
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Prélèvement" size="xl">
      {/* La hauteur etait forcee ici a 70vh/52vh pour contourner un Modal sans
          `max-h`. Modal borne desormais sa propre hauteur et fait defiler son
          corps : garder ces valeurs rendrait la modale plus petite, pas plus
          grande. Le panier occupe la place disponible et rien de plus. */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* Barre de recherche + compteur */}
        <div className="flex items-center gap-3">
          <input
            className="flex-1 h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Filtrer un article…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            {toSubmit.length} article{toSubmit.length > 1 ? 's' : ''} sélectionné{toSubmit.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Tableau scrollable */}
        <div className="overflow-y-auto flex-1 min-h-0 border border-[var(--color-border)] rounded-[var(--radius-md)]">
          {byCategory.length === 0 && (
            <p className="text-sm text-center text-[var(--color-text-faint)] py-8">Aucun article en stock.</p>
          )}
          {byCategory.map(({ cat, rows }) => (
            <div key={cat?.id ?? 'x'}>
              {/* En-tête catégorie */}
              <div className="sticky top-0 bg-warm-50 border-b border-[var(--color-border)] px-3 py-1.5 z-10">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">{cat?.name ?? '—'}</span>
              </div>
              {rows.map((r) => {
                const hasQty = parseFloat(r.qty) > 0;
                return (
                  <div key={r._idx} className={cn(
                    'flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0',
                    hasQty ? 'bg-primary-50/40' : 'hover:bg-warm-50/50'
                  )}>
                    {/* Nom + stock dispo */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{r.article.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Dispo : <span className="font-medium">{formatQty(r.available)} {r.article.units?.abbreviation}</span>
                      </p>
                    </div>
                    {/* Input quantité */}
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      max={r.available}
                      value={r.qty}
                      onChange={(e) => setQty(r._idx, e.target.value)}
                      placeholder="0"
                      className={cn(
                        'w-24 h-9 text-right px-2 rounded-[var(--radius-sm)] border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
                        parseFloat(r.qty) > r.available
                          ? 'border-red-400 bg-red-50'
                          : hasQty
                          ? 'border-primary/50 bg-white'
                          : 'border-[var(--color-border)] bg-white'
                      )}
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-6 flex-shrink-0">{r.article.units?.abbreviation}</span>
                    {/* Note */}
                    <input
                      type="text"
                      value={r.note}
                      onChange={(e) => setNote(r._idx, e.target.value)}
                      placeholder="Note…"
                      className="hidden md:block w-32 h-9 px-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    />
                    {/* Supprimer la ligne */}
                    <button
                      type="button"
                      onClick={() => remove(r._idx)}
                      className="p-1.5 text-[var(--color-text-faint)] hover:text-red-400 flex-shrink-0"
                      title="Retirer du panier"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1 gap-1" loading={loading} onClick={handleSubmit} disabled={toSubmit.length === 0}>
            <PackageMinus size={15} /> Prélever {toSubmit.length > 0 ? `(${toSubmit.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// SECTION RETOURS
//
// LA VALORISATION PASSE AU COÛT MOYEN. La migration 027 avait tranché avec une
// mesure — le dernier prix d'achat surévaluait le dépôt de 24 % — et cet écran
// ne l'avait pas suivie. Le même événement affichait donc un montant ici et un
// autre dans `v_evenements`, que lit désormais l'onglet Historique. Un écart,
// c'est du stock qui sort : il vaut ce que le dépôt dit qu'il vaut.
//
// LE MOTIF EST MODIFIABLE APRÈS CLÔTURE, ET LUI SEUL. Les quantités passent en
// lecture seule à la clôture et y restent : elles ont produit des mouvements de
// stock, les rouvrir demanderait de rejouer le journal. Le motif n'a produit
// aucun mouvement — c'est une étiquette, elle se corrige.
// ─────────────────────────────────────────────────────────────
const RetourSection = ({ event, withdrawals, returns, onValidated, isClosed }) => {
  const { user } = useAuth();
  const canManage = usePermission('events.manage');

  // Agrège prélevés par article
  const withdrawnMap = useMemo(() => {
    const map = {};
    withdrawals.forEach((w) => {
      const id = w.articles?.id; if (!id) return;
      if (!map[id]) map[id] = { article: w.articles, qty: 0 };
      map[id].qty += Math.abs(w.quantity);
    });
    return map;
  }, [withdrawals]);

  // Agrège retournés par article
  const returnedMap = useMemo(() => {
    const map = {};
    returns.filter((r) => r.type === 'retour').forEach((r) => {
      const id = r.articles?.id; if (!id) return;
      if (!map[id]) map[id] = 0;
      map[id] += Math.abs(r.quantity);
    });
    return map;
  }, [returns]);

  const [returnQtys,  setReturnQtys]  = useState({});
  const [motifs,      setMotifs]      = useState([]);
  const [motifChoisi, setMotifChoisi] = useState({});   // article_id → motif_id
  const [enregistrement, setEnregistrement] = useState(null); // article_id en cours
  const [validating,  setValidating]  = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showBon,     setShowBon]     = useState(false);

  // Le référentiel, et les motifs déjà posés. Les deux en parallèle : ils ne
  // dépendent pas l'un de l'autre.
  useEffect(() => {
    let vivant = true;
    Promise.all([fetchMotifs(true), fetchEcartsArticles(event.id)])
      .then(([refs, lignes]) => {
        if (!vivant) return;
        setMotifs(refs);
        const deja = {};
        lignes.forEach((l) => { if (l.motif_id) deja[l.article_id] = l.motif_id; });
        setMotifChoisi(deja);
      })
      .catch(() => { /* l'écran reste utilisable sans motif */ });
    return () => { vivant = false; };
  }, [event.id]);

  // Init/reset des quantités : ce qui est enregistré, ou tout retourné par défaut
  useEffect(() => {
    const init = {};
    Object.entries(withdrawnMap).forEach(([id, { qty }]) => {
      init[id] = isClosed
        ? String(returnedMap[id] ?? 0)
        : String(returnedMap[id] ?? qty);
    });
    setReturnQtys(init);
  }, [withdrawnMap, returnedMap, isClosed]);

  const nomMotif = useCallback(
    (id) => motifs.find((m) => m.id === id)?.name ?? null,
    [motifs]
  );

  const rows = useMemo(() =>
    Object.entries(withdrawnMap).map(([id, { article, qty: withdrawn }]) => {
      const returned = parseFloat(returnQtys[id] ?? withdrawn) || 0;
      const ecart = Math.max(0, withdrawn - returned);
      return {
        article, withdrawn, returned, ecart,
        motifId: motifChoisi[id] ?? '',
        motif:   nomMotif(motifChoisi[id]),
      };
    }).sort((a, b) => (a.article?.categories?.sort_order ?? 99) - (b.article?.categories?.sort_order ?? 99)),
    [withdrawnMap, returnQtys, motifChoisi, nomMotif]
  );

  const valeurEcart = (r) => r.ecart * Number(r.article?.average_cost ?? 0);
  const totalEcartValue = rows.reduce((s, r) => s + valeurEcart(r), 0);
  const hasEcarts = rows.some((r) => r.ecart > 0);
  const sansMotif = rows.filter((r) => r.ecart > 0 && !r.motifId).length;

  // Après clôture : chaque changement part immédiatement en base par sa RPC.
  // Pas de bouton « enregistrer » — il n'y a qu'un champ, et un bouton
  // laisserait croire qu'on peut aussi corriger le reste de la ligne.
  const changerMotifClos = async (articleId, motifId) => {
    const avant = motifChoisi[articleId] ?? '';
    setMotifChoisi((p) => ({ ...p, [articleId]: motifId }));
    setEnregistrement(articleId);
    try {
      await corrigerMotifEcart({ eventId: event.id, articleId, motifId }, user.id);
      toast.success('Motif enregistré');
    } catch (e) {
      setMotifChoisi((p) => ({ ...p, [articleId]: avant }));  // on revient à l'affiché
      toast.error(e.message || 'Erreur');
    } finally {
      setEnregistrement(null);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const payload = rows.map((r) => ({
        article_id:   r.article.id,
        returned_qty: r.returned,
        ecart:        r.ecart,
        motif_id:     r.ecart > 0 ? (r.motifId || null) : null,
      }));
      await validateEventReturns(event.id, payload, user.id);
      toast.success('Retours validés — événement clôturé !');
      setConfirmOpen(false);
      onValidated();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setValidating(false);
    }
  };

  if (showBon) {
    return (
      <BonEcart
        event={event}
        responsibles={event.event_responsibles ?? []}
        aggregated={rows}
        onClose={() => setShowBon(false)}
      />
    );
  }

  if (withdrawals.length === 0) {
    return <p className="text-sm text-[var(--color-text-faint)] py-4">Aucun article prélevé — rien à retourner.</p>;
  }

  return (
    <div>
      {hasEcarts && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)] mb-4 text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p>Écart total : <strong>{formatMAD(totalEcartValue)}</strong></p>
            {sansMotif > 0 && (
              <p className="text-xs mt-0.5 text-red-600/80">
                {sansMotif} article{sansMotif > 1 ? 's' : ''} sans motif — facultatif, mais c'est ce qui rend l'écart lisible plus tard.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-50 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Article</th>
              <th className="px-3 py-2 text-right">Prélevé</th>
              <th className="px-3 py-2 text-right w-32">Retourné</th>
              <th className="px-3 py-2 text-right">Écart</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">Val. écart</th>
              <th className="px-3 py-2 text-left w-40">Motif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ article, withdrawn, returned, ecart, motifId }) => (
              <tr key={article.id} className={`border-b border-[var(--color-border)] last:border-0 ${ecart > 0 ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-[var(--color-text)]">{article.name}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">{article.categories?.name}</p>
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--color-text-muted)]">
                  {formatQty(withdrawn)} {article.units?.abbreviation}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {!isClosed ? (
                    <input
                      type="number" min="0" step="0.001" max={withdrawn}
                      value={returnQtys[article.id] ?? ''}
                      onChange={(e) => setReturnQtys((prev) => ({ ...prev, [article.id]: e.target.value }))}
                      className="w-24 h-11 text-right px-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    <span className="font-medium">{formatQty(returned)} {article.units?.abbreviation}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {ecart > 0
                    ? <span className="text-red-600 font-semibold">−{formatQty(ecart)} {article.units?.abbreviation}</span>
                    : <span className="text-green-600 text-xs">✓ OK</span>
                  }
                </td>
                <td className="px-3 py-2.5 text-right hidden md:table-cell">
                  {ecart > 0
                    ? <span className="text-red-600 font-medium">{formatMAD(ecart * Number(article.average_cost ?? 0))}</span>
                    : <span className="text-[var(--color-text-faint)]">—</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  {/* La colonne n'apparaît que là où il y a quelque chose à
                      expliquer. Une liste déroulante sur une ligne conforme
                      inviterait à inventer une cause à un fait qui n'a pas eu
                      lieu — et la RPC la refuserait. */}
                  {ecart > 0 ? (
                    <select
                      value={motifId}
                      disabled={enregistrement === article.id || (isClosed && !canManage)}
                      onChange={(e) => (isClosed
                        ? changerMotifClos(article.id, e.target.value)
                        : setMotifChoisi((p) => ({ ...p, [article.id]: e.target.value })))}
                      className="w-full h-11 px-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    >
                      <option value="">— Motif —</option>
                      {motifs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-[var(--color-text-faint)] text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isClosed && hasEcarts && (
        <p className="text-xs text-[var(--color-text-faint)] mb-3">
          Événement clôturé : les quantités sont figées. Seul le motif reste corrigeable, et chaque changement est enregistré immédiatement.
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => setShowBon(true)} className="gap-1">
          <Printer size={14} /> Bon d'écart
        </Button>
        {!isClosed && canManage && (
          <Button onClick={() => setConfirmOpen(true)} className="gap-1">
            <PackageCheck size={15} /> Valider les retours et clôturer
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleValidate}
        title="Valider les retours ?"
        message={`Les mouvements de stock seront créés${hasEcarts ? ` et ${formatMAD(totalEcartValue)} d'écarts seront enregistrés` : ''}. L'événement sera clôturé : les quantités ne seront plus modifiables, seuls les motifs le resteront.`}
        confirmLabel="Valider et clôturer"
        loading={validating}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DÉTAIL ÉVÉNEMENT
// ─────────────────────────────────────────────────────────────
const EvenementDetail = ({ eventId, onBack }) => {
  const { user } = useAuth();
  const canManage = usePermission('events.manage');

  const [event,       setEvent]       = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [returns,     setReturns]     = useState([]);
  const [articles,    setArticles]    = useState([]);
  const [stock,       setStock]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('prelevements'); // 'prelevements' | 'retours'
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [respModal,   setRespModal]   = useState(false);
  const [respForm,    setRespForm]    = useState({ name: '', role_label: '' });
  const [savingResp,  setSavingResp]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [showBonPrel, setShowBonPrel] = useState(false);

  const load = useCallback(async () => {
    const [ev, w, r, a, s] = await Promise.all([
      fetchEvent(eventId),
      fetchEventWithdrawals(eventId),
      fetchEventReturns(eventId),
      fetchArticles(),
      fetchCurrentStock(),
    ]);
    setEvent(ev); setWithdrawals(w); setReturns(r); setArticles(a); setStock(s);
  }, [eventId]);

  useEffect(() => {
    load().catch(() => toast.error('Erreur')).finally(() => setLoading(false));
  }, [load]);

  // Agrégation prélèvements pour affichage
  const aggregatedWithdrawals = useMemo(() => {
    const map = {};
    withdrawals.forEach((w) => {
      const id = w.articles?.id; if (!id) return;
      if (!map[id]) map[id] = { article: w.articles, qty: 0, lines: [] };
      map[id].qty += Math.abs(w.quantity);
      map[id].lines.push(w);
    });
    return Object.values(map).sort((a, b) => (a.article?.categories?.sort_order ?? 99) - (b.article?.categories?.sort_order ?? 99));
  }, [withdrawals]);

  const totalWithdrawValue = aggregatedWithdrawals.reduce(
    (s, a) => s + a.qty * (a.article?.last_purchase_price ?? 0), 0
  );

  const handleWithdraw = async (items) => {
    for (const { articleId, quantity, note } of items) {
      await addWithdrawal({ eventId, articleId, quantity, note, actorId: user.id });
    }
    await load();
  };

  const handleAddResponsible = async () => {
    if (!respForm.name.trim() || !respForm.role_label.trim()) { toast.error('Tous les champs sont requis'); return; }
    setSavingResp(true);
    try { await addResponsible(eventId, respForm); setRespForm({ name: '', role_label: '' }); setRespModal(false); await load(); toast.success('Responsable ajouté'); }
    catch (e) { toast.error(e.message); }
    finally { setSavingResp(false); }
  };

  const handleDeleteWithdrawal = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await deleteWithdrawal(deleteTarget.id, user.id); setDeleteTarget(null); await load(); toast.success('Prélèvement annulé'); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(false); }
  };

  const handleStatusChange = async (status) => {
    await updateEventStatus(eventId, status, user.id);
    await load();
    toast.success(`Événement "${statusLabel[status]}"`);
  };

  if (loading || !event) return <PageLoader />;

  const isClosed = event.status === 'cloture';

  if (showBonPrel) {
    return <BonPrelevement event={event} responsibles={event.event_responsibles ?? []} withdrawals={withdrawals} onClose={() => setShowBonPrel(false)} />;
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] mt-1 min-h-[44px] min-w-[44px] flex items-center justify-center"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold">{event.name}</h1>
            <Badge variant={statusVariant[event.status]}>{statusLabel[event.status]}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-[var(--color-text-muted)] flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(event.date)}</span>
            {event.venue && <span className="flex items-center gap-1"><MapPin size={13} />{event.venue}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canManage && !isClosed && event.status === 'brouillon' && (
            <Button size="sm" onClick={() => handleStatusChange('en_cours')}>Démarrer</Button>
          )}
        </div>
      </div>

      {/* Responsables */}
      <section className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Users size={16} className="text-primary" /> Responsables</h2>
          {canManage && !isClosed && (
            <button onClick={() => setRespModal(true)} className="flex items-center gap-1 text-sm text-primary hover:underline min-h-[44px] px-2">
              <UserPlus size={14} /> Ajouter
            </button>
          )}
        </div>
        {(event.event_responsibles ?? []).length === 0
          ? <p className="text-sm text-[var(--color-text-faint)]">Aucun responsable assigné.</p>
          : <div className="flex flex-wrap gap-2">
              {(event.event_responsibles ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-full text-sm">
                  <span className="font-medium text-primary">{r.name}</span>
                  <span className="text-primary/60">· {r.role_label}</span>
                  {canManage && !isClosed && (
                    <button onClick={() => removeResponsible(r.id).then(load)} className="text-primary/40 hover:text-red-400 ml-1"><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
        }
      </section>

      {/* Onglets Prélèvements / Retours */}
      <div className="flex gap-1 mb-4 bg-warm-100 p-1 rounded-[var(--radius-md)]">
        <button
          onClick={() => setTab('prelevements')}
          className={cn('flex-1 py-2 px-4 rounded-[var(--radius-sm)] text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2',
            tab === 'prelevements' ? 'bg-white text-primary shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          )}
        >
          <PackageMinus size={14} /> Prélèvements
          {aggregatedWithdrawals.length > 0 && <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">{aggregatedWithdrawals.length}</span>}
        </button>
        <button
          onClick={() => setTab('retours')}
          className={cn('flex-1 py-2 px-4 rounded-[var(--radius-sm)] text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2',
            tab === 'retours' ? 'bg-white text-primary shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          )}
        >
          <PackageCheck size={14} /> Retours & Écarts
        </button>
      </div>

      {/* Contenu onglet Prélèvements */}
      {tab === 'prelevements' && (
        <section className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <PackageMinus size={16} className="text-accent" /> Prélèvements
            </h2>
            <div className="flex items-center gap-3">
              {totalWithdrawValue > 0 && <span className="font-display text-lg font-bold text-primary">{formatMAD(totalWithdrawValue)}</span>}
              {withdrawals.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowBonPrel(true)} className="gap-1">
                  <Printer size={14} /> Bon
                </Button>
              )}
              {!isClosed && (
                <Button size="sm" onClick={() => setWithdrawModal(true)} className="gap-1">
                  <Plus size={14} /> Prélever
                </Button>
              )}
            </div>
          </div>

          {aggregatedWithdrawals.length === 0
            ? <p className="text-sm text-[var(--color-text-faint)]">Aucun article prélevé pour l'instant.</p>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-warm-50 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Article</th>
                    <th className="px-3 py-2 text-right">Qté totale</th>
                    <th className="px-3 py-2 text-right hidden md:table-cell">Valeur</th>
                    {!isClosed && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {aggregatedWithdrawals.map(({ article, qty, lines }) => (
                    <Fragment key={article.id}>
                      <tr className="border-b border-[var(--color-border)]">
                        <td className="px-3 py-2.5 font-medium">{article.name}<span className="text-xs text-[var(--color-text-faint)] ml-1">({article.categories?.name})</span></td>
                        <td className="px-3 py-2.5 text-right font-semibold text-accent">{formatQty(qty)} {article.units?.abbreviation}</td>
                        <td className="px-3 py-2.5 text-right text-[var(--color-text-muted)] hidden md:table-cell">{formatMAD(qty * (article.last_purchase_price ?? 0))}</td>
                        {!isClosed && <td className="px-3 py-2.5" />}
                      </tr>
                      {lines.map((line) => (
                        <tr key={line.id} className="bg-warm-50/40 border-b border-[var(--color-border)] last:border-0 text-xs">
                          <td className="px-3 py-1.5 pl-6 text-[var(--color-text-faint)]">
                            {formatDateTime(line.created_at)} · {line.users?.full_name}
                            {line.note && <span className="ml-1 italic">· {line.note}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right text-[var(--color-text-muted)]">{formatQty(Math.abs(line.quantity))} {article.units?.abbreviation}</td>
                          <td className="hidden md:table-cell" />
                          {!isClosed && (
                            <td className="px-3 py-1.5 text-right">
                              <button onClick={() => setDeleteTarget(line)} className="text-red-300 hover:text-red-500" title="Annuler"><Trash2 size={12} /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )
          }
        </section>
      )}

      {/* Contenu onglet Retours */}
      {tab === 'retours' && (
        <section className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <RetourSection
            event={event}
            withdrawals={withdrawals}
            returns={returns}
            onValidated={load}
            isClosed={isClosed}
          />
        </section>
      )}

      {/* Modals */}
      <WithdrawalModal open={withdrawModal} onClose={() => setWithdrawModal(false)} onSave={handleWithdraw} stock={stock} />

      <Modal open={respModal} onClose={() => setRespModal(false)} title="Ajouter un responsable" size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom *" value={respForm.name} onChange={(e) => setRespForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex : Karim Benali" autoFocus />
          <Input label="Rôle *" value={respForm.role_label} onChange={(e) => setRespForm((f) => ({ ...f, role_label: e.target.value }))} placeholder="Ex : Barman, Chef de rang…" />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setRespModal(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleAddResponsible} loading={savingResp}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteWithdrawal} title="Annuler ce prélèvement ?" message="Le stock sera recrédité." confirmLabel="Annuler le prélèvement" danger loading={deleting} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// LISTE DES ÉVÉNEMENTS
// ─────────────────────────────────────────────────────────────
const EvenementsList = ({ onSelect, onNew, canCreate }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents().then(setList).catch(() => toast.error('Erreur')).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const statusIcon = {
    brouillon: <Clock size={18} className="text-yellow-500 flex-shrink-0" />,
    en_cours:  <PackageMinus size={18} className="text-accent flex-shrink-0" />,
    cloture:   <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />,
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Événements</h1>
        {canCreate && <Button onClick={onNew} className="gap-2"><Plus size={18} /> Nouvel événement</Button>}
      </div>
      {list.length === 0
        ? <div className="text-center py-16 text-[var(--color-text-muted)]">Aucun événement créé.</div>
        : (
          <div className="flex flex-col gap-2">
            {list.map((ev) => (
              <button key={ev.id} onClick={() => onSelect(ev.id)} className="flex items-center justify-between p-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] hover:shadow-sm transition-shadow text-left group min-h-[44px]">
                <div className="flex items-center gap-3">
                  {statusIcon[ev.status]}
                  <div>
                    <p className="font-medium">{ev.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(ev.date)}{ev.venue && <> · {ev.venue}</>}
                      {(ev.event_responsibles ?? []).length > 0 && <> · {ev.event_responsibles.length} responsable{ev.event_responsibles.length > 1 ? 's' : ''}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[ev.status]}>{statusLabel[ev.status]}</Badge>
                  <ChevronRight size={16} className="text-[var(--color-text-faint)] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )
      }
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL CRÉATION ÉVÉNEMENT
// ─────────────────────────────────────────────────────────────
const NewEventModal = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().split('T')[0], venue: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setLoading(true);
    try { const ev = await createEvent(form, user.id); toast.success('Événement créé'); onCreated(ev.id); }
    catch (e) { toast.error(e.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvel événement" size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex : Mariage Villa Mandarine" autoFocus />
        <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Input label="Lieu (optionnel)" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Ex : Villa Mandarine, Rabat" />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" loading={loading}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────
const Evenements = () => {
  const canCreate = usePermission('events.create');
  const [view, setView] = useState('list');
  const [selId, setSelId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const handleSelect  = (id) => { setSelId(id); setView('detail'); };
  const handleCreated = (id) => { setNewOpen(false); setSelId(id); setView('detail'); };
  const handleBack    = ()   => { setSelId(null); setView('list'); };

  if (view === 'detail' && selId) return <EvenementDetail eventId={selId} onBack={handleBack} />;

  return (
    <>
      <EvenementsList onSelect={handleSelect} onNew={() => setNewOpen(true)} canCreate={canCreate} />
      <NewEventModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={handleCreated} />
    </>
  );
};

export default Evenements;
