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

/**
 * Les articles en alerte, et ce qu'il faudrait en commander.
 *
 * LISAIT `current_stock` ET REFAISAIT LE TEST EN JAVASCRIPT. La formule
 * `quantity <= low_stock_threshold` existait alors quatre fois : dans `v_depot`,
 * dans `v_depot_decomposition`, dans `v_depot_evolution`, et ici — si bien que
 * le KPI du dashboard et la liste juste en dessous ne partageaient pas une
 * ligne de code. La migration 044 a ajouté `a_commander` à `v_depot` ; c'est
 * désormais la seule définition, et le bon de commande la lit aussi.
 */
export const fetchAlertArticles = async () => {
  const { data, error } = await supabase
    .from('v_depot')
    .select('article_id, article, categorie, categorie_id, categorie_ordre, unite, '
          + 'quantite, seuil_alerte, a_commander, dernier_prix, cout_moyen')
    .eq('en_alerte', true)
    .order('categorie_ordre')
    .order('article');
  if (error) throw error;
  return data;
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
