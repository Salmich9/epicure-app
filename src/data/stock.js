import { supabase } from '../lib/supabase';

// Stock courant par article (depuis la vue current_stock)
export const fetchCurrentStock = async () => {
  const { data, error } = await supabase
    .from('current_stock')
    .select(`
      article_id, name, category_id, unit_id, type,
      last_purchase_price, low_stock_threshold, photo_url, active,
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
      id, type, quantity, note, created_at,
      users:created_by ( full_name ),
      events:reference_id ( name )
    `)
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
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
