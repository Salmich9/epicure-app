import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, ChevronRight, CheckCircle2, Clock, ArrowLeft, Pen, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import {
  fetchInventories, fetchInventory, createInventory,
  upsertInventoryLine, validateInventory,
} from '../data/inventory';
import { fetchArticles } from '../data/articles';
import { fetchCurrentStock } from '../data/stock';
import { fetchCategories } from '../data/categories';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty, formatDate, formatDateTime } from '../lib/utils';

// ── Vue liste des inventaires ─────────────────────────────────
const InventaireList = ({ onSelect, onNew, canCreate }) => {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventories()
      .then(setList)
      .catch(() => toast.error('Erreur'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Inventaires</h1>
        {canCreate && (
          <Button onClick={onNew} className="gap-2">
            <Plus size={18} /> Nouvel inventaire
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          Aucun inventaire créé.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((inv) => (
            <button
              key={inv.id}
              onClick={() => onSelect(inv.id)}
              className="flex items-center justify-between p-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] hover:shadow-sm transition-shadow text-left group min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                {inv.status === 'valide'
                  ? <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                  : <Clock size={20} className="text-yellow-500 flex-shrink-0" />
                }
                <div>
                  <p className="font-medium text-[var(--color-text)]">{inv.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(inv.date)} · {inv.users?.full_name}
                    {inv.status === 'valide' && inv.total_value != null && (
                      <> · <span className="font-medium text-primary">{formatMAD(inv.total_value)}</span></>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={inv.status}>{inv.status}</Badge>
                <ChevronRight size={16} className="text-[var(--color-text-faint)] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Vue détail / saisie d'un inventaire ───────────────────────
const InventaireDetail = ({ inventoryId, onBack }) => {
  const { user } = useAuth();
  const canValidate = usePermission('inventory.validate');

  const [inv,        setInv]        = useState(null);
  const [articles,   setArticles]   = useState([]);
  const [stock,      setStock]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts,     setCounts]     = useState({});    // { [articleId]: { qty, price } }
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState({});
  const [validateOpen, setValidateOpen] = useState(false);
  const [responsible,  setResponsible]  = useState('');
  const [validating,   setValidating]   = useState(false);

  const load = useCallback(async () => {
    const [invData, arts, stk, cats] = await Promise.all([
      fetchInventory(inventoryId),
      fetchArticles(),
      fetchCurrentStock(),
      fetchCategories(true),
    ]);
    setInv(invData);
    setArticles(arts);
    setCategories(cats);

    const stockMap = {};
    stk.forEach((s) => { stockMap[s.article_id] = s; });
    setStock(stockMap);

    // Init counts depuis les lignes existantes
    const c = {};
    invData.inventory_lines?.forEach((l) => {
      c[l.article_id] = { qty: String(l.counted_qty), price: l.unit_price };
    });
    // Pour les articles sans ligne : on pré-remplit avec 0
    arts.forEach((a) => {
      if (!c[a.id]) {
        c[a.id] = { qty: '', price: a.last_purchase_price };
      }
    });
    setCounts(c);
  }, [inventoryId]);

  useEffect(() => { load().catch(() => toast.error('Erreur')).finally(() => setLoading(false)); }, [load]);

  const setQty = (articleId, val) => {
    setCounts((prev) => ({ ...prev, [articleId]: { ...prev[articleId], qty: val } }));
  };

  // Pré-remplit toutes les quantités vides avec le stock actuel
  const prefillFromStock = () => {
    setCounts((prev) => {
      const next = { ...prev };
      articles.forEach((a) => {
        if (!next[a.id]?.qty) {
          const currentQty = Number(stock[a.id]?.quantity ?? 0);
          next[a.id] = { ...next[a.id], qty: String(currentQty) };
        }
      });
      return next;
    });
    toast.success('Quantités pré-remplies depuis le stock actuel');
  };

  const handleBlurQty = async (articleId) => {
    if (inv?.status !== 'brouillon') return;
    const c = counts[articleId];
    const qty = parseFloat(c?.qty);
    if (isNaN(qty)) return;
    setSaving((s) => ({ ...s, [articleId]: true }));
    try {
      const art = articles.find((a) => a.id === articleId);
      await upsertInventoryLine(inventoryId, articleId, qty, art?.last_purchase_price ?? 0);
    } catch (e) {
      toast.error('Sauvegarde échouée');
    } finally {
      setSaving((s) => ({ ...s, [articleId]: false }));
    }
  };

  const handleValidate = async () => {
    if (!responsible.trim()) { toast.error('Nom du responsable requis'); return; }
    setValidating(true);
    try {
      await validateInventory(inventoryId, responsible, user.id);
      toast.success('Inventaire validé et signé !');
      setValidateOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message || 'Erreur de validation');
    } finally {
      setValidating(false);
    }
  };

  // Total courant (pour affichage en temps réel)
  const totalCurrent = useMemo(() => {
    if (!articles.length) return 0;
    return articles.reduce((sum, a) => {
      const c = counts[a.id];
      const qty   = parseFloat(c?.qty)   || 0;
      const price = parseFloat(c?.price) || a.last_purchase_price || 0;
      return sum + qty * price;
    }, 0);
  }, [articles, counts]);

  const grouped = useMemo(() => {
    const map = {};
    articles.forEach((a) => {
      const catId = a.category_id;
      if (!map[catId]) map[catId] = { cat: a.categories, items: [] };
      map[catId].items.push(a);
    });
    return Object.values(map).sort((a, b) => (a.cat?.sort_order ?? 99) - (b.cat?.sort_order ?? 99));
  }, [articles]);

  if (loading || !inv) return <PageLoader />;

  const isDraft = inv.status === 'brouillon';

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-warm-100 text-[var(--color-text-muted)] transition-colors mt-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">{inv.label}</h1>
            <Badge variant={inv.status}>{inv.status}</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {formatDate(inv.date)} · {inv.users?.full_name}
            {inv.status === 'valide' && inv.signed_at && (
              <> · Signé le {formatDateTime(inv.signed_at)} par {inv.responsible_name}</>
            )}
          </p>
        </div>
        {/* Total + bouton valider */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-faint)]">Valeur</p>
            <p className="font-display text-xl font-bold text-primary">
              {formatMAD(inv.status === 'valide' ? inv.total_value : totalCurrent)}
            </p>
          </div>
          {isDraft && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={prefillFromStock} className="gap-2">
                <Zap size={16} /> Pré-remplir
              </Button>
              {canValidate && (
                <Button onClick={() => setValidateOpen(true)} className="gap-2">
                  <Pen size={16} /> Signer
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lignes par catégorie */}
      {grouped.map(({ cat, items }) => (
        <section key={cat?.id ?? 'x'} className="mb-6">
          <h2 className="font-display text-base font-semibold text-primary mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            {cat?.name ?? '—'}
          </h2>
          <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Article</th>
                  <th className="px-4 py-2 text-right hidden sm:table-cell">Stock actuel</th>
                  <th className="px-4 py-2 text-right w-36">Compté</th>
                  <th className="px-4 py-2 text-right hidden md:table-cell">Prix unit.</th>
                  <th className="px-4 py-2 text-right">Valeur ligne</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const c = counts[a.id] ?? { qty: '', price: a.last_purchase_price };
                  const qty   = parseFloat(c.qty)   || 0;
                  const price = parseFloat(c.price) || a.last_purchase_price || 0;
                  const lineVal = qty * price;
                  const currentQty = Number(stock[a.id]?.quantity ?? 0);

                  return (
                    <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text)]">{a.name}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">{a.units?.name}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden sm:table-cell">
                        {formatQty(currentQty)} {a.units?.abbreviation}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDraft ? (
                          <div className="relative flex justify-end">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={c.qty}
                              onChange={(e) => setQty(a.id, e.target.value)}
                              onBlur={() => handleBlurQty(a.id)}
                              placeholder=""
                              className="w-24 h-10 text-right px-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                            {saving[a.id] && (
                              <span className="absolute -right-5 top-1/2 -translate-y-1/2 w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        ) : (
                          <span className="font-medium">{formatQty(c.qty || 0)} {a.units?.abbreviation}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">
                        {formatMAD(price)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--color-text)]">
                        {formatMAD(lineVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Modal de validation / signature */}
      <Modal
        open={validateOpen}
        onClose={() => setValidateOpen(false)}
        title="Signer et valider l'inventaire"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            La validation est irréversible. Les mouvements de stock seront créés et l'inventaire passera en lecture seule.
          </p>
          <div className="bg-primary-50 rounded-[var(--radius-md)] p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Valeur totale</p>
            <p className="font-display text-2xl font-bold text-primary">{formatMAD(totalCurrent)}</p>
          </div>
          <Input
            label="Nom du responsable *"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Prénom Nom"
            autoFocus
          />
          <p className="text-xs text-[var(--color-text-faint)]">
            Horodatage automatique : {new Date().toLocaleString('fr-FR')}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setValidateOpen(false)}>
              Annuler
            </Button>
            <Button className="flex-1" onClick={handleValidate} loading={validating}>
              Valider et signer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Modal création d'inventaire ───────────────────────────────
const NewInventoryModal = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const [label,   setLabel]   = useState('');
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim()) { toast.error('Libellé requis'); return; }
    setLoading(true);
    try {
      const inv = await createInventory({ label, date }, user.id);
      toast.success('Inventaire créé');
      onCreated(inv.id);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvel inventaire" size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Libellé *"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex : Inventaire mensuel juin 2026"
          autoFocus
        />
        <Input
          label="Date *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" loading={loading}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Page principale Inventaire (routing interne) ──────────────
const Inventaire = () => {
  const canCreate = usePermission('inventory.create');
  const [view,    setView]    = useState('list');   // 'list' | 'detail'
  const [selId,   setSelId]   = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const handleSelect   = (id)  => { setSelId(id); setView('detail'); };
  const handleCreated  = (id)  => { setNewOpen(false); setSelId(id); setView('detail'); };
  const handleBack     = ()    => { setSelId(null); setView('list'); };

  if (view === 'detail' && selId) {
    return <InventaireDetail inventoryId={selId} onBack={handleBack} />;
  }

  return (
    <>
      <InventaireList
        onSelect={handleSelect}
        onNew={() => setNewOpen(true)}
        canCreate={canCreate}
      />
      <NewInventoryModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
};

export default Inventaire;
