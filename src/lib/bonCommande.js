/**
 * Le texte d'un bon de commande, et son envoi.
 *
 * ⚠️ CE FORMAT EST DUPLIQUÉ, VOLONTAIREMENT ET À UN SEUL ENDROIT : le prompt de
 * BETA_BOT, dans `barometre-lightspeed-connector/lib/profil-epicure.js`. Les
 * deux dépôts ne partagent aucun code, et la demande est que le bon soit le
 * même qu'il vienne de l'app ou du bot. Toute modification ici doit être
 * reportée là-bas — c'est écrit des deux côtés.
 */

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(n ?? 0));

const fmtQte = (n) => new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0, maximumFractionDigits: 3,
}).format(Number(n ?? 0));

/**
 * @param {Array} lignes — [{ article, quantite, unite, categorie, estimation }]
 * @param {Date}  date
 */
export const texteBonCommande = (lignes, date = new Date()) => {
  const parFamille = {};
  lignes.forEach((l) => {
    const f = l.categorie || 'Sans famille';
    (parFamille[f] ??= []).push(l);
  });

  const corps = Object.entries(parFamille)
    .map(([famille, items]) => (
      famille.toUpperCase() + '\n'
      + items.map((i) => `• ${i.article} — ${fmtQte(i.quantite)} ${i.unite ?? ''}`.trimEnd()).join('\n')
    ))
    .join('\n\n');

  const total = lignes.reduce((s, l) => s + Number(l.estimation ?? 0), 0);
  const n = lignes.length;

  return [
    'BON DE COMMANDE — Epicure',
    date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    '',
    corps,
    '',
    `${n} référence${n > 1 ? 's' : ''} · estimation ${fmt(total)} MAD`,
    '(estimation au dernier prix payé, hors négociation)',
  ].join('\n');
};

/**
 * Ouvre la feuille de partage du téléphone, ou se rabat.
 *
 * TROIS PIÈGES, DANS L'ORDRE OÙ ILS MORDENT.
 *
 * 1. `navigator.share` DOIT ÊTRE APPELÉ SYNCHRONEMENT dans le gestionnaire de
 *    clic. Un seul `await` avant — même résolu immédiatement — et Chrome
 *    répond `NotAllowedError` : le geste utilisateur a expiré. C'est la
 *    première cause d'échec de cette API, et c'est pour ça que cette fonction
 *    rend une promesse au lieu d'en attendre une.
 *
 * 2. `AbortError` N'EST PAS UNE ERREUR. C'est l'utilisateur qui a fermé la
 *    feuille de partage. Le remonter afficherait un bandeau rouge pour une
 *    action volontaire.
 *
 * 3. L'API EXIGE UN CONTEXTE SÉCURISÉ. Depuis un téléphone pointé sur le
 *    serveur de dev en `http://192.168…`, `navigator.share` est absent — et le
 *    presse-papier aussi. D'où le troisième repli, qui ne dépend de rien.
 *
 * @returns {Promise<'partage'|'annule'|'presse-papier'>} — rejette si aucun
 *          chemin n'est disponible ; l'appelant affiche alors le texte brut.
 */
export const partagerTexte = ({ titre, texte }) => {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    return navigator.share({ title: titre, text: texte })
      .then(() => 'partage')
      .catch((e) => {
        if (e?.name === 'AbortError') return 'annule';
        throw e;
      });
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texte).then(() => 'presse-papier');
  }

  return Promise.reject(new Error('Partage indisponible'));
};
