import { ArrowLeft, Printer } from 'lucide-react';
import Button from './Button';
import { formatDate } from '../../lib/utils';

/**
 * Le châssis commun des documents imprimables.
 *
 * POURQUOI EXTRAIRE. Il y a maintenant trois bons — prélèvement, écart,
 * commande — et deux d'entre eux vivent dans des fichiers différents. L'en-tête,
 * la barre d'outils et le bloc de signatures étaient déjà dupliqués mot pour mot
 * entre les deux premiers ; un troisième aurait figé la triplication. Le
 * `id="bon-print"` que cible le CSS d'impression n'existe qu'ici : impossible
 * d'en oublier un.
 *
 * LE BOUTON IMPRIMER NE BOUGE PAS. C'est la seule sortie qui ne dépend d'aucune
 * API du navigateur — ni partage natif, ni presse-papier, ni contexte sécurisé.
 * Quels que soient les `actions` passées, il reste.
 */

export const BonShell = ({ titre, onClose, actions = null, children }) => (
  <div className="fixed inset-0 z-50 bg-white overflow-y-auto" id="bon-print">
    <div className="no-print flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-border)] bg-warm-50 sticky top-0 z-10">
      <Button variant="outline" size="sm" onClick={onClose} className="gap-1 flex-shrink-0">
        <ArrowLeft size={14} /> <span className="hidden sm:inline">Retour</span>
      </Button>
      <span className="text-sm font-medium text-[var(--color-text-muted)] truncate">{titre}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <Button size="sm" onClick={() => window.print()} className="gap-1">
          <Printer size={14} /> <span className="hidden sm:inline">Imprimer</span>
        </Button>
      </div>
    </div>
    <div className="max-w-3xl mx-auto p-4 sm:p-8">{children}</div>
  </div>
);

/**
 * L'en-tête : identité, sous-titre, date d'impression, puis les métadonnées.
 *
 * `lignes` = [{ label, valeur }]. Deux colonnes sur téléphone, trois à
 * l'impression : trois libellés côte à côte sur 375 px se coupent en plein mot.
 */
export const BonEntete = ({ sousTitre, lignes = [] }) => (
  <>
    <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b-2 border-primary">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">Epicure</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{sousTitre}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-[var(--color-text-muted)]">Imprimé le</p>
        <p className="text-sm font-medium">{formatDate(new Date())}</p>
      </div>
    </div>

    {lignes.length > 0 && (
      <div className="grid grid-cols-2 print:grid-cols-3 sm:grid-cols-3 gap-4 mb-6 p-4 bg-warm-50 rounded-[var(--radius-md)] print-groupe">
        {lignes.map(({ label, valeur }) => (
          <div key={label}>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
            <p className="font-semibold mt-0.5 break-words">{valeur || '—'}</p>
          </div>
        ))}
      </div>
    )}
  </>
);

const Ligne = ({ nom, role }) => (
  <div className="print-groupe">
    <p className="text-sm font-medium">{nom}</p>
    <p className="text-xs text-[var(--color-text-muted)] mb-6">{role}</p>
    <div className="border-b border-[var(--color-border-dark)] mt-8" />
    <p className="text-xs text-[var(--color-text-faint)] mt-1">Signature</p>
  </div>
);

export const BonSignatures = ({ responsibles = [], avecDepot = true }) => (
  <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
    <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-4">Signatures</p>
    <div className="grid grid-cols-2 gap-6 sm:gap-8">
      {responsibles.slice(0, 4).map((r) => (
        <Ligne key={r.id} nom={r.name} role={r.role_label} />
      ))}
      {avecDepot && <Ligne nom="Responsable dépôt" role="Epicure" />}
    </div>
  </div>
);

/**
 * Une ligne d'en-tête de famille dans une table condensée.
 *
 * C'est ce qui remplace les 19 tables du bon de prélèvement : une table unique
 * où les familles sont des lignes à `colspan`. Un tableau de deux lignes coûtait
 * autant de chrome — bordure, en-tête, marge — que son contenu.
 */
export const LigneFamille = ({ titre, colonnes }) => (
  <tr className="bg-warm-100/70 border-t border-[var(--color-border)]">
    <td colSpan={colonnes} className="px-3 py-1.5 text-xs font-semibold text-primary uppercase tracking-wide">
      {titre}
    </td>
  </tr>
);
