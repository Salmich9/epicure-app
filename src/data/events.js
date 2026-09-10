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
        id, name, type, last_purchase_price, average_cost,
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
        id, name, type, last_purchase_price, average_cost,
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
// returns = [{ article_id, returned_qty, ecart, motif_id }]
//
// `motif_id` est facultatif et ne change pas la signature de la RPC :
// `p_returns` est un jsonb sans schéma, une clé de plus est absorbée. Un
// appelant qui ne l'envoie pas se comporte exactement comme avant.
export const validateEventReturns = async (eventId, returns, actorId) => {
  const { data, error } = await supabase.rpc('validate_event_returns', {
    p_event_id: eventId,
    p_user_id:  actorId,
    p_returns:  returns,
  });
  if (error) throw error;
  return data;
};

/**
 * Annule un prélèvement d'événement.
 *
 * Faisait un DELETE direct sur `stock_movements`, avec un commentaire affirmant
 * que c'était possible « tant que l'event n'est pas clôturé » — rien ne le
 * vérifiait. Depuis la migration 035, le journal est en ajout seul et le DELETE
 * est refusé : la RPC est la seule porte, et elle applique enfin les deux
 * règles qui n'étaient qu'écrites.
 *
 *   — événement clôturé : refusé ;
 *   — prélèvement antérieur à la validation du dernier inventaire : refusé,
 *     le comptage l'a déjà absorbé et le retirer ferait mentir l'inventaire.
 *
 * L'audit est écrit dans la transaction, avec la ligne entière avant sa
 * disparition. Ne pas le journaliser ici en plus.
 */
export const deleteWithdrawal = async (movementId, actorId) => {
  const { data, error } = await supabase.rpc('annuler_prelevement', {
    p_movement_id: movementId,
    p_user_id: actorId,
  });
  if (error) throw error;
  return data;
};


// ── Lectures d'historique ─────────────────────────────────────
//
// `v_evenements` existe depuis la migration 026 et n'était lue NULLE PART dans
// l'app : une ligne par événement, avec l'écart déjà valorisé. L'onglet
// Historique › Écarts n'a donc rien à recalculer — et c'est ce qui garantit
// qu'il affiche le même montant que la page de l'événement.

export const fetchEcartsParEvenement = async () => {
  const { data, error } = await supabase
    .from('v_evenements')
    .select('*')
    .order('date_evenement', { ascending: false });
  if (error) throw error;
  return data;
};

// Le détail d'un événement, motifs compris (colonnes ajoutées par la 044).
export const fetchEcartsArticles = async (eventId) => {
  const { data, error } = await supabase
    .from('v_evenements_articles')
    .select('*')
    .eq('event_id', eventId)
    .order('categorie')
    .order('article');
  if (error) throw error;
  return data;
};
