-- ============================================================
-- EPICURE — Migration 011 : Archivage inventaires
--
-- Règle : quand un nouvel inventaire est validé, le précédent
-- inventaire 'valide' passe en 'archive'. Un seul inventaire
-- peut être 'valide' à la fois. Les archives ne sont jamais
-- supprimées — consultables en lecture seule.
-- ============================================================

-- 1. Ajoute 'archive' comme statut valide
ALTER TABLE inventories
  DROP CONSTRAINT IF EXISTS inventories_status_check;

ALTER TABLE inventories
  ADD CONSTRAINT inventories_status_check
  CHECK (status IN ('brouillon', 'valide', 'archive'));

-- 2. Réécrit validate_inventory pour archiver le précédent
CREATE OR REPLACE FUNCTION validate_inventory(
  p_inventory_id     UUID,
  p_responsible_name TEXT,
  p_user_id          UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv          RECORD;
  v_line         RECORD;
  v_current_qty  NUMERIC;
  v_has_history  BOOLEAN;
  v_movement_type TEXT;
  v_diff         NUMERIC;
  v_total_value  NUMERIC := 0;
BEGIN
  SELECT * INTO v_inv
  FROM inventories
  WHERE id = p_inventory_id AND status = 'brouillon';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventaire introuvable ou déjà validé (id: %)', p_inventory_id;
  END IF;

  -- Archive le précédent inventaire validé (s'il existe)
  UPDATE inventories
    SET status = 'archive', updated_at = now()
  WHERE status = 'valide';

  -- Traite chaque ligne
  FOR v_line IN
    SELECT * FROM inventory_lines WHERE inventory_id = p_inventory_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_current_qty
    FROM stock_movements
    WHERE article_id = v_line.article_id;

    SELECT EXISTS(
      SELECT 1 FROM stock_movements WHERE article_id = v_line.article_id
    ) INTO v_has_history;

    v_movement_type := CASE WHEN v_has_history THEN 'ajustement' ELSE 'inventaire_initial' END;
    v_diff := v_line.counted_qty - v_current_qty;

    IF v_diff <> 0 OR NOT v_has_history THEN
      INSERT INTO stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) VALUES (
        gen_random_uuid(), v_line.article_id, v_movement_type, v_diff,
        'inventory', p_inventory_id, NULL, p_user_id, now()
      );
    END IF;

    v_total_value := v_total_value + (v_line.counted_qty * v_line.unit_price);
  END LOOP;

  UPDATE inventories
    SET status = 'valide', signed_at = now(),
        responsible_name = p_responsible_name,
        total_value = v_total_value, updated_at = now()
  WHERE id = p_inventory_id;

  INSERT INTO audit_log (id, entity, entity_id, action, actor, payload, created_at)
  VALUES (
    gen_random_uuid(), 'inventory', p_inventory_id, 'validate', p_user_id,
    jsonb_build_object('responsible_name', p_responsible_name, 'total_value', v_total_value),
    now()
  );

  RETURN json_build_object('success', true, 'total_value', v_total_value);
END;
$$;
