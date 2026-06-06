-- ============================================================
-- EPICURE — Phase 4 : Mise à jour des permissions
-- Ajout de dashboard.read et events.* pour tous les rôles
-- ============================================================

-- super_admin
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000001', key, true
FROM unnest(ARRAY[
  'dashboard.read',
  'events.read', 'events.create', 'events.manage'
]) AS key
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;

-- admin
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000002', key, true
FROM unnest(ARRAY[
  'dashboard.read',
  'events.read', 'events.create', 'events.manage'
]) AS key
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;

-- manager
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000003', key, true
FROM unnest(ARRAY[
  'dashboard.read',
  'events.read', 'events.create'
]) AS key
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;

-- utilisateur
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000004', key, true
FROM unnest(ARRAY[
  'dashboard.read',
  'events.read'
]) AS key
ON CONFLICT (role_id, permission_key) DO UPDATE SET allowed = true;
