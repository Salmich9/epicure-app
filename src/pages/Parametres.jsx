import { useState, useEffect } from 'react';
import { Plus, Pencil, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Key, UserPlus, Save, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePermission from '../hooks/usePermission';
import { fetchCategories, createCategory, updateCategory, reorderCategories } from '../data/categories';
import { fetchUnits, createUnit, updateUnit } from '../data/units';
import { fetchUsers, fetchRoles, createUser, updateUser, toggleUserActive } from '../data/users';
import { fetchAllPermissions, updatePermission } from '../data/permissions';
import { fetchSettings, updateSetting } from '../data/settings';
import { fetchSuppliers } from '../data/purchases';
import SupplierModal from '../components/SupplierModal';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Select } from '../components/ui/Input';
import { PageLoader } from '../components/ui/Spinner';

// ── Onglet Catégories ─────────────────────────────────────────
const CategoriesTab = () => {
  const { user } = useAuth();
  const [cats,    setCats]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [name,    setName]    = useState('');
  const [saving,  setSaving]  = useState(false);

  const load = () => fetchCategories().then(setCats).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setName(''); setModal(true); };
  const openEdit = (c) => { setEditing(c); setName(c.name); setModal(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { name: name.trim() }, user.id);
        toast.success('Catégorie mise à jour');
      } else {
        const maxOrder = cats.reduce((m, c) => Math.max(m, c.sort_order), 0);
        await createCategory({ name: name.trim(), sort_order: maxOrder + 1 }, user.id);
        toast.success('Catégorie ajoutée');
      }
      setModal(false);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const move = async (idx, dir) => {
    const arr = [...cats];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    setCats(arr);
    await reorderCategories(arr.map((c) => c.id), user.id);
  };

  const toggleActive = async (c) => {
    await updateCategory(c.id, { active: !c.active }, user.id);
    await load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-[var(--color-text)]">Catégories ({cats.length})</h3>
        <Button size="sm" onClick={openAdd}><Plus size={14} /> Ajouter</Button>
      </div>
      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        {cats.map((c, idx) => (
          <div key={c.id} className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0 ${!c.active ? 'opacity-50' : ''}`}>
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="h-5 flex items-center justify-center text-[var(--color-text-faint)] hover:text-primary disabled:opacity-30"><ChevronUp size={14} /></button>
              <button onClick={() => move(idx, 1)} disabled={idx === cats.length - 1} className="h-5 flex items-center justify-center text-[var(--color-text-faint)] hover:text-primary disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
            <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{c.name}</span>
            <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-warm-100 text-[var(--color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil size={14} /></button>
            <button onClick={() => toggleActive(c)} className="p-1.5 rounded hover:bg-warm-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
              {c.active ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-[var(--color-text-faint)]" />}
            </button>
          </div>
        ))}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Onglet Unités ─────────────────────────────────────────────
const UnitesTab = () => {
  const { user } = useAuth();
  const [units,   setUnits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ name: '', abbreviation: '' });
  const [saving,  setSaving]  = useState(false);

  const load = () => fetchUnits().then(setUnits).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm({ name: '', abbreviation: '' }); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, abbreviation: u.abbreviation }); setModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.abbreviation.trim()) { toast.error('Tous les champs sont requis'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateUnit(editing.id, form, user.id);
        toast.success('Unité mise à jour');
      } else {
        await createUnit(form, user.id);
        toast.success('Unité ajoutée');
      }
      setModal(false);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await updateUnit(u.id, { active: !u.active }, user.id);
    await load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-[var(--color-text)]">Unités ({units.length})</h3>
        <Button size="sm" onClick={openAdd}><Plus size={14} /> Ajouter</Button>
      </div>
      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        {units.map((u) => (
          <div key={u.id} className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0 ${!u.active ? 'opacity-50' : ''}`}>
            <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{u.name}</span>
            <span className="text-xs text-[var(--color-text-faint)] bg-warm-100 px-2 py-0.5 rounded font-mono">{u.abbreviation}</span>
            <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-warm-100 text-[var(--color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil size={14} /></button>
            <button onClick={() => toggleActive(u)} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              {u.active ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-[var(--color-text-faint)]" />}
            </button>
          </div>
        ))}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'unité' : 'Nouvelle unité'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex : Bouteille" autoFocus />
          <Input label="Abréviation *" value={form.abbreviation} onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))} placeholder="Ex : btl" />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Onglet Utilisateurs ───────────────────────────────────────
