import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

// ── Fournisseurs ──────────────────────────────────────────────

export const fetchSuppliers = async (activeOnly = true) => {
  let q = supabase.from('suppliers').select('*').order('name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const createSupplier = async (fields, actorId) => {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'supplier', entityId: data.id, action: 'create', actor: actorId, payload: fields });
  return data;
};

export const updateSupplier = async (id, fields, actorId) => {
  const { data, error } = await supabase
    .from('suppliers')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'supplier', entityId: id, action: 'update', actor: actorId, payload: fields });
  return data;
};

// ── Achats ────────────────────────────────────────────────────

export const fetchPurchases = async (limit = 50) => {
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      articles:article_id ( id, name, units:unit_id ( abbreviation ) ),
      suppliers:supplier_id ( id, name ),
      users:created_by ( full_name )
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

/**
 * Enregistre un achat. Une seule transaction, côté base.
 *
 * Cette fonction faisait QUATRE appels : insert purchases, insert
 * stock_movements, update last_purchase_price, rpc recalculate_average_cost.
 * Les deux derniers ne vérifiaient même pas leur erreur, et un commentaire
 * affirmait que l'ensemble était atomique. Il ne l'était pas : une coupure
 * réseau entre le mouvement et le CMP laissait le stock augmenté et le coût
 * inchangé — la valeur du dépôt devenait fausse, sans que rien ne le dise.
 *
 * `enregistrer_achat` (migration 033) fait les quatre en une transaction, et
 * tient l'ordre que la formule du CMP impose : le mouvement d'abord.
 *
 * Elle peut aussi créer l'article. Passe `article_nom`, `category_id`,
 * `unit_id` et `article_type` à la place d'`article_id` — un nom déjà présent
 * est réutilisé, jamais dupliqué.
 *
 * @returns {{purchase_id, article_id, article_cree, article_reutilise,
 *            quantite_stock, cout_moyen, valeur_stock}}
 */
export const createPurchase = async (fields, actorId) => {
  const { data, error } = await supabase.rpc('enregistrer_achat', {
    p_user_id:      actorId,
    p_quantity:     fields.quantity,
    p_unit_price:   fields.unit_price,
    p_article_id:   fields.article_id ?? null,
    p_supplier_id:  fields.supplier_id ?? null,
    p_date:         fields.date,
    p_note:         fields.note ?? null,
    p_article_nom:  fields.article_nom ?? null,
    p_category_id:  fields.category_id ?? null,
    p_unit_id:      fields.unit_id ?? null,
    p_article_type: fields.article_type ?? 'consommable',
  });
  if (error) throw error;

  // L'audit est écrit DANS la transaction : le journaliser ici en plus
  // produirait une seconde ligne pour le même achat.
  return data;
};
