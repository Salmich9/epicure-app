-- ============================================================
-- EPICURE — Migration 013 : Coût moyen pondéré (CMP)
-- Remplace last_purchase_price dans le calcul de stock_value
-- ============================================================

-- 1. Colonne average_cost sur articles
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS average_cost NUMERIC(12,4) NOT NULL DEFAULT 0;

-- Initialisation : on prend last_purchase_price comme point de départ
-- pour les articles déjà en stock (meilleure approximation disponible)
UPDATE articles SET average_cost = last_purchase_price WHERE average_cost = 0;

-- 2. Vue current_stock corrigée : stock_value utilise average_cost
CREATE OR REPLACE VIEW current_stock AS
SELECT
  a.id                    AS article_id,
  a.name,
  a.category_id,
  a.unit_id,
  a.type,
  a.last_purchase_price,
  a.average_cost,
  a.low_stock_threshold,
  a.photo_url,
  a.active,
  COALESCE(SUM(sm.quantity), 0)                       AS quantity,
  COALESCE(SUM(sm.quantity), 0) * a.average_cost      AS stock_value
FROM articles a
LEFT JOIN stock_movements sm ON sm.article_id = a.id
GROUP BY
  a.id, a.name, a.category_id, a.unit_id, a.type,
  a.last_purchase_price, a.average_cost,
  a.low_stock_threshold, a.photo_url, a.active;

-- 3. RPC recalculate_average_cost
-- Appelée après chaque achat pour recalculer le CMP de façon atomique.
-- Formule : (stock_avant × cmp_avant + qté_achetée × prix_unitaire) / nouveau_stock
CREATE OR REPLACE FUNCTION recalculate_average_cost(
  p_article_id  UUID,
  p_qty_bought  NUMERIC,
  p_unit_price  NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_qty   NUMERIC;
  v_current_avg   NUMERIC;
  v_new_stock     NUMERIC;
  v_new_avg       NUMERIC;
BEGIN
  -- Lit le stock et le CMP AVANT cet achat
  -- (le mouvement de stock a déjà été inséré, donc on soustrait p_qty_bought)
  SELECT
    COALESCE(SUM(sm.quantity), 0) - p_qty_bought,
    a.average_cost
  INTO v_current_qty, v_current_avg
  FROM articles a
  LEFT JOIN stock_movements sm ON sm.article_id = a.id
  WHERE a.id = p_article_id
  GROUP BY a.average_cost;

  v_new_stock := v_current_qty + p_qty_bought;

  IF v_new_stock <= 0 THEN
    -- Stock nul ou négatif après achat (cas extrême) : CMP = prix de l'achat
    v_new_avg := p_unit_price;
  ELSE
    v_new_avg := (
      (GREATEST(v_current_qty, 0) * v_current_avg) + (p_qty_bought * p_unit_price)
    ) / v_new_stock;
  END IF;

  UPDATE articles
    SET average_cost = ROUND(v_new_avg, 4)
  WHERE id = p_article_id;

  RETURN ROUND(v_new_avg, 4);
END;
$$;
