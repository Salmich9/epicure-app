import { supabase } from '../lib/supabase';

// Vérifie le PIN et retourne { id, full_name, role_id, role_name } ou null
export const verifyPin = async (pin) => {
  const { data, error } = await supabase.rpc('verify_pin', { p_pin: pin });
  if (error) throw error;
  return data; // null si PIN invalide
};

// La session portée par ce téléphone est-elle encore valable côté serveur ?
export const sessionValide = async () => {
  const { data, error } = await supabase.rpc('depot_session_ok');
  if (error) throw error;
  return data === true;
};

export const fermerSession = async () => {
  await supabase.rpc('depot_deconnexion');
};
