import { supabase } from '../lib/supabase';

// Stock courant par article (depuis la vue current_stock)
export const fetchCurrentStock = async () => {
  const { data, error } = await supabase
    .from('current_stock')
    .select(`
      article_id, name, category_id, unit_id, type,
      last_purchase_price, average_cost, low_stock_threshold, photo_url, active,
      quantity, stock_value,
      categories:category_id ( id, name, sort_order ),
      units:unit_id ( id, name, abbreviation )
    `);
  if (error) throw error;
  return data;
};

// 10 derniers mouvements d'un article
export const fetchArticleMovements = async (articleId, limit = 10) => {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      id, type, quantity, note, created_at, reference_type, reference_id,
      users:created_by ( full_name )
    `)
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  // Récupère les noms des événements liés
  const eventIds = [...new Set(
    data.filter((m) => m.reference_type === 'event' && m.reference_id).map((m) => m.reference_id)
  )];

  let eventNames = {};
  if (eventIds.length > 0) {
    const { data: evs } = await supabase
      .from('events')
      .select('id, name')
      .in('id', eventIds);
    if (evs) evs.forEach((e) => { eventNames[e.id] = e.name; });
  }

  return data.map((m) => ({
    ...m,
    event_name: m.reference_type === 'event' ? (eventNames[m.reference_id] ?? null) : null,
  }));
};

/**
 * La valeur du dépôt, et d'où elle vient.
 *
 * Remplace `fetchDepotTotalValue`, qui n'était appelée nulle part et qui
 * constituait surtout une TROISIÈME définition du total du dépôt, à côté de
 * `v_depot_resume` et de la somme faite dans la page. Trois définitions du
 * même chiffre finissent toujours par diverger — c'est déjà arrivé ici, en
 * juin, entre le dernier prix d'achat et le coût moyen pondéré.
 *
 * Rend une seule ligne : `valeur_totale`, et sa décomposition en
 * `valeur_comptee` + `valeur_achats` + `valeur_prelevements` +
 * `valeur_retours`, avec `inventaire_date` et `controle`. Ce dernier doit
 * valoir 0 ; toute autre valeur signale que la partition du journal a un trou.
 */
export const fetchDepotEvolution = async () => {
  const { data, error } = await supabase
    .from('v_depot_evolution')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * Le détail par article : quantité, coût moyen, valeur, et ce qui a bougé
 * depuis le dernier inventaire. Remplace `fetchCurrentStock` sur la page
 * Dépôt — il porte les mêmes colonnes, plus la décomposition.
 */
export const fetchDepotDecomposition = async () => {
  const { data, error } = await supabase
    .from('v_depot_decomposition')
    .select('*')
    .order('article');
  if (error) throw error;
  return data;
};

/** Ce que le dernier inventaire n'a pas compté, et ce que ça pèse. */
export const fetchInventaireCouverture = async () => {
  const { data, error } = await supabase
    .from('v_inventaire_couverture')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
};
