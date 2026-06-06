-- ============================================================
-- EPICURE — Phase 4 : Table event_briefing
-- Une ligne par question répondue, upsert sur (event_id, question_key).
-- ============================================================

CREATE TABLE event_briefing (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_key  text        NOT NULL,
  answer_value  text,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, question_key)
);

CREATE INDEX idx_briefing_event ON event_briefing(event_id);

ALTER TABLE event_briefing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all"          ON event_briefing FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON event_briefing FOR ALL TO authenticated USING (true) WITH CHECK (true);
