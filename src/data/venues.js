import { supabase } from '../lib/supabase';

export const fetchVenues = async () => {
  const { data, error } = await supabase
    .from('venues')
    .select('id, nom, adresse, contact_nom, contact_tel, type, contraintes, notes')
    .eq('actif', true)
    .order('nom');
  if (error) throw error;
  return data;
};

export const createVenue = async (fields) => {
  const { data, error } = await supabase
    .from('venues')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateVenue = async (id, fields) => {
  const { data, error } = await supabase
    .from('venues')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
