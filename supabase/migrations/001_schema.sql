-- ============================================================
-- EPICURE — Phase 1 : Schéma de base de données
-- ============================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Rôles
CREATE TABLE roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_system  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions (une ligne par couple rôle / clé de permission)
CREATE TABLE permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  allowed        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_key)
);

-- Utilisateurs (auth par PIN, pas par email)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,
  role_id    UUID NOT NULL REFERENCES roles(id),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catégories d'articles (modifiables et réordonnables)
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unités de mesure
CREATE TABLE units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Articles du catalogue
CREATE TABLE articles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  category_id          UUID NOT NULL REFERENCES categories(id),
  unit_id              UUID NOT NULL REFERENCES units(id),
  type                 TEXT NOT NULL CHECK (type IN ('retournable', 'consommable')),
  last_purchase_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold  NUMERIC(12,3),
  photo_url            TEXT,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registre des mouvements de stock (append-only, jamais modifié ni supprimé)
CREATE TABLE stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id     UUID NOT NULL REFERENCES articles(id),
  type           TEXT NOT NULL CHECK (type IN (
    'inventaire_initial', 'ajustement', 'achat', 'prelevement', 'retour', 'perte'
  )),
  quantity       NUMERIC(12,3) NOT NULL,  -- signé : + entrée, - sortie
  reference_type TEXT,
  reference_id   UUID,
  note           TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventaires
CREATE TABLE inventories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label            TEXT NOT NULL,
  date             DATE NOT NULL,
  responsible_name TEXT,
  signed_at        TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'valide')),
  total_value      NUMERIC(12,2),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lignes d'inventaire
CREATE TABLE inventory_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
  article_id   UUID NOT NULL REFERENCES articles(id),
  counted_qty  NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_value   NUMERIC(12,2) GENERATED ALWAYS AS (counted_qty * unit_price) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(inventory_id, article_id)
);

-- Journal d'audit (historique complet de toutes les actions)
CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity     TEXT NOT NULL,
  entity_id  UUID,
  action     TEXT NOT NULL,
  actor      UUID REFERENCES users(id),
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VUE : STOCK COURANT
-- La quantité est toujours calculée depuis les mouvements,
-- jamais stockée en colonne.
-- ============================================================
CREATE OR REPLACE VIEW current_stock AS
SELECT
  a.id                    AS article_id,
  a.name,
  a.category_id,
  a.unit_id,
  a.type,
  a.last_purchase_price,
  a.low_stock_threshold,
  a.photo_url,
  a.active,
  COALESCE(SUM(sm.quantity), 0)                         AS quantity,
  COALESCE(SUM(sm.quantity), 0) * a.last_purchase_price AS stock_value
FROM articles a
LEFT JOIN stock_movements sm ON sm.article_id = a.id
GROUP BY
  a.id, a.name, a.category_id, a.unit_id, a.type,
  a.last_purchase_price, a.low_stock_threshold, a.photo_url, a.active;

-- ============================================================
-- TRIGGERS : updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_updated_at     BEFORE UPDATE ON categories     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER units_updated_at          BEFORE UPDATE ON units          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER articles_updated_at       BEFORE UPDATE ON articles       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventories_updated_at    BEFORE UPDATE ON inventories    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventory_lines_updated_at BEFORE UPDATE ON inventory_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RPC : verify_pin
-- Vérifie le PIN et retourne les données de l'utilisateur
-- (SECURITY DEFINER pour lire pin_hash sans exposer la table)
-- ============================================================
CREATE OR REPLACE FUNCTION verify_pin(p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT u.id, u.full_name, u.role_id, r.name AS role_name, u.active
  INTO v_user
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.pin_hash = crypt(p_pin, u.pin_hash)
    AND u.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',        v_user.id,
    'full_name', v_user.full_name,
    'role_id',   v_user.role_id,
    'role_name', v_user.role_name
  );
END;
$$;

-- ============================================================
-- RPC : set_user_pin
-- Crée ou met à jour le PIN d'un utilisateur (hashé bcrypt)
-- ============================================================
CREATE OR REPLACE FUNCTION set_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE users
  SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- RPC : validate_inventory
-- Valide un inventaire brouillon :
--   1. Crée les mouvements de stock (inventaire_initial ou ajustement)
--   2. Met à jour l'inventaire (valide, signed_at, total_value)
--   3. Écrit dans audit_log
-- ============================================================
CREATE OR REPLACE FUNCTION validate_inventory(
  p_inventory_id   UUID,
  p_responsible_name TEXT,
  p_user_id        UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv          RECORD;
  v_line         RECORD;
  v_current_qty  NUMERIC;
  v_has_history  BOOLEAN;
  v_movement_type TEXT;
  v_diff         NUMERIC;
  v_total_value  NUMERIC := 0;
BEGIN
  -- Vérifie que l'inventaire existe et est en brouillon
  SELECT * INTO v_inv
  FROM inventories
  WHERE id = p_inventory_id AND status = 'brouillon';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventaire introuvable ou déjà validé (id: %)', p_inventory_id;
  END IF;

  -- Traite chaque ligne
  FOR v_line IN
    SELECT * FROM inventory_lines WHERE inventory_id = p_inventory_id
  LOOP
    -- Stock courant AVANT cette validation
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_current_qty
    FROM stock_movements
    WHERE article_id = v_line.article_id;

    -- Y a-t-il déjà des mouvements pour cet article ?
    SELECT EXISTS(
      SELECT 1 FROM stock_movements WHERE article_id = v_line.article_id
    ) INTO v_has_history;

    v_movement_type := CASE WHEN v_has_history THEN 'ajustement' ELSE 'inventaire_initial' END;
    v_diff := v_line.counted_qty - v_current_qty;

    -- Insère un mouvement seulement si la quantité change
    IF v_diff <> 0 OR NOT v_has_history THEN
      INSERT INTO stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) VALUES (
        gen_random_uuid(), v_line.article_id, v_movement_type, v_diff,
        'inventory', p_inventory_id, NULL, p_user_id, now()
      );
    END IF;

    v_total_value := v_total_value + (v_line.counted_qty * v_line.unit_price);
  END LOOP;

  -- Valide l'inventaire
  UPDATE inventories
  SET
    status           = 'valide',
    signed_at        = now(),
    responsible_name = p_responsible_name,
    total_value      = v_total_value,
    updated_at       = now()
  WHERE id = p_inventory_id;

  -- Audit
  INSERT INTO audit_log (id, entity, entity_id, action, actor, payload, created_at)
  VALUES (
    gen_random_uuid(), 'inventory', p_inventory_id, 'validate', p_user_id,
    jsonb_build_object(
      'responsible_name', p_responsible_name,
      'total_value',      v_total_value
    ),
    now()
  );

  RETURN json_build_object('success', true, 'total_value', v_total_value);
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Application interne : auth gérée au niveau applicatif.
-- RLS activée sur toutes les tables ; la politique anon
-- autorise tout (le contrôle d'accès est dans la table permissions).
-- ============================================================
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE units            ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;

-- Politique permissive pour le rôle anon (outil interne)
CREATE POLICY "anon_all" ON roles           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON permissions     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON users           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON categories      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON units           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON articles        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON stock_movements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON inventories     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON inventory_lines FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON audit_log       FOR ALL TO anon USING (true) WITH CHECK (true);

-- Bucket Supabase Storage pour les photos d'articles (à créer dans le dashboard)
-- Nom : article-photos  |  Public : oui
