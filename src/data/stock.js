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

// Valeur totale du dépôt
export const fetchDepotTotalValue = async () => {
  const { data, error } = await supabase
    .from('current_stock')
    .select('stock_value')
    .eq('active', true);
  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.stock_value ?? 0), 0);
};
