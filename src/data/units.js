import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

export const fetchUnits = async (activeOnly = false) => {
  let q = supabase.from('units').select('*').order('name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const createUnit = async ({ name, abbreviation }, actorId) => {
  const { data, error } = await supabase
    .from('units')
    .insert({ name, abbreviation })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'unit', entityId: data.id, action: 'create', actor: actorId, payload: { name, abbreviation } });
  return data;
};

export const updateUnit = async (id, updates, actorId) => {
  const { data, error } = await supabase
    .from('units')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'unit', entityId: id, action: 'update', actor: actorId, payload: updates });
  return data;
};

export const deactivateUnit = async (id, actorId) => {
  return updateUnit(id, { active: false }, actorId);
};
