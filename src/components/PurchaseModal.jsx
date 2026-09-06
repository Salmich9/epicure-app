import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { createPurchase } from '../data/purchases';
import ArticleFormModal from './ArticleFormModal';
import SupplierModal from './SupplierModal';
import Combobox from './ui/Combobox';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import { formatMAD } from '../lib/utils';

/**
 * Saisie d'un achat, depuis la page Dépôt.
 *
 * Un achat entre au dépôt : c'est le même geste, il n'y a plus de raison de le
 * faire sur un autre écran. Ce composant vivait dans la page Achats, qui a
 * disparu.
 *
 * La création d'article à la volée passe par `ArticleFormModal` : catégorie,
 * unité et nature y sont obligatoires, et il vaut mieux les demander une fois
 * que de laisser une fiche à moitié remplie que plus aucun écran ne pourra
 * corriger.
 */
const PurchaseModal = ({ open, onClose, onSaved, articles, suppliers, onArticleCreated, onSupplierCreated }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    article_id: '', supplier_id: '', quantity: '', unit_price: '',
    date: new Date().toISOString().split('T')[0], note: '',
  });
  const [saving, setSaving] = useState(false);
  const [articleModal, setArticleModal] = useState(false);
  const [newArticleName, setNewArticleName] = useState('');
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Le dernier prix payé pré-remplit le champ : neuf fois sur dix c'est le bon,
  // et la dixième se corrige plus vite qu'elle ne se retrouve.
  const choisirArticle = (art) => {
    if (!art) { set('article_id', ''); return; }
    set('article_id', art.id);
    if (art.last_purchase_price) set('unit_price', String(art.last_purchase_price));
  };

  const articleCree = async (art) => {
    await onArticleCreated();
    choisirArticle(art);
  };

  const fournisseurCree = async (s) => {
    await onSupplierCreated();
    set('supplier_id', s.id);
  };

  const reinitialiser = () => setForm({
    article_id: '', supplier_id: '', quantity: '', unit_price: '',
    date: new Date().toISOString().split('T')[0], note: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.article_id) { toast.error('Article requis'); return; }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { toast.error('Quantité requise'); return; }
    if (form.unit_price === '') { toast.error('Prix unitaire requis'); return; }

    setSaving(true);
    try {
      const r = await createPurchase({
        article_id: form.article_id,
        supplier_id: form.supplier_id || null,
        quantity: parseFloat(form.quantity),
        unit_price: parseFloat(form.unit_price),
        date: form.date,
        note: form.note || null,
      }, user.id);

      // On annonce l'effet réel sur le dépôt, pas seulement « c'est
      // enregistré ». C'est ce chiffre-là que la personne est venue changer.
      toast.success(`Achat enregistré — ${formatMAD(r.valeur_stock)} en stock`);
      reinitialiser();
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const article = articles.find((a) => a.id === form.article_id);
  const total = form.quantity && form.unit_price
    ? parseFloat(form.quantity) * parseFloat(form.unit_price)
    : null;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Nouvel achat" size="md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Combobox
            label="Article"
            required
            items={articles}
            value={form.article_id}
            onChange={choisirArticle}
            onRequestCreate={(nom) => { setNewArticleName(nom); setArticleModal(true); }}
            placeholder="Rechercher ou créer un article…"
            emptyLabel="Aucun article trouvé."
            getSecondary={(a) => a.units?.abbreviation}
          />

          <Combobox
            label="Fournisseur"
            items={suppliers}
            value={form.supplier_id}
            onChange={(s) => set('supplier_id', s ? s.id : '')}
            onRequestCreate={(nom) => { setNewSupplierName(nom); setSupplierModal(true); }}
            placeholder="Rechercher ou créer un fournisseur…"
            emptyLabel="Aucun fournisseur trouvé."
            allowEmpty
            emptyOptionLabel="— Aucun fournisseur —"
            getSecondary={(s) => s.phone}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Quantité *${article ? ` (${article.units?.abbreviation ?? ''})` : ''}`}
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

          {total !== null && !Number.isNaN(total) && (
            <div className="bg-primary-50 rounded-[var(--radius-md)] px-4 py-2 flex justify-between items-center">
              <span className="text-sm text-[var(--color-text-muted)]">Total</span>
              <span className="font-semibold text-primary">{formatMAD(total)}</span>
            </div>
          )}

          <Input label="Date *" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          <Input label="Note (optionnel)" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex : Livraison urgente" />

          {/* La date porte la pièce, pas le stock. Sans ce mot, on croit qu'une
              date antérieure fera remonter le stock dans le passé. */}
          <p className="text-xs text-[var(--color-text-faint)] -mt-1">
            La date est celle de la facture. L'entrée en stock est enregistrée maintenant.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <ArticleFormModal
        open={articleModal}
        onClose={() => setArticleModal(false)}
        onCreated={articleCree}
        initial={{ name: newArticleName }}
      />

      <SupplierModal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        onSaved={fournisseurCree}
        initialName={newSupplierName}
      />
    </>
  );
};

export default PurchaseModal;
