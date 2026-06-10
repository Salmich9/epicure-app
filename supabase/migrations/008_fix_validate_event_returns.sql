-- ============================================================
-- EPICURE — Fix : double comptage du stock après retour
--
-- PROBLÈME : validate_event_returns insérait à la fois :
--   - retour +25   (ce qui est revenu)
--   - perte  -25   (l'écart)
-- Or le prélèvement de -50 a déjà sorti les 50 articles.
-- Le retour de +25 ramène exactement ce qui est revenu.
-- Les 25 non retournés sont déjà "perdus" via le prélèvement.
-- Insérer une perte de -25 en plus = double comptage.
--
-- FIX : supprimer l'insertion du mouvement 'perte'.
--   Stock final correct : 100 - 50 (prélev) + 25 (retour) = 75 ✓
--
-- La valeur des écarts est désormais calculée dans get_dashboard_stats
-- via la différence (prélèvements - retours) sur les events clôturés.
-- ============================================================

-- 1. Corrige la RPC validate_event_returns (retire le mouvement perte)
CREATE OR REPLACE FUNCTION validate_event_returns(
  p_event_id UUID,
  p_user_id  UUID,
  p_returns  JSONB   -- [{article_id, returned_qty, ecart}]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item        JSONB;
  v_article_id  UUID;
  v_returned    NUMERIC;
  v_ecart       NUMERIC;
  v_ecart_value NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status <> 'cloture') THEN
    RAISE EXCEPTION 'Événement introuvable ou déjà clôturé';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_returns)
  LOOP
    v_article_id := (v_item->>'article_id')::UUID;
    v_returned   := (v_item->>'returned_qty')::NUMERIC;
    v_ecart      := (v_item->>'ecart')::NUMERIC;

    -- Retour : ramène les articles dans le stock
    IF v_returned > 0 THEN
      INSERT INTO stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) VALUES (
        gen_random_uuid(), v_article_id, 'retour', v_returned,
        'event', p_event_id, NULL, p_user_id, now()
      );
    END IF;

    -- NOTE : pas de mouvement 'perte' — l'écart est déjà capturé par
    -- la différence entre le prélèvement (-qty) et le retour (+returned).
    -- Insérer une perte en plus causerait un double comptage.

    -- Cumul valeur écarts pour l'audit (informatif uniquement)
    IF v_ecart > 0 THEN
      SELECT v_ecart_value + v_ecart * COALESCE(last_purchase_price, 0)
        INTO v_ecart_value
      FROM articles WHERE id = v_article_id;
    END IF;
  END LOOP;

  UPDATE events
    SET status = 'cloture', updated_at = now()
  WHERE id = p_event_id;

  INSERT INTO audit_log (id, entity, entity_id, action, actor, payload, created_at)
  VALUES (
    gen_random_uuid(), 'event', p_event_id, 'returns_validated',
    p_user_id,
    p_returns || jsonb_build_object('ecart_value_mad', v_ecart_value),
    now()
  );

  RETURN json_build_object('success', true, 'ecart_value', v_ecart_value);
END;
$$;


-- 2. Corrige get_dashboard_stats :
--    Les écarts du mois = (prélèvements - retours) en valeur MAD
--    pour les événements clôturés ce mois-ci.
--    Plus de dépendance au type 'perte'.
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

  -- Valeur des écarts du mois =
  --   SUM(prélèvements - retours) * prix pour les events clôturés ce mois
  SELECT COALESCE(SUM(
    CASE WHEN sm.type = 'prelevement' THEN ABS(sm.quantity) * a.last_purchase_price
         WHEN sm.type = 'retour'      THEN -sm.quantity    * a.last_purchase_price
         ELSE 0
    END
  ), 0) INTO v_ecarts_mois
  FROM stock_movements sm
  JOIN articles a ON a.id = sm.article_id
  WHERE sm.reference_type = 'event'
    AND sm.type IN ('prelevement', 'retour')
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = sm.reference_id
        AND e.status = 'cloture'
        AND DATE_TRUNC('month', e.updated_at) = DATE_TRUNC('month', NOW())
    );

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


-- 3. Nettoyage optionnel : supprime les mouvements 'perte' créés
--    par d'anciens événements clôturés (double comptage existant).
--    DÉCOMMENTER uniquement si vous souhaitez corriger l'historique.
--
-- DELETE FROM stock_movements
-- WHERE type = 'perte'
--   AND reference_type = 'event'
--   AND note = 'Écart constaté au retour';