const UtilisateursTab = () => {
  const { user: me } = useAuth();
  const canManage = usePermission('users.manage');
  const [users,   setUsers]   = useState([]);
  const [roles,   setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState({ full_name: '', pin: '', role_id: '', active: true });
  const [saving,  setSaving]  = useState(false);

  const load = async () => {
    const [u, r] = await Promise.all([fetchUsers(), fetchRoles()]);
    setUsers(u); setRoles(r);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm({ full_name: '', pin: '', role_id: roles[0]?.id ?? '', active: true }); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ full_name: u.full_name, pin: '', role_id: u.role_id, active: u.active }); setModal(true); };

  const handleSave = async () => {
    if (!form.full_name.trim())   { toast.error('Nom requis'); return; }
    if (!editing && !form.pin)    { toast.error('PIN requis'); return; }
    if (form.pin && form.pin.length < 4) { toast.error('PIN trop court (min. 4 chiffres)'); return; }
    setSaving(true);
    try {
      if (editing) {
        const upd = { full_name: form.full_name, role_id: form.role_id };
        if (form.pin) upd.pin = form.pin;
        await updateUser(editing.id, upd, me.id);
        toast.success('Utilisateur mis à jour');
      } else {
        await createUser({ full_name: form.full_name, pin: form.pin, role_id: form.role_id }, me.id);
        toast.success('Utilisateur créé');
      }
      setModal(false);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (u) => {
    await toggleUserActive(u.id, !u.active, me.id);
    await load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-[var(--color-text)]">Utilisateurs ({users.length})</h3>
        {canManage && <Button size="sm" onClick={openAdd}><UserPlus size={14} /> Ajouter</Button>}
      </div>
      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0 ${!u.active ? 'opacity-50' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
              {u.full_name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{u.full_name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{u.roles?.name}</p>
            </div>
            {canManage && (
              <>
                <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-warm-100 text-[var(--color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center" title="Modifier / PIN"><Key size={14} /></button>
                <button onClick={() => toggle(u)} className="min-h-[44px] min-w-[44px] flex items-center justify-center" disabled={u.id === me.id}>
                  {u.active ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-[var(--color-text-faint)]" />}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom complet *" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} autoFocus />
          <Select label="Rôle *" value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
          <Input
            label={editing ? 'Nouveau PIN (laisser vide pour ne pas changer)' : 'PIN *'}
            type="password"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            placeholder={editing ? '······' : 'Ex : 1234'}
            maxLength={8}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Onglet Permissions ────────────────────────────────────────
const ALL_KEYS = [
  'dashboard.read',
  'articles.read','articles.create','articles.update','articles.delete',
  'categories.manage','units.manage',
  'inventory.create','inventory.validate','inventory.read',
  'depot.read',
  'events.read','events.create','events.manage',
  'settings.read','settings.manage',
  'purchases.read','purchases.create',
  'users.manage','permissions.manage','historique.read',
];

const PermissionsTab = () => {
  const { reloadPermissions } = useAuth();
  const [perms,  setPerms]  = useState([]);
  const [roles,  setRoles]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});

  useEffect(() => {
    Promise.all([fetchAllPermissions(), fetchRoles()])
      .then(([p, r]) => { setPerms(p); setRoles(r); })
      .finally(() => setLoading(false));
  }, []);

  const isAllowed = (roleId, key) =>
    perms.some((p) => p.role_id === roleId && p.permission_key === key && p.allowed);

  const toggle = async (roleId, key, current) => {
    const k = `${roleId}:${key}`;
    setSaving((s) => ({ ...s, [k]: true }));
    try {
      await updatePermission(roleId, key, !current);
      setPerms((prev) => {
        const exists = prev.find((p) => p.role_id === roleId && p.permission_key === key);
        if (exists) return prev.map((p) => p.role_id === roleId && p.permission_key === key ? { ...p, allowed: !current } : p);
        return [...prev, { role_id: roleId, permission_key: key, allowed: !current }];
      });
      await reloadPermissions();
    } catch (e) { toast.error(e.message); }
    finally { setSaving((s) => ({ ...s, [k]: false })); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        <thead>
          <tr className="bg-warm-50 border-b border-[var(--color-border)]">
            <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-muted)]">Permission</th>
            {roles.map((r) => (
              <th key={r.id} className="px-3 py-2 text-center font-semibold text-[var(--color-text-muted)] whitespace-nowrap">{r.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_KEYS.map((key) => (
            <tr key={key} className="border-b border-[var(--color-border)] last:border-0 hover:bg-warm-50/50">
              <td className="px-3 py-2 font-mono text-[var(--color-text)]">{key}</td>
              {roles.map((r) => {
                const allowed = isAllowed(r.id, key);
                const k = `${r.id}:${key}`;
                return (
                  <td key={r.id} className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggle(r.id, key, allowed)}
                      disabled={saving[k]}
                      className={`w-8 h-5 rounded-full transition-colors duration-200 relative ${allowed ? 'bg-primary' : 'bg-warm-200'} disabled:opacity-50`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${allowed ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Onglet Réglages ───────────────────────────────────────────
const SETTINGS_META = [
  { key: 'devise',              label: 'Devise',                      description: 'Devise affichée dans toute l\'app',          type: 'text' },
  { key: 'taux_retour_alerte',  label: 'Taux de retour alerte (%)',   description: 'En dessous de ce taux, un événement est en alerte', type: 'number' },
  { key: 'seuil_ecart_valeur',  label: 'Seuil écart significatif (MAD)', description: 'Au-delà, le KPI écarts passe au rouge',   type: 'number' },
  { key: 'stock_alerte_defaut', label: 'Seuil stock alerte par défaut', description: 'Valeur pré-remplie pour les nouveaux articles', type: 'number' },
  { key: 'dashboard_cache_ttl', label: 'Cache dashboard (secondes)',  description: 'Durée avant rechargement automatique des KPIs', type: 'number' },
  { key: 'max_articles_panier', label: 'Max articles par panier',     description: 'Limite d\'articles différents par prélèvement', type: 'number' },
];

const ReglagesTab = () => {
  const [values,  setValues]  = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});

  useEffect(() => {
    fetchSettings()
      .then(setValues)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await updateSetting(key, values[key]);
      toast.success('Paramètre enregistré');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4">
      {SETTINGS_META.map(({ key, label, description, type }) => (
        <div key={key} className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type={type}
                value={values[key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="w-28 h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                onClick={() => handleSave(key)}
                disabled={saving[key]}
                className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-md)] bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Enregistrer"
              >
                <Save size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Fournisseurs ──────────────────────────────────────────────
//
// Vivaient dans la page Achats, disparue. Ils rejoignent les catégories et les
// unités : un référentiel qu'on remplit une fois et qu'on ne rouvre presque
// jamais n'a rien à faire sur l'écran de travail quotidien.
//
// La création reste possible sans venir ici — taper un nom inconnu dans la
// saisie d'achat suffit. Cet onglet sert à corriger, pas à alimenter.
const FournisseursTab = () => {
  const canManage = usePermission('purchases.create');
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    fetchSuppliers(false)
      .then(setListe)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoader />;

  return (
    <div>
      {canManage && (
        <Button className="gap-2 mb-4" onClick={() => { setEditing(null); setModal(true); }}>
          <Plus size={16} /> Nouveau fournisseur
        </Button>
      )}

      <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        {liste.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-faint)]">
            <Building2 size={32} className="mx-auto mb-3 opacity-30" />
            Aucun fournisseur enregistré.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {liste.map((s) => (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{s.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {s.phone ?? ''}{s.note ? ` · ${s.note}` : ''}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => { setEditing(s); setModal(true); }}
                    className="text-xs text-[var(--color-text-muted)] hover:text-primary px-3 py-1 rounded border border-[var(--color-border)] hover:border-primary transition-colors"
                  >
                    Modifier
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <SupplierModal
        open={modal}
        onClose={() => { setModal(false); setEditing(null); }}
        onSaved={load}
        editing={editing}
      />
    </div>
  );
};

// ── Page Paramètres ───────────────────────────────────────────
const TABS = [
  { id: 'categories',  label: 'Catégories',  perm: 'categories.manage' },
  { id: 'unites',      label: 'Unités',       perm: 'units.manage' },
  { id: 'fournisseurs',label: 'Fournisseurs', perm: 'purchases.read' },
  { id: 'utilisateurs',label: 'Utilisateurs', perm: 'settings.read' },
  { id: 'permissions', label: 'Permissions',  perm: 'permissions.manage' },
  { id: 'reglages',    label: 'Réglages',     perm: 'settings.manage' },
];

const Parametres = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState('categories');
  const visible = TABS.filter((t) => can(t.perm));

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-6">Paramètres</h1>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 bg-warm-100 p-1 rounded-[var(--radius-md)] overflow-x-auto">
        {visible.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-max px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors duration-150 min-h-[44px] whitespace-nowrap ${
              tab === t.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'categories'   && <CategoriesTab />}
      {tab === 'unites'       && <UnitesTab />}
      {tab === 'fournisseurs' && <FournisseursTab />}
      {tab === 'utilisateurs' && <UtilisateursTab />}
      {tab === 'permissions'  && <PermissionsTab />}
      {tab === 'reglages'     && <ReglagesTab />}
    </div>
  );
};

export default Parametres;
