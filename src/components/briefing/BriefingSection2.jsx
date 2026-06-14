import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchBriefing, saveBriefingAnswers } from '../../data/briefing';
import { cn } from '../../lib/utils';
import { PageLoader } from '../ui/Spinner';

const baseInput = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white';

const Label = ({ children }) => (
  <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{children}</label>
);

const Field = ({ label, children }) => (
  <div><Label>{label}</Label>{children}</div>
);

const SelectOne = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? '' : opt)}
        className={cn(
          'px-3 py-2 rounded-full text-sm font-medium border transition-colors min-h-[36px]',
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

const TYPES_BAR = [
  'Construit sur place',
  'Bar mobile Epicure',
  'Bar loué externe',
  'Bar improvisé',
  'Combinaison',
];

const ENTITES = ['Epicure Catering', 'Central Bistro', 'Business Boys', 'KPI Gestion', 'Autre'];
const FOURNISSEURS = ['Epicure', 'Lieu', 'Prestataire'];
const HAUTEURS = ['Standard', 'Haute', 'Basse'];

// ── Panneau d'un bar ──────────────────────────────────────────

const BarPanel = ({ index, answers, set }) => {
  const [open, setOpen] = useState(index === 0);
  const k = (key) => `bar_${index + 1}_${key}`;
  const v = (key) => answers[k(key)] ?? '';

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">

      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-warm-50 hover:bg-warm-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-sm text-[var(--color-text)]">Bar {index + 1}</p>
            {v('localisation') && (
              <p className="text-xs text-[var(--color-text-muted)]">{v('localisation')}</p>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-[var(--color-text-faint)]" /> : <ChevronDown size={18} className="text-[var(--color-text-faint)]" />}
      </button>

      {open && (
        <div className="p-5 flex flex-col gap-6 bg-white">

          {/* Type de bar */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Type de bar</h4>
            <Field label="Type">
              <SelectOne options={TYPES_BAR} value={v('type')} onChange={(val) => set(k('type'), val)} />
            </Field>

            {/* Construit sur place */}
            {v('type') === 'Construit sur place' && (
              <div className="mt-4 flex flex-col gap-3 pl-3 border-l-2 border-primary/20">
                <Field label="Dimensions (L × l × H)">
                  <input className={baseInput} value={v('dimensions')} onChange={(e) => set(k('dimensions'), e.target.value)} placeholder="Ex : 4m × 0.8m × 1.1m" />
                </Field>
                <Field label="Accès électricité">
                  <SelectOne options={['Oui', 'Non']} value={v('acces_elec')} onChange={(val) => set(k('acces_elec'), val)} />
                </Field>
                <Field label="Accès eau courante">
                  <SelectOne options={['Oui', 'Non']} value={v('acces_eau')} onChange={(val) => set(k('acces_eau'), val)} />
                </Field>
                <Field label="Espace stockage derrière">
                  <SelectOne options={['Oui', 'Non']} value={v('stockage_arriere')} onChange={(val) => set(k('stockage_arriere'), val)} />
                </Field>
                <Field label="Bar utilisable tel quel ?">
                  <SelectOne options={['Oui', 'Non']} value={v('utilisable_tel_quel')} onChange={(val) => set(k('utilisable_tel_quel'), val)} />
                </Field>
                {v('utilisable_tel_quel') === 'Non' && (
                  <Field label="Qu'est-ce qui manque ?">
                    <textarea className={cn(baseInput, 'resize-y min-h-[72px]')} value={v('manque')} onChange={(e) => set(k('manque'), e.target.value)} rows={3} />
                  </Field>
                )}
              </div>
            )}

            {/* Bar mobile Epicure */}
            {v('type') === 'Bar mobile Epicure' && (
              <div className="mt-4 flex flex-col gap-3 pl-3 border-l-2 border-primary/20">
                <Field label="Modèle du bar mobile">
                  <input className={baseInput} value={v('modele')} onChange={(e) => set(k('modele'), e.target.value)} placeholder="Nom du modèle" />
                </Field>
                <Field label="Dimensions espace disponible">
                  <input className={baseInput} value={v('dimensions_espace')} onChange={(e) => set(k('dimensions_espace'), e.target.value)} placeholder="Ex : 5m × 3m" />
                </Field>
                <Field label="Type de sol">
                  <SelectOne options={['Dur', 'Gazon', 'Sable', 'Carrelage', 'Autre']} value={v('type_sol')} onChange={(val) => set(k('type_sol'), val)} />
                </Field>
                <Field label="Accès électricité">
                  <SelectOne options={['Oui', 'Non']} value={v('acces_elec')} onChange={(val) => set(k('acces_elec'), val)} />
                </Field>
                <Field label="Accès eau courante">
                  <SelectOne options={['Oui', 'Non']} value={v('acces_eau')} onChange={(val) => set(k('acces_eau'), val)} />
                </Field>
                <Field label="Accès livraison facile">
                  <SelectOne options={['Oui', 'Non']} value={v('acces_livraison')} onChange={(val) => set(k('acces_livraison'), val)} />
                </Field>
                <Field label="Distance depuis point de déchargement">
                  <input className={baseInput} value={v('distance_dechargement')} onChange={(e) => set(k('distance_dechargement'), e.target.value)} placeholder="Ex : 50m" />
                </Field>
              </div>
            )}
          </div>

          {/* Equipement technique */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Équipement technique</h4>
            <div className="flex flex-col gap-3">
              {[
                { key: 'frigos',       label: 'Frigos' },
                { key: 'machine_glace',label: 'Machine à glace' },
                { key: 'machine_cafe', label: 'Machine à café' },
                { key: 'blender',      label: 'Blender' },
                { key: 'eclairage',    label: 'Éclairage bar' },
                { key: 'sono',         label: 'Sono propre au bar' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-[var(--color-text)] w-40 flex-shrink-0">{label}</span>
                  <SelectOne
                    options={['Oui', 'Non']}
                    value={v(`${key}_present`)}
                    onChange={(val) => set(k(`${key}_present`), val)}
                  />
                  {v(`${key}_present`) === 'Oui' && (
                    <SelectOne
                      options={FOURNISSEURS}
                      value={v(`${key}_fournisseur`)}
                      onChange={(val) => set(k(`${key}_fournisseur`), val)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Emplacement */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Emplacement</h4>
            <div className="flex flex-col gap-3">
              <Field label="Localisation exacte dans le lieu">
                <input className={baseInput} value={v('localisation')} onChange={(e) => set(k('localisation'), e.target.value)} placeholder="Ex : Terrasse principale, salle de réception…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Superficie (m²)">
                  <input className={baseInput} type="number" min="0" value={v('superficie')} onChange={(e) => set(k('superficie'), e.target.value)} placeholder="0" />
                </Field>
                <Field label="Faces de service">
                  <SelectOne options={['1', '2', '3', '4']} value={v('faces_service')} onChange={(val) => set(k('faces_service'), val)} />
                </Field>
              </div>
              <Field label="Hauteur de service">
                <SelectOne options={HAUTEURS} value={v('hauteur_service')} onChange={(val) => set(k('hauteur_service'), val)} />
              </Field>
              <Field label="Distance depuis point de stockage sur site">
                <input className={baseInput} value={v('distance_stockage')} onChange={(e) => set(k('distance_stockage'), e.target.value)} placeholder="Ex : 20m" />
              </Field>
            </div>
          </div>

          {/* Staff affecté */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Staff affecté</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre de bartenders">
                <input className={baseInput} type="number" min="0" value={v('nb_bartenders')} onChange={(e) => set(k('nb_bartenders'), e.target.value)} placeholder="0" />
              </Field>
              <Field label="Nombre de runners">
                <input className={baseInput} type="number" min="0" value={v('nb_runners')} onChange={(e) => set(k('nb_runners'), e.target.value)} placeholder="0" />
              </Field>
              <Field label="Heure d'arrivée staff">
                <input className={baseInput} value={v('heure_arrivee_staff')} onChange={(e) => set(k('heure_arrivee_staff'), e.target.value)} placeholder="Ex : 14h00" />
              </Field>
              <Field label="Heure de fin staff">
                <input className={baseInput} value={v('heure_fin_staff')} onChange={(e) => set(k('heure_fin_staff'), e.target.value)} placeholder="Ex : 03h00" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Chef de bar désigné ?">
                <SelectOne options={['Oui', 'Non']} value={v('chef_bar')} onChange={(val) => set(k('chef_bar'), val)} />
              </Field>
              {v('chef_bar') === 'Oui' && (
                <div className="mt-2">
                  <Field label="Qui ?">
                    <input className={baseInput} value={v('chef_bar_nom')} onChange={(e) => set(k('chef_bar_nom'), e.target.value)} placeholder="Nom du chef de bar" />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* Service */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Service</h4>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Heure d'ouverture">
                  <input className={baseInput} value={v('heure_ouverture')} onChange={(e) => set(k('heure_ouverture'), e.target.value)} placeholder="Ex : 19h00" />
                </Field>
                <Field label="Heure de fermeture">
                  <input className={baseInput} value={v('heure_fermeture')} onChange={(e) => set(k('heure_fermeture'), e.target.value)} placeholder="Ex : 01h00" />
                </Field>
              </div>
              <Field label="Type de service">
                <SelectOne options={['Continu', 'Par sessions']} value={v('type_service')} onChange={(val) => set(k('type_service'), val)} />
              </Field>
              <Field label="Bar principal ou secondaire ?">
                <SelectOne options={['Principal', 'Secondaire']} value={v('rang')} onChange={(val) => set(k('rang'), val)} />
              </Field>
              <Field label="Bar enfants (softs uniquement) ?">
                <SelectOne options={['Oui', 'Non']} value={v('bar_enfants')} onChange={(val) => set(k('bar_enfants'), val)} />
              </Field>
            </div>
          </div>

          {/* Facturation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Facturation</h4>
            <div className="flex flex-col gap-3">
              <Field label="Entité facturante">
                <SelectOne options={ENTITES} value={v('entite_facturation')} onChange={(val) => set(k('entite_facturation'), val)} />
              </Field>
              <Field label="Inclus dans forfait global ?">
                <SelectOne options={['Oui', 'Non — facturation séparée']} value={v('inclus_forfait')} onChange={(val) => set(k('inclus_forfait'), val)} />
              </Field>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

// ── Composant principal Section 2 ─────────────────────────────

const BriefingSection2 = ({ eventId }) => {
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetchBriefing(eventId)
      .then(setAnswers)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const set = useCallback((k, v) => setAnswers((p) => ({ ...p, [k]: v })), []);

  const nbBars = Math.min(5, Math.max(1, parseInt(answers.nb_bars ?? '1') || 1));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBriefingAnswers(eventId, answers);
      toast.success('Section 2 sauvegardée');
    } catch (e) {
      toast.error(e.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">

      {/* Nombre de bars */}
      <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-base font-semibold text-[var(--color-text)] mb-4">Nombre de bars</h3>
        <SelectOne
          options={['1', '2', '3', '4', '5']}
          value={answers.nb_bars ?? '1'}
          onChange={(v) => set('nb_bars', v)}
        />
      </section>

      {/* Un panneau par bar */}
      {Array.from({ length: nbBars }, (_, i) => (
        <BarPanel key={i} index={i} answers={answers} set={set} />
      ))}

      {/* Sauvegarder */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          <Save size={16} />
          {saving ? 'Sauvegarde…' : 'Sauvegarder la section 2'}
        </button>
      </div>
    </div>
  );
};

export default BriefingSection2;
