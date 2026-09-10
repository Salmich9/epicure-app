import { useState, useEffect, useMemo, Fragment } from 'react';
import { Share2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAlertArticles } from '../data/dashboard';
import { texteBonCommande, partagerTexte } from '../lib/bonCommande';
import { BonShell, BonEntete, LigneFamille } from './ui/Bon';
import { PageLoader } from './ui/Spinner';
import Button from './ui/Button';
import { formatMAD, formatQty, formatDate } from '../lib/utils';

/**
 * Transforme les articles en alerte en bon de commande.
 *
 * DEUX ÉTAPES, ET C'EST LE POINT DE CONCEPTION. La saisie est un formulaire :
 * on coche, on ajuste. Le bon est un document : il s'imprime et se partage.
 * Mélanger les deux donnerait un imprimé plein de cases à cocher, ou un
 * formulaire qu'on n'ose pas modifier parce qu'il ressemble déjà à un envoi.
 *
 * LA QUANTITÉ VIENT DE `v_depot.a_commander` (migration 044), pas d'un calcul
 * local. La formule d'alerte existait déjà quatre fois dans ce projet, dont une
 * en JavaScript ; en écrire une cinquième dans l'écran qui déclenche les achats
 * n'était pas envisageable.
 *
 * LES FAMILLES GROUPENT SANS REPLIER. Ailleurs — Dépôt, Inventaire — le repli
 * fait gagner des milliers de pixels. Ici, c'est une liste à cocher : une ligne
 * cachée est une ligne qu'on ne commande pas sans le savoir.
 */
