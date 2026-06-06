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

// Valeur totale du dépôt
export const fetchDepotTotalValue = async () => {
  const { data, error } = await supabase
    .from('current_stock')
    .select('stock_value')
    .eq('active', true);
  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.stock_value ?? 0), 0);
};
