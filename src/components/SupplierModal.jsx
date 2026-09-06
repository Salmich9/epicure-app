import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { createSupplier, updateSupplier } from '../data/purchases';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';

/**
 * Création et modification d'un fournisseur.
 *
 * Vivait dans la page Achats, qui a disparu. Deux appelants désormais : la
 * saisie d'achat, qui le déclenche quand on tape un nom inconnu, et l'onglet
 * Fournisseurs des Paramètres, qui l'ouvre en modification.
 */
const SupplierModal = ({ open, onClose, onSaved, editing = null, initialName = '' }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ name: editing.name, phone: editing.phone ?? '', note: editing.note ?? '' });
    else setForm({ name: initialName, phone: '', note: '' });
  }, [editing, open, initialName]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const r = editing
        ? await updateSupplier(editing.id, form, user.id)
        : await createSupplier(form, user.id);
      toast.success(editing ? 'Fournisseur mis à jour' : 'Fournisseur ajouté');
      onSaved(r);
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
        <Input label="Nom *" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        <Input label="Téléphone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Ex : +212 6XX XXX XXX" />
        <Input label="Note" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex : Livraison le mardi" />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="flex-1" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

export default SupplierModal;
