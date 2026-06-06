import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

export const fetchCategories = async (activeOnly = false) => {
  let q = supabase.from('categories').select('*').order('sort_order');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const createCategory = async ({ name, sort_order }, actorId) => {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, sort_order })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'category', entityId: data.id, action: 'create', actor: actorId, payload: { name } });
  return data;
};

export const updateCategory = async (id, updates, actorId) => {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'category', entityId: id, action: 'update', actor: actorId, payload: updates });
  return data;
};

// Soft-delete
export const deactivateCategory = async (id, actorId) => {
  return updateCategory(id, { active: false }, actorId);
};

// Réorganiser les sort_order
export const reorderCategories = async (orderedIds, actorId) => {
  const updates = orderedIds.map((id, index) =>
    supabase.from('categories').update({ sort_order: index + 1 }).eq('id', id)
  );
  await Promise.all(updates);
  await logAudit({ entity: 'category', entityId: null, action: 'reorder', actor: actorId, payload: { orderedIds } });
};
