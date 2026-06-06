-- ============================================================
-- EPICURE — Phase 3 : Retours et écarts
-- ============================================================

-- RPC : validate_event_returns
-- Crée les mouvements retour + perte et clôture l'événement
-- de façon atomique.
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
  v_item       JSONB;
  v_article_id UUID;
  v_returned   NUMERIC;
  v_ecart      NUMERIC;
BEGIN
  -- Vérifie que l'événement existe et n'est pas déjà clôturé
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status <> 'cloture') THEN
    RAISE EXCEPTION 'Événement introuvable ou déjà clôturé';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_returns)
  LOOP
    v_article_id := (v_item->>'article_id')::UUID;
    v_returned   := (v_item->>'returned_qty')::NUMERIC;
    v_ecart      := (v_item->>'ecart')::NUMERIC;

    -- Mouvement retour (quantité positive = entre dans le stock)
    IF v_returned > 0 THEN
      INSERT INTO stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) VALUES (
        gen_random_uuid(), v_article_id, 'retour', v_returned,
        'event', p_event_id, NULL, p_user_id, now()
      );
    END IF;

    -- Mouvement perte pour l'écart (quantité négative = sort définitivement)
    IF v_ecart > 0 THEN
      INSERT INTO stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) VALUES (
        gen_random_uuid(), v_article_id, 'perte', -v_ecart,
        'event', p_event_id, 'Écart constaté au retour', p_user_id, now()
      );
    END IF;
  END LOOP;

  -- Clôture l'événement
  UPDATE events
  SET status = 'cloture', updated_at = now()
  WHERE id = p_event_id;

  -- Audit
  INSERT INTO audit_log (id, entity, entity_id, action, actor, payload, created_at)
  VALUES (
    gen_random_uuid(), 'event', p_event_id, 'returns_validated',
    p_user_id, p_returns, now()
  );

  RETURN json_build_object('success', true);
END;
$$;
