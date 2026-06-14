import { useState, useEffect } from 'react';
import { Plus, Search, Building2, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import { fetchPurchases, createPurchase, fetchSuppliers, createSupplier, updateSupplier } from '../data/purchases';
import { fetchArticles } from '../data/articles';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Select } from '../components/ui/Input';
import { PageLoader } from '../components/ui/Spinner';
import { formatMAD, formatQty, formatDate } from '../lib/utils';

// ── Modal nouvel achat ────────────────────────────────────────
const PurchaseModal = ({ open, onClose, onSaved, articles, suppliers }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    article_id: '', supplier_id: '', quantity: '', unit_price: '', date: new Date().toISOString().split('T')[0], note: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleArticleChange = (id) => {
    const art = articles.find((a) => a.id === id);
    set('article_id', id);
    if (art?.last_purchase_price) set('unit_price', String(art.last_purchase_price));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.article_id)           { toast.error('Article requis'); return; }
    if (!form.quantity || form.quantity <= 0) { toast.error('Quantité requise'); return; }
    if (!form.unit_price)           { toast.error('Prix unitaire requis'); return; }
    setSaving(true);
    try {
      await createPurchase({
        article_id:  form.article_id,
        supplier_id: form.supplier_id || null,
        quantity:    parseFloat(form.quantity),
        unit_price:  parseFloat(form.unit_price),
        date:        form.date,
        note:        form.note || null,
      }, user.id);
      toast.success('Achat enregistré — stock mis à jour');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const selectedArt = articles.find((a) => a.id === form.article_id);

  return (
    <Modal open={open} onClose={onClose} title="Nouvel achat" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Article *" value={form.article_id} onChange={(e) => handleArticleChange(e.target.value)}>
          <option value="">— Choisir un article —</option>
          {articles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>

        <Select label="Fournisseur" value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">— Aucun fournisseur —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Quantité *${selectedArt ? ` (${selectedArt.units?.abbreviation ?? ''})` : ''}`}
            type="number" min="0.001" step="0.001"
            value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Prix unitaire (MAD) *"
            type="number" min="0" step="0.01"
            value={form.unit_price}
            onChange={(e) => set('unit_price', e.target.value)}
            placeholder="0.00"
          />
        </div>

        {form.quantity && form.unit_price && (
          <div className="bg-primary-50 rounded-[var(--radius-md)] px-4 py-2 flex justify-between items-center">
            <span className="text-sm text-[var(--color-text-muted)]">Total</span>
            <span className="font-semibold text-primary">{formatMAD(parseFloat(form.quantity) * parseFloat(form.unit_price))}</span>
          </div>
        )}

        <Input label="Date *" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        <Input label="Note (optionnel)" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex : Livraison urgente" />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Modal fournisseur ─────────────────────────────────────────
const SupplierModal = ({ open, onClose, onSaved, editing }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ name: editing.name, phone: editing.phone ?? '', note: editing.note ?? '' });
    else setForm({ name: '', phone: '', note: '' });
  }, [editing, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateSupplier(editing.id, form, user.id);
        toast.success('Fournisseur mis à jour');
      } else {
        await createSupplier(form, user.id);
        toast.success('Fournisseur ajouté');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        <Input label="Téléphone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Ex : +212 6XX XXX XXX" />
        <Input label="Note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ex : Livraison le mardi" />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Page Achats ───────────────────────────────────────────────
const Achats = () => {
  const canCreate = usePermission('purchases.create');
  const [purchases,  setPurchases]  = useState([]);
  const [articles,   setArticles]   = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [tab,        setTab]        = useState('achats');
  const [modalAchat, setModalAchat] = useState(false);
  const [modalSupplier, setModalSupplier] = useState(false);
  const [editSupplier,  setEditSupplier]  = useState(null);

  const load = async () => {
    try {
      const [p, a, s] = await Promise.all([fetchPurchases(), fetchArticles(), fetchSuppliers(false)]);
      setPurchases(p); setArticles(a); setSuppliers(s);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredPurchases = purchases.filter((p) =>
    !search ||
    p.articles?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)]">Achats</h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditSupplier(null); setModalSupplier(true); }} className="gap-2">
              <Building2 size={16} /> Fournisseur
            </Button>
            <Button onClick={() => setModalAchat(true)} className="gap-2">
              <Plus size={18} /> Nouvel achat
            </Button>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-4 bg-warm-100 p-1 rounded-[var(--radius-md)] w-fit">
        {[{ id: 'achats', label: 'Historique achats' }, { id: 'fournisseurs', label: 'Fournisseurs' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors min-h-[44px] ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
        <input
          className="w-full h-11 pl-9 pr-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder={tab === 'achats' ? 'Rechercher un article ou fournisseur…' : 'Rechercher un fournisseur…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Historique achats */}
      {tab === 'achats' && (
        <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          {filteredPurchases.length === 0 ? (
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
                {filteredPurchases.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-[var(--color-border)] last:border-0 ${idx % 2 === 0 ? '' : 'bg-warm-50/30'}`}>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{p.articles?.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] hidden sm:table-cell">{p.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{formatQty(p.quantity)} {p.articles?.units?.abbreviation}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">{formatMAD(p.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{formatMAD(p.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Fournisseurs */}
      {tab === 'fournisseurs' && (
        <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--color-text-faint)]">
              <Building2 size={32} className="mx-auto mb-3 opacity-30" />
              Aucun fournisseur enregistré.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filteredSuppliers.map((s) => (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${!s.active ? 'opacity-50' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">{s.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.phone ?? ''}{s.note ? ` · ${s.note}` : ''}</p>
                  </div>
                  {canCreate && (
                    <button onClick={() => { setEditSupplier(s); setModalSupplier(true); }}
                      className="text-xs text-[var(--color-text-muted)] hover:text-primary px-3 py-1 rounded border border-[var(--color-border)] hover:border-primary transition-colors">
                      Modifier
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PurchaseModal
        open={modalAchat}
        onClose={() => setModalAchat(false)}
        onSaved={load}
        articles={articles}
        suppliers={suppliers.filter((s) => s.active)}
      />
      <SupplierModal
        open={modalSupplier}
        onClose={() => { setModalSupplier(false); setEditSupplier(null); }}
        onSaved={load}
        editing={editSupplier}
      />
    </div>
  );
};

export default Achats;
