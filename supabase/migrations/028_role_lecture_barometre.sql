-- =============================================================================
-- 028 — Un role de lecture pour le bot Barometre
--
-- Le bot Barometre interroge Epicure a travers postgres_fdw. Le lien aurait pu
-- se connecter en `postgres` : ce role est superutilisateur ici, et une faille
-- du garde-fou SQL cote Barometre aurait alors ouvert tout Epicure.
--
-- Celui-ci ne lit que les six vues. Cree sans mot de passe : il ne peut pas se
-- connecter tant qu'on ne lui en donne pas un (fait a la main, hors depot).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'barometre_lecture') then
    create role barometre_lecture login;
  end if;
end
$$;

revoke all on schema public from barometre_lecture;
grant usage on schema public to barometre_lecture;

grant select on
  v_depot, v_depot_resume, v_achats,
  v_evenements, v_evenements_articles, v_mouvements
to barometre_lecture;

-- Les vues sont en SECURITY INVOKER : sans ces GRANT sur les tables sources,
-- elles renverraient une erreur de permission plutot que des lignes.
grant select on current_stock, articles, categories, units, inventories,
                purchases, suppliers, events, stock_movements, users
to barometre_lecture;

comment on role barometre_lecture is
  'Bot Barometre, lecture seule des vues v_*. Cree le 06/09/2026.';
