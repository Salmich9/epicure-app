import { supabase } from '../lib/supabase';

// Charge tous les paramètres sous forme { key: value }
export const fetchSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value');
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
};

// Charge un seul paramètre
export const fetchSetting = async (key) => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error) throw error;
  return data.value;
};

// Met à jour un paramètre
export const updateSetting = async (key, value) => {
  const { error } = await supabase
    .from('app_settings')
    .update({ value: String(value), updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) throw error;
};
