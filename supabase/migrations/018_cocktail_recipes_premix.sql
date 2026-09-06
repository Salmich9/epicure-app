-- ============================================================
-- EPICURE — Migration 018 : Ajout premix sur cocktail_recipes
-- ============================================================

ALTER TABLE cocktail_recipes
  ADD COLUMN IF NOT EXISTS est_premix  TEXT CHECK (est_premix IN ('À la minute', 'Premix')),
  ADD COLUMN IF NOT EXISTS premix_cl   NUMERIC(8,1);
