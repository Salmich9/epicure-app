-- ============================================================
-- EPICURE — Migration 016 : FK client_id et venue_id sur events
-- + table event_briefing si pas encore créée
-- ============================================================

-- 1. Colonnes FK sur events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_id  UUID REFERENCES venues(id)  ON DELETE SET NULL;

-- 2. Table event_briefing (clé/valeur — réponses briefing textuelles)
CREATE TABLE IF NOT EXISTS event_briefing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer_value TEXT,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, question_key)
);

ALTER TABLE event_briefing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_briefing_auth" ON event_briefing
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
