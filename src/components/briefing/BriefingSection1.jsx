import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ChevronDown, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { fetchClients, createClient } from '../../data/clients';
import { fetchVenues, createVenue } from '../../data/venues';
import { fetchBriefing, saveBriefingAnswers } from '../../data/briefing';
import { cn } from '../../lib/utils';
import { PageLoader } from '../ui/Spinner';

// ── Helpers UI ────────────────────────────────────────────────

const baseInput = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white';

const Label = ({ children, required }) => (
  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const Field = ({ label, required, children }) => (
  <div>
    <Label required={required}>{label}</Label>
    {children}
  </div>
);

const SelectOne = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? '' : opt)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium border transition-colors min-h-[36px]',
          value === opt
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-primary/50'
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

// ── Combobox générique ────────────────────────────────────────
// items : [{ id, label, sub? }]
// onSelect(item | null)
// onCreateNew(name) → Promise<item>

const Combobox = ({ items, value, onSelect, onCreateNew, placeholder = 'Rechercher…', creating }) => {
  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const ref = useRef(null);

  const selected = items.find((i) => i.id === value) ?? null;

  useEffect(() => {
    if (selected) setQuery(selected.label);
    else setQuery('');
  }, [selected]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  const showCreate = query.trim() && !filtered.some((i) => i.label.toLowerCase() === query.trim().toLowerCase());

  const handleSelect = (item) => {
    onSelect(item);
    setQuery(item.label);
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const item = await onCreateNew(name);
      onSelect(item);
      setQuery(item.label);
      setOpen(false);
    } catch (e) {
      toast.error(e.message || 'Erreur de création');
    }
  };

  const handleClear = () => { onSelect(null); setQuery(''); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          className={cn(baseInput, 'pr-8')}
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
      </div>

      {selected && (
        <button type="button" onClick={handleClear} className="text-xs text-[var(--color-text-faint)] hover:text-red-400 mt-1">
          Effacer la sélection
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 && !showCreate && (
            <div className="px-3 py-2 text-sm text-[var(--color-text-faint)]">Aucun résultat</div>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-warm-50 transition-colors"
            >
              <span className="font-medium">{item.label}</span>
              {item.sub && <span className="ml-1 text-xs text-[var(--color-text-faint)]">{item.sub}</span>}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="w-full text-left px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5 border-t border-[var(--color-border)]"
            >
              <Plus size={14} /> {creating ? 'Création…' : `Créer « ${query.trim()} »`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Modal création rapide client ──────────────────────────────

const ClientModal = ({ initialName, onSaved, onClose }) => {
  const [fields, setFields] = useState({ nom: initialName, telephone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!fields.nom.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const client = await createClient(fields);
      onSaved(client);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[var(--radius-lg)] shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-[var(--color-text)]">Nouveau client</h2>
        <div>
          <Label required>Nom</Label>
          <input className={baseInput} value={fields.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Nom du client" />
        </div>
        <div>
          <Label>Téléphone WhatsApp</Label>
          <input className={baseInput} value={fields.telephone} onChange={(e) => set('telephone', e.target.value)} placeholder="+212 6XX XXX XXX" />
        </div>
        <div>
          <Label>Email</Label>
          <input className={baseInput} type="email" value={fields.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemple.com" />
        </div>
        <div>
          <Label>Notes</Label>
          <textarea className={cn(baseInput, 'resize-y min-h-[72px]')} value={fields.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-[var(--radius-md)] text-sm border border-[var(--color-border)] hover:bg-warm-50 min-h-[40px]">Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 min-h-[40px]">
            {saving ? 'Création…' : 'Créer le client'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal création rapide lieu ────────────────────────────────

const VenueModal = ({ initialName, onSaved, onClose }) => {
  const [fields, setFields] = useState({ nom: initialName, adresse: '', contact_nom: '', contact_tel: '', type: '', contraintes: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!fields.nom.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const venue = await createVenue(fields);
      onSaved(venue);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const TYPES = [
    { value: 'villa_privee', label: 'Villa privée' },
    { value: 'hotel', label: 'Hôtel' },
    { value: 'salle_reception', label: 'Salle de réception' },
    { value: 'plein_air', label: 'Plein air' },
    { value: 'autre', label: 'Autre' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[var(--radius-lg)] shadow-xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl font-bold text-[var(--color-text)]">Nouveau lieu</h2>
        <div>
          <Label required>Nom du lieu</Label>
          <input className={baseInput} value={fields.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex : Villa Dar Zitoun" />
        </div>
        <div>
          <Label>Type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => set('type', fields.type === t.value ? '' : t.value)}
                className={cn('px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px]',
                  fields.type === t.value ? 'bg-primary text-white border-primary' : 'bg-white border-[var(--color-border)] hover:border-primary/50')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Adresse</Label>
          <input className={baseInput} value={fields.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="Adresse complète" />
        </div>
        <div>
          <Label>Contact sur place (nom)</Label>
          <input className={baseInput} value={fields.contact_nom} onChange={(e) => set('contact_nom', e.target.value)} placeholder="Nom du contact" />
        </div>
        <div>
          <Label>Contact sur place (téléphone)</Label>
          <input className={baseInput} value={fields.contact_tel} onChange={(e) => set('contact_tel', e.target.value)} placeholder="+212 6XX XXX XXX" />
        </div>
        <div>
          <Label>Contraintes connues</Label>
          <textarea className={cn(baseInput, 'resize-y min-h-[72px]')} value={fields.contraintes} onChange={(e) => set('contraintes', e.target.value)} rows={3} placeholder="Ex : Pas d'accès gaz, fermeture 2h..." />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-[var(--radius-md)] text-sm border border-[var(--color-border)] hover:bg-warm-50 min-h-[40px]">Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 min-h-[40px]">
            {saving ? 'Création…' : 'Créer le lieu'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Composant principal Section 1 ─────────────────────────────

const BriefingSection1 = ({ eventId }) => {
  const [clients,      setClients]      = useState([]);
  const [venues,       setVenues]       = useState([]);
  const [answers,      setAnswers]      = useState({});
  const [clientId,     setClientId]     = useState(null);
  const [venueId,      setVenueId]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [clientModal,  setClientModal]  = useState(null); // initialName string
  const [venueModal,   setVenueModal]   = useState(null);
  const [creatingCli,  setCreatingCli]  = useState(false);
  const [creatingVen,  setCreatingVen]  = useState(false);

  const set = useCallback((k, v) => setAnswers((p) => ({ ...p, [k]: v })), []);

  useEffect(() => {
    Promise.all([
      fetchClients(),
      fetchVenues(),
      fetchBriefing(eventId),
      supabase.from('events').select('client_id, venue_id').eq('id', eventId).single(),
    ]).then(([cls, vns, ans, { data: ev }]) => {
      setClients(cls);
      setVenues(vns);
      setAnswers(ans);
      setClientId(ev?.client_id ?? null);
      setVenueId(ev?.venue_id ?? null);
    }).catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const clientItems = clients.map((c) => ({ id: c.id, label: c.nom, sub: c.telephone }));
  const venueItems  = venues.map((v)  => ({ id: v.id, label: v.nom, sub: v.adresse }));

  const handleSelectClient = async (item) => {
    const id = item?.id ?? null;
    setClientId(id);
    await supabase.from('events').update({ client_id: id }).eq('id', eventId);
    if (item) {
      const client = clients.find((c) => c.id === id);
      if (client) {
        set('client_telephone', client.telephone ?? '');
        set('client_email',     client.email ?? '');
      }
    }
  };

  const handleCreateClient = async (name) => {
    setClientModal(name);
    return new Promise((resolve, reject) => {
      window.__clientModalResolve = resolve;
      window.__clientModalReject  = reject;
    });
  };

  const handleClientSaved = async (client) => {
    setClients((prev) => [...prev, client].sort((a, b) => a.nom.localeCompare(b.nom)));
    setClientModal(null);
    const item = { id: client.id, label: client.nom, sub: client.telephone };
    await handleSelectClient(item);
    window.__clientModalResolve?.(item);
  };

  const handleSelectVenue = async (item) => {
    const id = item?.id ?? null;
    setVenueId(id);
    await supabase.from('events').update({ venue_id: id }).eq('id', eventId);
    if (item) {
      const venue = venues.find((v) => v.id === id);
      if (venue) {
        set('lieu_adresse',      venue.adresse ?? '');
        set('lieu_contact_nom',  venue.contact_nom ?? '');
        set('lieu_contact_tel',  venue.contact_tel ?? '');
        set('lieu_contraintes',  venue.contraintes ?? '');
      }
    }
  };

  const handleCreateVenue = async (name) => {
    setVenueModal(name);
    return new Promise((resolve, reject) => {
      window.__venueModalResolve = resolve;
      window.__venueModalReject  = reject;
    });
  };

  const handleVenueSaved = async (venue) => {
    setVenues((prev) => [...prev, venue].sort((a, b) => a.nom.localeCompare(b.nom)));
    setVenueModal(null);
    const item = { id: venue.id, label: venue.nom, sub: venue.adresse };
    await handleSelectVenue(item);
    window.__venueModalResolve?.(item);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBriefingAnswers(eventId, answers);
      toast.success('Section 1 sauvegardée');
    } catch (e) {
      toast.error(e.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Identité événement ── */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Identité de l'événement</h3>
        <div className="flex flex-col gap-4">
          <Field label="Type d'événement">
            <SelectOne
              options={['Mariage', 'Soirée privée', 'Cocktail dînatoire', 'Séminaire', 'Festival', 'Autre']}
              value={answers.type_evenement ?? ''}
              onChange={(v) => set('type_evenement', v)}
            />
          </Field>
          <Field label="Thème / Ambiance">
            <input className={baseInput} value={answers.theme ?? ''} onChange={(e) => set('theme', e.target.value)} placeholder="Ex : Tropical, Black & White, Bohème…" />
          </Field>
          <Field label="Niveau de prestation">
            <SelectOne
              options={['Standard', 'Premium', 'Luxe']}
              value={answers.niveau_prestation ?? ''}
              onChange={(v) => set('niveau_prestation', v)}
            />
          </Field>
          <Field label="Contraintes particulières">
            <textarea className={cn(baseInput, 'resize-y min-h-[80px]')} value={answers.contraintes_evenement ?? ''} onChange={(e) => set('contraintes_evenement', e.target.value)} rows={3} placeholder="Allergies, restrictions religieuses, autres…" />
          </Field>
          <Field label="Remarques générales">
            <textarea className={cn(baseInput, 'resize-y min-h-[80px]')} value={answers.remarques_generales ?? ''} onChange={(e) => set('remarques_generales', e.target.value)} rows={3} />
          </Field>
        </div>
      </section>

      {/* ── Client ── */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Client</h3>
        <div className="flex flex-col gap-4">
          <Field label="Client" required>
            <Combobox
              items={clientItems}
              value={clientId}
              onSelect={handleSelectClient}
              onCreateNew={handleCreateClient}
              placeholder="Rechercher ou créer un client…"
              creating={creatingCli}
            />
          </Field>
          <Field label="Téléphone WhatsApp">
            <input className={baseInput} value={answers.client_telephone ?? ''} onChange={(e) => set('client_telephone', e.target.value)} placeholder="+212 6XX XXX XXX" />
          </Field>
          <Field label="Email">
            <input className={baseInput} type="email" value={answers.client_email ?? ''} onChange={(e) => set('client_email', e.target.value)} placeholder="email@exemple.com" />
          </Field>
          <Field label="Contact sur place jour J (si différent)">
            <input className={baseInput} value={answers.contact_jour_j ?? ''} onChange={(e) => set('contact_jour_j', e.target.value)} placeholder="Nom et téléphone" />
          </Field>
          <Field label="Budget global estimé">
            <input className={baseInput} type="number" min="0" value={answers.budget_global ?? ''} onChange={(e) => set('budget_global', e.target.value)} placeholder="0 MAD" />
          </Field>
        </div>
      </section>

      {/* ── Date et horaires ── */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Date et horaires</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Heure d'arrivée Epicure sur site">
            <input className={baseInput} value={answers.heure_arrivee_epicure ?? ''} onChange={(e) => set('heure_arrivee_epicure', e.target.value)} placeholder="Ex : 14h00" />
          </Field>
          <Field label="Heure d'ouverture des bars">
            <input className={baseInput} value={answers.heure_ouverture_bars ?? ''} onChange={(e) => set('heure_ouverture_bars', e.target.value)} placeholder="Ex : 18h30" />
          </Field>
          <Field label="Heure de fermeture des bars">
            <input className={baseInput} value={answers.heure_fermeture_bars ?? ''} onChange={(e) => set('heure_fermeture_bars', e.target.value)} placeholder="Ex : 01h00" />
          </Field>
          <Field label="Heure de démontage">
            <input className={baseInput} value={answers.heure_demontage ?? ''} onChange={(e) => set('heure_demontage', e.target.value)} placeholder="Ex : 01h00 → 03h00" />
          </Field>
          <Field label="Durée totale">
            <input className={baseInput} value={answers.duree_totale ?? ''} onChange={(e) => set('duree_totale', e.target.value)} placeholder="Ex : 7h" />
          </Field>
        </div>
      </section>

      {/* ── Lieu ── */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Lieu</h3>
        <div className="flex flex-col gap-4">
          <Field label="Lieu / Salle" required>
            <Combobox
              items={venueItems}
              value={venueId}
              onSelect={handleSelectVenue}
              onCreateNew={handleCreateVenue}
              placeholder="Rechercher ou créer un lieu…"
              creating={creatingVen}
            />
          </Field>
          <Field label="Adresse complète">
            <input className={baseInput} value={answers.lieu_adresse ?? ''} onChange={(e) => set('lieu_adresse', e.target.value)} placeholder="Adresse complète" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact du lieu (nom)">
              <input className={baseInput} value={answers.lieu_contact_nom ?? ''} onChange={(e) => set('lieu_contact_nom', e.target.value)} placeholder="Nom du contact" />
            </Field>
            <Field label="Contact du lieu (téléphone)">
              <input className={baseInput} value={answers.lieu_contact_tel ?? ''} onChange={(e) => set('lieu_contact_tel', e.target.value)} placeholder="+212 6XX XXX XXX" />
            </Field>
          </div>
          <Field label="Visite préalable effectuée ?">
            <SelectOne
              options={['Oui', 'Non']}
              value={answers.visite_prealable ?? ''}
              onChange={(v) => set('visite_prealable', v)}
            />
          </Field>
          {answers.visite_prealable === 'Non' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] text-sm text-amber-700">
              ⚠️ Visite préalable non effectuée — à planifier avant l'événement
            </div>
          )}
          <Field label="Contraintes connues du lieu">
            <textarea className={cn(baseInput, 'resize-y min-h-[72px]')} value={answers.lieu_contraintes ?? ''} onChange={(e) => set('lieu_contraintes', e.target.value)} rows={3} placeholder="Ex : Pas d'accès gaz, fermeture à 2h, sol en gazon…" />
          </Field>
        </div>
      </section>

      {/* ── Convives ── */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Convives</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre de convives adultes" required>
            <input className={baseInput} type="number" min="0" value={answers.nb_adultes ?? ''} onChange={(e) => set('nb_adultes', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Nombre de convives enfants">
            <input className={baseInput} type="number" min="0" value={answers.nb_enfants ?? ''} onChange={(e) => set('nb_enfants', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Ratio estimé hommes / femmes (optionnel)">
            <input className={baseInput} value={answers.ratio_hf ?? ''} onChange={(e) => set('ratio_hf', e.target.value)} placeholder="Ex : 60% H / 40% F" />
          </Field>
          <Field label="Convives VIP ?">
            <SelectOne
              options={['Oui', 'Non']}
              value={answers.convives_vip ?? ''}
              onChange={(v) => set('convives_vip', v)}
            />
          </Field>
          {answers.convives_vip === 'Oui' && (
            <div className="sm:col-span-2">
              <Field label="Précisez (qui ?)">
                <input className={baseInput} value={answers.vip_details ?? ''} onChange={(e) => set('vip_details', e.target.value)} placeholder="Noms ou description" />
              </Field>
            </div>
          )}
        </div>
      </section>

      {/* ── Bouton sauvegarder ── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          <Save size={16} />
          {saving ? 'Sauvegarde…' : 'Sauvegarder la section 1'}
        </button>
      </div>

      {/* ── Modals création à la volée ── */}
      {clientModal !== null && (
        <ClientModal
          initialName={clientModal}
          onSaved={handleClientSaved}
          onClose={() => { setClientModal(null); window.__clientModalReject?.(); }}
        />
      )}
      {venueModal !== null && (
        <VenueModal
          initialName={venueModal}
          onSaved={handleVenueSaved}
          onClose={() => { setVenueModal(null); window.__venueModalReject?.(); }}
        />
      )}
    </div>
  );
};

export default BriefingSection1;
