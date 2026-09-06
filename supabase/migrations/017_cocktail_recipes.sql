-- ============================================================
-- EPICURE — Migration 017 : Recettes cocktails
-- Source de vérité pour le pré-remplissage du briefing.
-- Chaque recette contient tous les champs qui s'auto-remplissent
-- lors de la sélection d'un cocktail dans la Section 3.
-- ============================================================

CREATE TABLE cocktail_recipes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                TEXT NOT NULL,
  type_carte         TEXT CHECK (type_carte IN ('Classique', 'Signature')),
  alcool_article_id  UUID REFERENCES articles(id) ON DELETE SET NULL,
  verre_article_id   UUID REFERENCES articles(id) ON DELETE SET NULL,
  garnish_article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  glacons            TEXT CHECK (glacons IN ('Sans', 'Cube alimentaire', 'Transparent')),
  dosage             TEXT CHECK (dosage IN ('2cl', '3cl', '4cl', '5cl', '6cl')),
  service_alcool     TEXT CHECK (service_alcool IN ('Bouteille d''origine', 'Carafe', 'Bouteille noire')),
  notes              TEXT,
  actif              BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cocktail_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cocktail_recipes_anon" ON cocktail_recipes FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "cocktail_recipes_auth" ON cocktail_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
