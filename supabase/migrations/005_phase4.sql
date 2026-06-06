-- ============================================================
-- EPICURE — Phase 4 : Dashboard stats RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_depot_value     NUMERIC;
  v_events_en_cours INT;
  v_ecarts_mois     NUMERIC;
  v_articles_alerte INT;
BEGIN
  -- Valeur totale du dépôt
  SELECT COALESCE(SUM(stock_value), 0) INTO v_depot_value
  FROM current_stock WHERE active = true;

  -- Événements en cours
  SELECT COUNT(*) INTO v_events_en_cours
  FROM events WHERE status = 'en_cours';

  -- Valeur des écarts (pertes) du mois en cours
  SELECT COALESCE(SUM(ABS(sm.quantity) * a.last_purchase_price), 0) INTO v_ecarts_mois
  FROM stock_movements sm
  JOIN articles a ON a.id = sm.article_id
  WHERE sm.type = 'perte'
    AND DATE_TRUNC('month', sm.created_at) = DATE_TRUNC('month', NOW());

  -- Articles en alerte stock
  SELECT COUNT(*) INTO v_articles_alerte
  FROM current_stock
  WHERE active = true
    AND low_stock_threshold IS NOT NULL
    AND quantity <= low_stock_threshold;

  RETURN json_build_object(
    'depot_value',     v_depot_value,
    'events_en_cours', v_events_en_cours,
    'ecarts_mois',     v_ecarts_mois,
    'articles_alerte', v_articles_alerte
  );
END;
$$;
