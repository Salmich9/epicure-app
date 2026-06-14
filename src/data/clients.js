import { supabase } from '../lib/supabase';

export const fetchClients = async () => {
  const { data, error } = await supabase
    .from('clients')
    .select('id, nom, telephone, email, notes')
    .eq('actif', true)
    .order('nom');
  if (error) throw error;
  return data;
};

export const createClient = async (fields) => {
  const { data, error } = await supabase
    .from('clients')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateClient = async (id, fields) => {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
