-- ============================================================
-- EPICURE — Migration 015 : Clients, Venues, Employees, Prestataires
-- Socle de la Phase 5 (Briefing événement)
-- ============================================================

-- ── 1. CLIENTS ───────────────────────────────────────────────
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          TEXT NOT NULL,
  telephone    TEXT,
  email        TEXT,
  notes        TEXT,
  actif        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. VENUES (lieux) ────────────────────────────────────────
CREATE TABLE venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  adresse       TEXT,
  contact_nom   TEXT,
  contact_tel   TEXT,
  type          TEXT CHECK (type IN ('villa_privee', 'hotel', 'salle_reception', 'plein_air', 'autre')),
  contraintes   TEXT,
  notes         TEXT,
  actif         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. EMPLOYEES (staff) ─────────────────────────────────────
CREATE TABLE employees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            TEXT NOT NULL,
  telephone      TEXT,
  role_principal TEXT CHECK (role_principal IN ('bartender', 'runner', 'chef_de_bar', 'logistique', 'autre')),
  niveau         TEXT CHECK (niveau IN ('junior', 'confirme', 'senior')),
  tarif_horaire  NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  actif          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. PRESTATAIRES ──────────────────────────────────────────
CREATE TABLE prestataires (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT NOT NULL,
  role             TEXT CHECK (role IN ('dj', 'traiteur', 'decorateur', 'photographe', 'sono', 'autre')),
  telephone        TEXT,
  email            TEXT,
  mode_contact     TEXT CHECK (mode_contact IN ('whatsapp', 'email', 'les_deux')),
  note_moyenne     NUMERIC(3,2),
  notes            TEXT,
  actif            BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. RLS — accès authentifié uniquement ────────────────────
ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestataires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_auth"      ON clients      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "venues_auth"       ON venues       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "employees_auth"    ON employees    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prestataires_auth" ON prestataires FOR ALL TO authenticated USING (true) WITH CHECK (true);
