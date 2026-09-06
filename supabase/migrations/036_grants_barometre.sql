-- =============================================================================
-- 036 — Le rôle du bot ne lit que des vues
--
-- CORRECTION D'UNE ERREUR DE LA 028, ET DE SON COMMENTAIRE.
--
-- La 028 affirme : « Les vues sont en SECURITY INVOKER : sans ces GRANT sur les
-- tables sources, elles renverraient une erreur de permission. » C'est faux.
-- Vérifié sur les sept vues de `public` : `reloptions = NULL`, donc
-- `security_invoker` est désactivé, donc elles s'exécutent avec les droits de
-- leur propriétaire — `postgres`. Elles n'ont jamais eu besoin de ces GRANT.
--
-- Ils n'étaient donc pas seulement inutiles, ils étaient ouvrants :
-- `barometre_lecture` pouvait lire NEUF tables en direct, dont `users` et ses
-- `pin_hash`, alors que la documentation de ce dépôt affirme qu'il ne voit que
-- six vues. L'écart entre ce qui est écrit et ce qui est vrai est précisément
-- ce qu'un audit doit refuser.
--
-- La chaîne est bornée par ailleurs — le rôle n'est atteignable que par le lien
-- postgres_fdw depuis barometre-prod, et le garde-fou SQL du bot ne connaît que
-- les vues — mais aucune de ces bornes n'est une raison de laisser un privilège
-- qui n'a jamais servi.
--
-- Les vues étant en definer, cette révocation ne peut pas les casser.
-- =============================================================================

revoke select on
  current_stock, articles, categories, units, inventories,
  purchases, suppliers, events, stock_movements, users
from barometre_lecture;

-- Ce qui reste : les six vues d'origine, plus les quatre de la 034.
grant select on
  v_depot, v_depot_resume, v_achats,
  v_evenements, v_evenements_articles, v_mouvements,
  v_depot_reference, v_depot_decomposition,
  v_depot_evolution, v_inventaire_couverture
to barometre_lecture;

comment on role barometre_lecture is
  'Bot Barometre, lecture seule des vues v_*. Cree le 06/09/2026, mot de passe '
  'tourne le meme jour, grants sur les tables sources revoques par la 036.';

-- Contrôle, à relire après application : toutes les lignes doivent être des
-- vues (relkind = 'v'). Une seule table ici signifie que le privilège est revenu.
--
--   select c.relname, c.relkind
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and has_table_privilege('barometre_lecture', c.oid, 'SELECT');
