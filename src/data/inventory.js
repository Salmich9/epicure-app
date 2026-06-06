import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

export const fetchInventories = async () => {
  const { data, error } = await supabase
    .from('inventories')
    .select(`*, users:created_by ( full_name )`)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
};

export const fetchInventory = async (id) => {
  const { data, error } = await supabase
    .from('inventories')
    .select(`
      *,
      users:created_by ( full_name ),
      inventory_lines (
        id, article_id, counted_qty, unit_price, line_value,
        articles:article_id (
          id, name, type,
          categories:category_id ( id, name, sort_order ),
          units:unit_id ( id, name, abbreviation )
        )
      )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createInventory = async ({ label, date }, actorId) => {
  const { data, error } = await supabase
    .from('inventories')
    .insert({ label, date, created_by: actorId, status: 'brouillon' })
    .select()
    .single();
  if (error) throw error;
  await logAudit({
    entity: 'inventory', entityId: data.id, action: 'create', actor: actorId,
    payload: { label, date },
  });
  return data;
};

// Upsert une ligne (counted_qty + unit_price = last_purchase_price)
export const upsertInventoryLine = async (inventoryId, articleId, countedQty, unitPrice) => {
  const { data, error } = await supabase
    .from('inventory_lines')
    .upsert(
      { inventory_id: inventoryId, article_id: articleId, counted_qty: countedQty, unit_price: unitPrice },
      { onConflict: 'inventory_id,article_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Validation via RPC (atomique, côté serveur)
export const validateInventory = async (inventoryId, responsibleName, actorId) => {
  const { data, error } = await supabase.rpc('validate_inventory', {
    p_inventory_id:    inventoryId,
    p_responsible_name: responsibleName,
    p_user_id:         actorId,
  });
  if (error) throw error;
  return data;
};
