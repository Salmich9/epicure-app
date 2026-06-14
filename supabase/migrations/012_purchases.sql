-- ============================================================
-- EPICURE — Migration 012 : Achats & Fournisseurs
-- ============================================================

-- Fournisseurs
CREATE TABLE suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  note       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Achats (un achat = un article)
CREATE TABLE purchases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  UUID NOT NULL REFERENCES articles(id),
  supplier_id UUID REFERENCES suppliers(id),
  quantity    NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON purchases  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Permissions
INSERT INTO app_settings (key, value, label, description) VALUES
  ('purchases.enabled', 'true', 'Module achats activé', 'Active ou désactive le module achats')
ON CONFLICT (key) DO NOTHING;
