-- 049 : complète 048. Retirer la colonne pin_hash ne suffisait pas (le droit de lire toute la table la couvrait encore) :
-- avec une session, n'importe quel compte pouvait lire les codes chiffrés de tous. Désormais la table users
-- se lit colonne par colonne, sans pin_hash. L'appli ne lit jamais pin_hash (le PIN passe par verify_pin et set_user_pin).
revoke select on public.users from anon, authenticated;
grant select (id, full_name, role_id, active, created_at, updated_at) on public.users to anon, authenticated;
