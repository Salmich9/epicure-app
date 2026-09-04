import { supabase } from '../lib/supabase';

// ── Facturation d'événement ──────────────────────────────────────────────
//
// Ces données vivaient dans `event_briefing`, sous des clés construites à la
// main : `fact_bar_2_cocktail_<uuid>_alcool`. Un entrepôt clé/valeur générique
// n'a aucun moyen de dire qu'une de ses lignes est de la facturation, et
// supprimer la table les emportait sans le savoir.
//
// Elles ont maintenant leur table, `event_billing_lines` (migration 019).
// Une ligne = (bar, type d'article, article, poste facturé).

// Clé locale au composant. Le `|` n'apparaît dans aucun identifiant, contrairement
// au `_` qui découpait mal les UUID de l'ancienne convention.
export const ligneKey = (barIndex, itemType, itemRef, poste) =>
  `${barIndex}|${itemType}|${itemRef}|${poste}`;

const decoupe = (cle) => {
  const [barIndex, itemType, itemRef, poste] = cle.split('|');
  return { barIndex: Number(barIndex), itemType, itemRef, poste };
};

// Charge la facturation d'un événement sous forme { ligneKey: entite }.
export const fetchBillingLines = async (eventId) => {
  const { data, error } = await supabase
    .from('event_billing_lines')
    .select('bar_index, item_type, item_ref, poste, entite')
    .eq('event_id', eventId);
  if (error) throw error;

  const lignes = {};
  (data ?? []).forEach(({ bar_index, item_type, item_ref, poste, entite }) => {
    lignes[ligneKey(bar_index, item_type, item_ref, poste)] = entite ?? '';
  });
  return lignes;
};

// Enregistre la facturation. N'écrit que ces lignes-là : contrairement à
// `saveBriefingAnswers`, qui réécrivait les 90 réponses du briefing à chaque
// sauvegarde de section, une modification de facturation ne touche plus rien
// d'autre.
export const saveBillingLines = async (eventId, lignes, recettesParArticle = {}) => {
  const rows = Object.entries(lignes).map(([cle, entite]) => {
    const { barIndex, itemType, itemRef, poste } = decoupe(cle);
    return {
      event_id: eventId,
      bar_index: barIndex,
      item_type: itemType,
      item_ref: itemRef,
      poste,
      // Une entité vide veut dire « pas encore décidé », pas « à supprimer » :
      // la ligne reste, sans valeur.
      entite: entite || null,
      recipe_id: recettesParArticle[itemRef] ?? null,
      source: 'app',
    };
  });

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('event_billing_lines')
    .upsert(rows, { onConflict: 'event_id,bar_index,item_type,item_ref,poste' });
  if (error) throw error;
};
