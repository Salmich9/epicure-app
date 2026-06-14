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

export const createPurchase = async (fields, actorId) => {
  const { data, error } = await supabase
    .from('purchases')
    .insert({ ...fields, created_by: actorId })
    .select()
    .single();
  if (error) throw error;

  // Crée le mouvement de stock
  const { error: mvErr } = await supabase
    .from('stock_movements')
    .insert({
      article_id:     fields.article_id,
      type:           'achat',
      quantity:       fields.quantity,
      reference_type: 'purchase',
      reference_id:   data.id,
      note:           fields.note || null,
      created_by:     actorId,
    });
  if (mvErr) throw mvErr;

  // Met à jour le dernier prix d'achat de l'article
  await supabase
    .from('articles')
    .update({ last_purchase_price: fields.unit_price })
    .eq('id', fields.article_id);

  await logAudit({
    entity: 'purchase', entityId: data.id, action: 'create', actor: actorId,
    payload: { article_id: fields.article_id, quantity: fields.quantity, unit_price: fields.unit_price },
  });

  return data;
};
