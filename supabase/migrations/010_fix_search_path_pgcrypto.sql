-- ============================================================
-- EPICURE — Migration 010 : Fix search_path pour pgcrypto
--
-- Sur Supabase, pgcrypto est installé dans le schéma 'extensions'
-- et non 'public'. Les fonctions qui utilisent crypt() et gen_salt()
-- doivent inclure 'extensions' dans leur search_path.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_pin(p_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT u.id, u.full_name, u.role_id, r.name AS role_name, u.active
  INTO v_user
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.pin_hash = crypt(p_pin, u.pin_hash)
    AND u.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',        v_user.id,
    'full_name', v_user.full_name,
    'role_id',   v_user.role_id,
    'role_name', v_user.role_name
  );
END;
$$;


CREATE OR REPLACE FUNCTION set_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE users
  SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;
