import { supabase } from '../lib/supabase';

export const fetchDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;
  return data;
};

export const fetchUpcomingEvents = async (limit = 5) => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('id, name, date, venue, status')
    .gte('date', today)
    .neq('status', 'cloture')
    .order('date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const fetchAlertArticles = async () => {
  const { data, error } = await supabase
    .from('current_stock')
    .select(`
      article_id, name, quantity, low_stock_threshold, last_purchase_price,
      categories:category_id ( name ),
      units:unit_id ( name, abbreviation )
    `)
    .eq('active', true)
    .not('low_stock_threshold', 'is', null);
  if (error) throw error;
  return data.filter((a) => Number(a.quantity) <= Number(a.low_stock_threshold));
};

export const fetchRecentActivity = async (limit = 8) => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, entity, action, payload, created_at, users:actor ( full_name )')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};
