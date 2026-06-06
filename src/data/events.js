import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

// ── Événements ────────────────────────────────────────────────

export const fetchEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      users:created_by ( full_name ),
      event_responsibles ( id, name, role_label )
    `)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
};

export const fetchEvent = async (id) => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      users:created_by ( full_name ),
      event_responsibles ( id, name, role_label, user_id )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createEvent = async ({ name, date, venue }, actorId) => {
  const { data, error } = await supabase
    .from('events')
    .insert({ name, date, venue: venue || null, created_by: actorId, status: 'brouillon' })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'event', entityId: data.id, action: 'create', actor: actorId, payload: { name, date } });
  return data;
};

export const updateEvent = async (id, updates, actorId) => {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'event', entityId: id, action: 'update', actor: actorId, payload: updates });
  return data;
};

export const updateEventStatus = async (id, status, actorId) => {
  return updateEvent(id, { status }, actorId);
};

// ── Responsables ──────────────────────────────────────────────

export const addResponsible = async (eventId, { name, role_label, user_id }) => {
  const { data, error } = await supabase
    .from('event_responsibles')
    .insert({ event_id: eventId, name, role_label, user_id: user_id || null })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeResponsible = async (id) => {
  const { error } = await supabase.from('event_responsibles').delete().eq('id', id);
  if (error) throw error;
};

// ── Prélèvements (stock_movements type = 'prelevement') ───────

export const fetchEventWithdrawals = async (eventId) => {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      id, quantity, note, created_at,
      articles:article_id (
        id, name, last_purchase_price,
        categories:category_id ( id, name, sort_order ),
        units:unit_id ( id, name, abbreviation )
      ),
      users:created_by ( full_name )
    `)
    .eq('reference_type', 'event')
    .eq('reference_id', eventId)
    .eq('type', 'prelevement')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const addWithdrawal = async ({ eventId, articleId, quantity, note, actorId }) => {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      article_id:     articleId,
      type:           'prelevement',
      quantity:       -Math.abs(Number(quantity)),  // toujours négatif = sortie
      reference_type: 'event',
      reference_id:   eventId,
      note:           note || null,
      created_by:     actorId,
    })
    .select()
    .single();
  if (error) throw error;
  await logAudit({
    entity: 'event', entityId: eventId, action: 'withdrawal', actor: actorId,
    payload: { article_id: articleId, quantity: -Math.abs(Number(quantity)), note },
  });
  return data;
};

// ── Retours (stock_movements type = 'retour' ou 'perte') ─────

export const fetchEventReturns = async (eventId) => {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      id, quantity, type, note, created_at,
      articles:article_id (
        id, name, last_purchase_price,
        categories:category_id ( id, name, sort_order ),
        units:unit_id ( id, name, abbreviation )
      ),
      users:created_by ( full_name )
    `)
    .eq('reference_type', 'event')
    .eq('reference_id', eventId)
    .in('type', ['retour', 'perte'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

// Valide les retours via RPC (atomique)
// returns = [{ article_id, returned_qty, ecart }]
export const validateEventReturns = async (eventId, returns, actorId) => {
  const { data, error } = await supabase.rpc('validate_event_returns', {
    p_event_id: eventId,
    p_user_id:  actorId,
    p_returns:  returns,
  });
  if (error) throw error;
  return data;
};

export const deleteWithdrawal = async (movementId, actorId) => {
  // On peut annuler un prélèvement en le supprimant (tant que l'event n'est pas clôturé)
  const { error } = await supabase.from('stock_movements').delete().eq('id', movementId);
  if (error) throw error;
  await logAudit({ entity: 'stock_movement', entityId: movementId, action: 'delete', actor: actorId });
};
