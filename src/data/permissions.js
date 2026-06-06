import { supabase } from '../lib/supabase';

// Charge toutes les permissions (utilisé à la connexion)
export const fetchAllPermissions = async () => {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('permission_key');
  if (error) throw error;
  return data;
};

// Vérifie si un rôle a une permission (lecture depuis un tableau déjà chargé)
export const hasPermission = (permissions, roleId, key) => {
  return permissions.some(
    (p) => p.role_id === roleId && p.permission_key === key && p.allowed === true
  );
};

// Mise à jour d'une permission
export const updatePermission = async (roleId, permissionKey, allowed) => {
  const { error } = await supabase
    .from('permissions')
    .upsert(
      { role_id: roleId, permission_key: permissionKey, allowed },
      { onConflict: 'role_id,permission_key' }
    );
  if (error) throw error;
};
