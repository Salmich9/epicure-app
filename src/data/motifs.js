import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

/**
 * Les motifs d'écart — pourquoi un article n'est pas revenu d'un événement.
 *
 * Calqué sur `units.js` et `categories.js` : un référentiel modifiable depuis
 * Paramètres, avec désactivation plutôt que suppression. Un motif déjà posé sur
 * un écart passé ne doit pas pouvoir disparaître — la contrainte `on delete
 * restrict` de la migration 042 le refuserait de toute façon, mais l'écran ne
 * propose même pas le geste.
 */

export const fetchMotifs = async (activeOnly = false) => {
  let q = supabase.from('motifs_ecart').select('*').order('sort_order').order('name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const createMotif = async ({ name, perte_reelle = true }, actorId) => {
  const { data, error } = await supabase
    .from('motifs_ecart')
    .insert({ name: name.trim(), perte_reelle })
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'motif_ecart', entityId: data.id, action: 'create', actor: actorId, payload: { name, perte_reelle } });
  return data;
};

export const updateMotif = async (id, updates, actorId) => {
  const patch = { ...updates };
  if (typeof patch.name === 'string') patch.name = patch.name.trim();
  const { data, error } = await supabase
    .from('motifs_ecart')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'motif_ecart', entityId: id, action: 'update', actor: actorId, payload: patch });
  return data;
};

export const deactivateMotif = async (id, actorId) =>
  updateMotif(id, { active: false }, actorId);

/**
 * Corrige le motif d'un écart APRÈS clôture.
 *
 * Passe par une RPC dédiée, et pas par `validate_event_returns` : celle-ci
 * refuse un second passage à bon droit — le rejouer réinsérerait les mouvements
 * de retour et doublerait le stock. `corriger_motif_ecart` n'écrit que dans
 * `ecarts_motifs` et `audit_log` ; elle n'a pas les moyens de toucher aux
 * quantités, ce n'est pas seulement qu'elle ne le fait pas.
 *
 * `motifId` à `null` retire l'explication sans en poser d'autre.
 */
export const corrigerMotifEcart = async ({ eventId, articleId, motifId, note }, actorId) => {
  const { data, error } = await supabase.rpc('corriger_motif_ecart', {
    p_event_id:   eventId,
    p_article_id: articleId,
    p_motif_id:   motifId || null,
    p_user_id:    actorId,
    p_note:       note || null,
  });
  if (error) throw error;
  return data;
};
