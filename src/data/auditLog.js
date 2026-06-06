import { supabase } from '../lib/supabase';

/**
 * Écrit une entrée dans l'audit_log.
 * Ne lève pas d'exception pour ne pas bloquer l'action principale.
 */
export const logAudit = async ({ entity, entityId, action, actor, payload = {} }) => {
  const { error } = await supabase.from('audit_log').insert({
    entity,
    entity_id: entityId ?? null,
    action,
    actor: actor ?? null,
    payload,
  });
  if (error) console.error('[audit_log]', error.message);
};

export const fetchAuditLog = async ({ entity, dateFrom, dateTo, limit = 100 } = {}) => {
  let q = supabase
    .from('audit_log')
    .select(`
      id, entity, entity_id, action, payload, created_at,
      users:actor ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entity)   q = q.eq('entity', entity);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo)   q = q.lte('created_at', dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data;
};
