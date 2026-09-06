import { useState, useEffect } from 'react';
import { Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { createArticle, updateArticle, uploadArticlePhoto } from '../data/articles';
import { compresserImage, poidsLisible } from '../lib/image';
import { fetchCategories } from '../data/categories';
import { fetchUnits } from '../data/units';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input, { Select } from './ui/Input';

// ── Formulaire (source unique de vérité pour la création/édition d'article) ──
export const ArticleForm = ({ initial, categories, units, onSave, onClose, loading }) => {
  const [form, setForm] = useState({
    name: '', category_id: '', unit_id: '', type: 'retournable',
    last_purchase_price: '', low_stock_threshold: '', photo_url: '',
    ...initial,
  });
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || '');
  const [photoPoids,   setPhotoPoids]   = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // On compresse ici, pas a l'envoi : l'apercu montre alors exactement ce qui
  // partira, et le poids affiche rend le reglage verifiable d'un coup d'oeil.
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reduit = await compresserImage(file);
      setPhotoFile(reduit);
      setPhotoPreview(URL.createObjectURL(reduit));
      setPhotoPoids({ avant: file.size, apres: reduit.size });
    } catch (err) {
      // Le refus vient d'une image illisible ET trop lourde. Sans ce catch,
      // c'etait un rejet de promesse non traite : rien a l'ecran, l'apercu
      // vide, et l'envoi partait quand meme pour finir en 413 au bout d'une
      // demi-minute. Dire pourquoi tout de suite vaut mieux.
      toast.error(err.message, { duration: 8000 });
      e.target.value = '';
      setPhotoFile(null);
      setPhotoPoids(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    if (!form.category_id) { toast.error('Catégorie requise'); return; }
    if (!form.unit_id)     { toast.error('Unité requise'); return; }
    onSave(form, photoFile);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nom de l'article *"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Ex : Vodka Grey Goose 70cl"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Catégorie *" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">— Choisir —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>

        <Select label="Unité *" value={form.unit_id} onChange={(e) => set('unit_id', e.target.value)}>
          <option value="">— Choisir —</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Type *" value={form.type} onChange={(e) => set('type', e.target.value)}>
          <option value="retournable">Retournable</option>
          <option value="consommable">Consommable</option>
        </Select>

        <Input
          label="Dernier prix (MAD)"
          type="number" min="0" step="0.01"
          value={form.last_purchase_price}
          onChange={(e) => set('last_purchase_price', e.target.value)}
          placeholder="0.00"
        />
      </div>

      <Input
        label="Seuil d'alerte stock (optionnel)"
        type="number" min="0" step="0.001"
        value={form.low_stock_threshold}
        onChange={(e) => set('low_stock_threshold', e.target.value)}
        placeholder="Ex : 5"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]">Photo (optionnel)</label>
        <div className="flex items-center gap-3">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="w-16 h-16 rounded-lg object-cover border border-[var(--color-border)]" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-warm-100 flex items-center justify-center border border-[var(--color-border)]">
              <Image size={20} className="text-[var(--color-text-faint)]" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-warm-100 transition-colors">
              <Image size={14} /> Choisir
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>
        {photoPoids && (
          <p className="text-xs text-[var(--color-text-faint)]">
            {poidsLisible(photoPoids.avant)} → {poidsLisible(photoPoids.apres)} après compression
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {initial?.id ? 'Enregistrer' : "Ajouter l'article"}
        </Button>
      </div>
    </form>
  );
};

// ── Modal wrapper auto-suffisant (charge ses propres catégories + unités) ────
const ArticleFormModal = ({ open, onClose, onCreated, initial = null }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [units,      setUnits]      = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [ready,      setReady]      = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([fetchCategories(true), fetchUnits(true)])
      .then(([c, u]) => { setCategories(c); setUnits(u); setReady(true); })
      .catch(() => toast.error('Erreur de chargement'));
  }, [open]);

  const handleSave = async (form, photoFile) => {
    setSaving(true);
    try {
      const fields = {
        name:                form.name.trim(),
        category_id:         form.category_id,
        unit_id:             form.unit_id,
        type:                form.type,
        last_purchase_price: parseFloat(form.last_purchase_price) || 0,
        low_stock_threshold: form.low_stock_threshold ? parseFloat(form.low_stock_threshold) : null,
      };

      if (initial?.id) {
        if (photoFile) fields.photo_url = await uploadArticlePhoto(photoFile, initial.id);
        const updated = await updateArticle(initial.id, fields, user.id);
        toast.success('Article mis à jour');
        onCreated?.(updated);
      } else {
        const newArt = await createArticle({ ...fields, photo_url: null }, user.id);
        if (photoFile) {
          const url = await uploadArticlePhoto(photoFile, newArt.id);
          await updateArticle(newArt.id, { photo_url: url }, user.id);
          newArt.photo_url = url;
        }
        toast.success('Article ajouté');
        onCreated?.(newArt);
      }
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Modifier l'article" : 'Ajouter un article'}
      size="md"
    >
      {ready ? (
        <ArticleForm
          initial={initial}
          categories={categories}
          units={units}
          onSave={handleSave}
          onClose={onClose}
          loading={saving}
        />
      ) : (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </Modal>
  );
};

export default ArticleFormModal;
