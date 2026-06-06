-- ============================================================
-- EPICURE — Phase 1 : Données initiales
-- ============================================================

-- ============================================================
-- RÔLES
-- ============================================================
INSERT INTO roles (id, name, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'super_admin', true),
  ('00000000-0000-0000-0000-000000000002', 'admin',       true),
  ('00000000-0000-0000-0000-000000000003', 'manager',     true),
  ('00000000-0000-0000-0000-000000000004', 'utilisateur', true);

-- ============================================================
-- PERMISSIONS
-- ============================================================

-- super_admin : toutes les permissions
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000001', key, true
FROM unnest(ARRAY[
  'articles.read', 'articles.create', 'articles.update', 'articles.delete',
  'categories.manage', 'units.manage',
  'inventory.create', 'inventory.validate', 'inventory.read',
  'settings.read', 'settings.manage',
  'users.manage', 'permissions.manage',
  'historique.read',
  'depot.read'
]) AS key;

-- admin
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000002', key, true
FROM unnest(ARRAY[
  'articles.read', 'articles.create', 'articles.update', 'articles.delete',
  'categories.manage', 'units.manage',
  'inventory.create', 'inventory.validate', 'inventory.read',
  'settings.read', 'users.manage',
  'historique.read',
  'depot.read'
]) AS key;

-- manager
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000003', key, true
FROM unnest(ARRAY[
  'articles.read',
  'inventory.create', 'inventory.validate', 'inventory.read',
  'settings.read',
  'historique.read',
  'depot.read'
]) AS key;

-- utilisateur
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT '00000000-0000-0000-0000-000000000004', key, true
FROM unnest(ARRAY[
  'articles.read',
  'inventory.create', 'inventory.read',
  'depot.read'
]) AS key;

-- ============================================================
-- UTILISATEUR SUPER ADMIN : Salmane, PIN 100001
-- ============================================================
INSERT INTO users (full_name, pin_hash, role_id, active)
VALUES (
  'Salmane',
  crypt('100001', gen_salt('bf', 10)),
  '00000000-0000-0000-0000-000000000001',
  true
);

-- ============================================================
-- CATÉGORIES (11, dans l'ordre voulu)
-- ============================================================
INSERT INTO categories (name, sort_order, active) VALUES
  ('Base commune',          1,  true),
  ('Base hygiène',          2,  true),
  ('Base verrerie',         3,  true),
  ('Base logistique',       4,  true),
  ('Base déco bar',         5,  true),
  ('Base matériel bar',     6,  true),
  ('Base matériel service', 7,  true),
  ('Base alcool',           8,  true),
  ('Base premix',           9,  true),
  ('Base coupage',          10, true),
  ('Base eau',              11, true);

-- ============================================================
-- UNITÉS DE MESURE
-- ============================================================
INSERT INTO units (name, abbreviation, active) VALUES
  ('Pièce',    'pce', true),
  ('Bouteille','btl', true),
  ('Litre',    'L',   true),
  ('Carton',   'ctn', true),
  ('Paquet',   'pkt', true),
  ('Rouleau',  'rou', true),
  ('Bidon',    'bdn', true);
