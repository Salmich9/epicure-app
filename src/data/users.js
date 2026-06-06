import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

export const fetchUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select(`*, roles:role_id ( id, name )`)
    .order('full_name');
  if (error) throw error;
  return data;
};

export const fetchRoles = async () => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
};

export const createUser = async ({ full_name, pin, role_id }, actorId) => {
  // Crée l'utilisateur avec un hash factice temporaire
  const { data, error } = await supabase
    .from('users')
    .insert({ full_name, pin_hash: 'temp', role_id, active: true })
    .select()
    .single();
  if (error) throw error;

  // Hash le PIN via RPC
  const { error: pinErr } = await supabase.rpc('set_user_pin', {
    p_user_id: data.id,
    p_pin: pin,
  });
  if (pinErr) throw pinErr;

  await logAudit({
    entity: 'user', entityId: data.id, action: 'create', actor: actorId,
    payload: { full_name, role_id },
  });
  return data;
};

export const updateUser = async (id, updates, actorId) => {
  const { pin, ...rest } = updates;
  if (Object.keys(rest).length > 0) {
    const { error } = await supabase.from('users').update(rest).eq('id', id);
    if (error) throw error;
  }
  if (pin) {
    const { error } = await supabase.rpc('set_user_pin', { p_user_id: id, p_pin: pin });
    if (error) throw error;
  }
  await logAudit({
    entity: 'user', entityId: id, action: 'update', actor: actorId,
    payload: { ...rest, pin_changed: !!pin },
  });
};

export const toggleUserActive = async (id, active, actorId) => {
  const { error } = await supabase.from('users').update({ active }).eq('id', id);
  if (error) throw error;
  await logAudit({
    entity: 'user', entityId: id, action: active ? 'activate' : 'deactivate', actor: actorId,
  });
};