const BonCommande = ({ onClose }) => {
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etape,   setEtape]   = useState('saisie');   // 'saisie' | 'bon'
  const [choix,   setChoix]   = useState({});         // article_id → { pris, qte }
  const [texteBrut, setTexteBrut] = useState(null);   // dernier repli

  useEffect(() => {
    fetchAlertArticles()
      .then((data) => {
        setAlertes(data);
        const init = {};
        data.forEach((a) => {
          const q = Number(a.a_commander ?? 0);
          // LE CAS LIMITE. Le test d'alerte est `<=`, donc un article
          // exactement au seuil EST en alerte alors qu'il ne manque rien :
          // `a_commander` vaut 0. La ligne s'affiche — cacher une alerte
          // réelle serait pire — mais décochée : on ne fabrique pas une
          // quantité que personne n'a demandée.
          init[a.article_id] = { pris: q > 0, qte: String(q) };
        });
        setChoix(init);
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const lignes = useMemo(() => alertes.map((a) => ({
    ...a,
    pris: choix[a.article_id]?.pris ?? false,
    qte:  Number(choix[a.article_id]?.qte ?? 0),
  })), [alertes, choix]);

  const retenues = useMemo(
    () => lignes.filter((l) => l.pris && l.qte > 0),
    [lignes]
  );

  const parFamille = useMemo(() => {
    const map = {};
    lignes.forEach((l) => {
      const k = l.categorie_id ?? 'x';
      if (!map[k]) map[k] = { nom: l.categorie ?? 'Sans famille', ordre: l.categorie_ordre ?? 99, items: [] };
      map[k].items.push(l);
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.ordre - b.ordre);
  }, [lignes]);

  // « Estimation », jamais « valeur » : on prévoit un décaissement, on ne
  // valorise pas un stock. C'est la seule place de l'app où le dernier prix
  // payé est le bon chiffre — partout ailleurs c'est le coût moyen.
  const estimation = (l) => l.qte * Number(l.dernier_prix ?? 0);
  const total = retenues.reduce((s, l) => s + estimation(l), 0);

  const pourEnvoi = retenues.map((l) => ({
    article: l.article, quantite: l.qte, unite: l.unite,
    categorie: l.categorie, estimation: estimation(l),
  }));

  // APPEL SYNCHRONE : pas un seul `await` avant `navigator.share`, sinon le
  // geste utilisateur a expiré et Chrome répond `NotAllowedError`.
  const partager = () => {
    const texte = texteBonCommande(pourEnvoi);
    partagerTexte({ titre: 'Bon de commande — Epicure', texte })
      .then((issue) => {
        if (issue === 'presse-papier') toast.success('Copié — collez dans WhatsApp ou Telegram');
        // 'annule' : l'utilisateur a fermé la feuille de partage. Rien à dire.
      })
      .catch(() => setTexteBrut(texte));
  };

  if (loading) return <PageLoader />;

  // ── Le document ────────────────────────────────────────────
  if (etape === 'bon') {
    const parFamilleRetenues = {};
    retenues.forEach((l) => {
      const k = l.categorie_id ?? 'x';
      if (!parFamilleRetenues[k]) parFamilleRetenues[k] = { nom: l.categorie ?? 'Sans famille', ordre: l.categorie_ordre ?? 99, items: [] };
      parFamilleRetenues[k].items.push(l);
    });
    const familles = Object.entries(parFamilleRetenues)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.ordre - b.ordre);

    return (
      <BonShell
        titre="Bon de commande"
        onClose={() => setEtape('saisie')}
        actions={
          <Button size="sm" variant="outline" onClick={partager} className="gap-1">
            <Share2 size={14} /> <span className="hidden sm:inline">Partager</span>
          </Button>
        }
      >
        <BonEntete
          sousTitre="Bon de commande"
          lignes={[
            { label: 'Établi le',   valeur: formatDate(new Date()) },
            { label: 'Références',  valeur: String(retenues.length) },
            { label: 'Estimation',  valeur: formatMAD(total) },
          ]}
        />

        <table className="w-full text-sm border border-[var(--color-border)] rounded overflow-hidden mb-4">
          <thead>
            <tr className="bg-warm-50 text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Article</th>
              <th className="px-3 py-2 text-right w-28">Quantité</th>
              <th className="px-3 py-2 text-right w-32">Estimation</th>
            </tr>
          </thead>
          <tbody>
            {familles.map((f) => (
              <Fragment key={f.id}>
                <LigneFamille titre={f.nom} colonnes={3} />
                {f.items.map((l) => (
                  <tr key={l.article_id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-1.5 font-medium">{l.article}</td>
                    <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                      {formatQty(l.qte)} <span className="font-normal text-[var(--color-text-muted)]">{l.unite}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatMAD(estimation(l))}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-warm-50 border-t-2 border-[var(--color-border)]">
              <td colSpan={2} className="px-3 py-2 text-right font-semibold">Estimation totale</td>
              <td className="px-3 py-2 text-right font-display font-bold text-primary whitespace-nowrap">{formatMAD(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="text-xs text-[var(--color-text-faint)] print-groupe">
          Estimation au dernier prix payé, hors négociation. Elle ne vaut pas engagement de dépense.
        </p>

        {/* Le dernier repli : ni partage natif, ni presse-papier. Le texte est
            affiché tel quel, présélectionné, prêt pour un copier manuel. */}
        {texteBrut && (
          <div className="no-print mt-6">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">
              Le partage n'est pas disponible sur cet appareil. Copiez le texte ci-dessous :
            </p>
            <textarea
              readOnly
              value={texteBrut}
              onFocus={(e) => e.target.select()}
              autoFocus
              rows={Math.min(16, texteBrut.split('\n').length + 1)}
              className="w-full p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] font-mono text-xs bg-warm-50"
            />
          </div>
        )}
      </BonShell>
    );
  }

  // ── La saisie ──────────────────────────────────────────────
  return (
    <BonShell titre="Préparer une commande" onClose={onClose}>
      {alertes.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" />
          <p className="font-semibold text-[var(--color-text)]">Aucun article sous son seuil.</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Il n'y a rien à commander aujourd'hui.</p>
          <Button variant="outline" className="mt-6 gap-1" onClick={onClose}>
            <ArrowLeft size={14} /> Retour au dépôt
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)]">Articles sous le seuil</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Les quantités proposées ramènent chaque article à son seuil. Ajustez-les librement.
            </p>
          </div>

          <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden mb-4">
            {parFamille.map((f) => (
              <Fragment key={f.id}>
                <div className="px-4 py-1.5 bg-warm-100/70 text-xs font-semibold text-primary uppercase tracking-wide">
                  {f.nom}
                </div>
                {f.items.map((l) => {
                  const auSeuil = Number(l.a_commander ?? 0) === 0;
                  return (
                    <div key={l.article_id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0">
                      <input
                        type="checkbox"
                        checked={l.pris}
                        onChange={(e) => setChoix((p) => ({
                          ...p,
                          [l.article_id]: { ...p[l.article_id], pris: e.target.checked },
                        }))}
                        className="w-5 h-5 accent-primary flex-shrink-0"
                        aria-label={`Commander ${l.article}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{l.article}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">
                          stock {formatQty(l.quantite)} · seuil {formatQty(l.seuil_alerte)}
                          {auSeuil && <span className="text-orange-600"> · au seuil exactement</span>}
                        </p>
                      </div>
                      <input
                        type="number" min="0" step="0.001"
                        value={choix[l.article_id]?.qte ?? ''}
                        onChange={(e) => setChoix((p) => ({
                          ...p,
                          // Saisir une quantité coche la ligne : sinon on tape
                          // un nombre qui n'apparaît nulle part dans le bon.
                          [l.article_id]: { pris: Number(e.target.value) > 0, qte: e.target.value },
                        }))}
                        className="w-20 h-11 text-right px-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0"
                      />
                      <span className="text-xs text-[var(--color-text-muted)] w-8 flex-shrink-0">{l.unite}</span>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pb-4">
            <div className="text-sm">
              <span className="text-[var(--color-text-muted)]">
                {retenues.length} référence{retenues.length > 1 ? 's' : ''} ·{' '}
              </span>
              <span className="font-semibold text-primary">{formatMAD(total)}</span>
              <span className="text-xs text-[var(--color-text-faint)] block">estimation au dernier prix payé</span>
            </div>
            <div className="flex gap-2">
              {/* Partager depuis la saisie aussi : c'est le geste le plus
                  fréquent, et il ne devrait pas passer par un aperçu. */}
              <Button variant="outline" onClick={partager} disabled={retenues.length === 0} className="gap-1">
                <Share2 size={15} /> Partager
              </Button>
              <Button onClick={() => setEtape('bon')} disabled={retenues.length === 0} className="gap-1">
                Aperçu du bon <ArrowRight size={15} />
              </Button>
            </div>
          </div>

          {texteBrut && (
            <div className="mb-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">
                Le partage n'est pas disponible sur cet appareil. Copiez le texte ci-dessous :
              </p>
              <textarea
                readOnly
                value={texteBrut}
                onFocus={(e) => e.target.select()}
                autoFocus
                rows={Math.min(16, texteBrut.split('\n').length + 1)}
                className="w-full p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] font-mono text-xs bg-warm-50"
              />
            </div>
          )}
        </>
      )}
    </BonShell>
  );
};

export default BonCommande;
