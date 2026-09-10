/**
 * Retire du bucket `article_photos` les fichiers que plus aucun article ne
 * reference.
 *
 * POURQUOI UN SCRIPT ET PAS DU SQL. Supprimer une ligne de `storage.objects`
 * n'efface PAS le fichier : les octets vivent dans le stockage objet, et seule
 * l'API Storage sait retirer les deux. Un DELETE en SQL laisserait donc des
 * fichiers payants et INJOIGNABLES — on ne pourrait meme plus les lister, la
 * liste passant par la table qu'on vient de vider. C'est pire que de ne rien
 * faire, et c'est ecrit depuis la migration 041.
 *
 * POURQUOI IL RESSERVIRA. `uploadArticlePhoto` depose un nouveau fichier sans
 * retirer l'ancien : remplacer la photo d'un article laisse un orphelin. Rien
 * ne les ramasse. Au 10/09/2026 il y en avait 9, tous vestiges du reset de la
 * 041 ; les suivants viendront des remplacements.
 *
 * PAR DEFAUT IL NE SUPPRIME RIEN. Il montre ce qu'il ferait. Il faut
 * `--confirmer` pour qu'il agisse. Ce n'est pas de la timidite : une boucle de
 * nettoyage a deja efface une photo qu'il fallait garder, sur ce bucket, le
 * 09/09/2026. Elle listait tout et supprimait tout, faute d'avoir verifie ce
 * qu'elle croyait savoir.
 *
 * Usage :
 *   node scripts/purger-photos-orphelines.mjs                # montre
 *   node scripts/purger-photos-orphelines.mjs --confirmer    # supprime
 *
 * La cle `service_role` se passe pour une commande, elle ne s'ecrit pas dans
 * un fichier suivi par git :
 *
 *   SUPABASE_SERVICE_ROLE_KEY="…" node scripts/purger-photos-orphelines.mjs
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'article_photos';

// Au-dela de ce nombre, le script REFUSE d'agir. Un jour ou l'autre une
// requete se cassera et rendra « tout est orphelin » ; ce plafond fait la
// difference entre un incident et une perte de catalogue.
const PLAFOND = 40;

const confirmer = process.argv.includes('--confirmer');

if (!URL || !CLE) {
  console.error(
    'Il manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.\n'
    + 'La cle service_role se trouve dans Supabase > Settings > API Keys.\n'
    + 'Ne la prefixe JAMAIS par VITE_ : elle serait compilee dans le bundle.'
  );
  process.exit(1);
}

const sb = createClient(URL, CLE, { auth: { persistSession: false } });

/** Tous les objets du bucket. `list()` plafonne a 100 : il FAUT paginer. */
async function tousLesFichiers() {
  const tout = [];
  const PAS = 100;
  for (let offset = 0; ; offset += PAS) {
    const { data, error } = await sb.storage.from(BUCKET)
      .list('', { limit: PAS, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Lecture du bucket : ${error.message}`);
    tout.push(...data);
    if (data.length < PAS) return tout;
  }
}

/** Les noms de fichier reellement references, extraits des URLs. */
async function nomsReferences() {
  const { data, error } = await sb
    .from('articles')
    .select('id, name, photo_url')
    .not('photo_url', 'is', null);
  if (error) throw new Error(`Lecture des articles : ${error.message}`);

  const noms = new Set();
  for (const a of data) {
    // Correspondance EXACTE sur ce qui suit le nom du bucket. Un `endsWith`
    // ferait passer un fichier reference pour un orphelin des qu'un nom serait
    // le suffixe d'un autre.
    const m = String(a.photo_url).match(/\/article_photos\/(.+)$/);
    if (m) noms.add(decodeURIComponent(m[1]));
  }
  return { noms, articles: data.length };
}

const ko = (o) => `${Math.round((o ?? 0) / 102.4) / 10} ko`;

async function main() {
  const [fichiers, { noms, articles }] = await Promise.all([
    tousLesFichiers(), nomsReferences(),
  ]);

  // LE GARDE-FOU QUI COMPTE. Si la lecture des articles rend zero reference,
  // TOUS les fichiers paraissent orphelins. C'est exactement le scenario qui a
  // coute une photo : la liste etait juste, la question posee ne l'etait pas.
  if (noms.size === 0) {
    console.error(
      `Refus : aucun article ne reference de photo, alors que le bucket en `
      + `contient ${fichiers.length}. Soit le catalogue est vide, soit la `
      + `requete est cassee. Dans les deux cas, on ne supprime rien.`
    );
    process.exit(1);
  }

  const orphelins = fichiers.filter((f) => !noms.has(f.name));

  console.log(`Bucket   : ${fichiers.length} fichiers`);
  console.log(`Articles : ${articles} avec une photo, ${noms.size} fichiers references`);
  console.log(`Orphelins: ${orphelins.length}\n`);

  if (orphelins.length === 0) {
    console.log('Rien a retirer.');
    return;
  }

  for (const f of orphelins) {
    console.log(`  ${f.name}  ${ko(f.metadata?.size)}  ${String(f.created_at).slice(0, 10)}`);
  }

  const poids = orphelins.reduce((s, f) => s + (f.metadata?.size ?? 0), 0);
  console.log(`\n  soit ${ko(poids)} au total`);

  if (orphelins.length > PLAFOND) {
    console.error(
      `\nRefus : ${orphelins.length} orphelins, plafond ${PLAFOND}. `
      + `Un nombre pareil ressemble plus a une requete cassee qu'a du menage. `
      + `Verifie a la main avant de relever le plafond.`
    );
    process.exit(1);
  }

  if (!confirmer) {
    console.log('\nRien n\'a ete supprime. Relance avec --confirmer pour agir.');
    return;
  }

  const { data, error } = await sb.storage.from(BUCKET)
    .remove(orphelins.map((f) => f.name));
  if (error) throw new Error(`Suppression : ${error.message}`);

  console.log(`\n${data.length} fichier(s) supprime(s).`);

  // On RELIT plutot que de croire le retour. Une suppression partielle qui se
  // dit reussie est le genre de chose qu'on decouvre trois mois plus tard.
  const restants = await tousLesFichiers();
  const encore = restants.filter((f) => !noms.has(f.name));
  console.log(
    encore.length === 0
      ? `Verifie : ${restants.length} fichiers, tous references.`
      : `⚠ ${encore.length} orphelin(s) subsistent : ${encore.map((f) => f.name).join(', ')}`
  );
}

main().catch((e) => { console.error(e.message); process.exit(1); });
