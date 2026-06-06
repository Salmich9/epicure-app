-- ============================================================
-- EPICURE — Phase 2 : Événements et prélèvements
-- ============================================================

-- Table événements
CREATE TABLE events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  date       DATE NOT NULL,
  venue      TEXT,
  status     TEXT NOT NULL DEFAULT 'brouillon'
             CHECK (status IN ('brouillon', 'en_cours', 'cloture')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responsables d'un événement (plusieurs par event, chacun avec un rôle)
CREATE TABLE event_responsibles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id),   -- optionnel : lié à un compte app
  name       TEXT NOT NULL,               -- nom affiché sur le bon
  role_label TEXT NOT NULL,               -- ex : "Barman", "Chef de rang"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_responsibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all"          ON events             FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON events             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all"          ON event_responsibles FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON event_responsibles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissions par rôle
INSERT INTO permissions (role_id, permission_key, allowed)
SELECT r.id, k, true
FROM roles r
CROSS JOIN unnest(ARRAY['events.create','events.read','events.manage']) AS k
WHERE r.name IN ('super_admin','admin')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO permissions (role_id, permission_key, allowed)
SELECT r.id, k, true
FROM roles r
CROSS JOIN unnest(ARRAY['events.create','events.read']) AS k
WHERE r.name = 'manager'
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO permissions (role_id, permission_key, allowed)
SELECT r.id, k, true
FROM roles r
CROSS JOIN unnest(ARRAY['events.read']) AS k
WHERE r.name = 'utilisateur'
ON CONFLICT (role_id, permission_key) DO NOTHING;
