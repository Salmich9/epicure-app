-- =============================================================================
-- 044 — Ce que les écrans ont besoin de lire
--
-- Trois écrans neufs — l'historique des écarts, l'historique des inventaires et
-- le bon de commande — et aucun ne demande de nouvelle table. Ce qui manque,
-- ce sont des colonnes sur deux vues déjà en place.
--
-- LA RÈGLE « À COMMANDER » DESCEND EN SQL. `seuil − stock` écrit en JavaScript
-- serait la CINQUIÈME copie de la formule d'alerte : elle vit déjà dans
-- `v_depot`, dans `v_depot_decomposition`, dans `v_depot_evolution`, et une
-- quatrième fois en JS dans `src/data/dashboard.js`. Le KPI du dashboard et la
-- liste juste en dessous ne partagent pas une ligne de code. Une cinquième
-- copie, dans un écran qui déclenche des achats, n'est pas une option.
--
-- ⚠️ `categorie` SUR `v_evenements_articles` CORRIGE UN BUG RÉEL. Le prompt de
-- BETA_BOT (`lib/profil-epicure.js`) annonce déjà cette colonne dans son bloc
-- SCHEMA. Elle n'existe pas : une question du genre « les écarts par famille »
-- produit un `select categorie` qui échoue. Vérifié en base avant d'écrire.
--
-- `create or replace` ET JAMAIS `drop`/`create`. Un `drop` révoquerait EN
-- SILENCE le `grant select … to barometre_lecture` — c'est la leçon de la 036,
-- où mes propres grants de la 028 étaient faux. Corollaire contraignant : les
-- colonnes s'ajoutent EN FIN DE LISTE, seule modification qu'un `replace`
-- accepte. L'ordre ci-dessous est donc dicté par l'existant, pas par la
-- lisibilité.
-- =============================================================================

begin;

-- --- v_depot : de quoi remplir un bon de commande ----------------------------
create or replace view v_depot as
select
  cs.article_id,
  cs.name                                    as article,
  cat.name                                   as categorie,
  u.abbreviation                             as unite,
  cs.type                                    as nature,
  cs.quantity                                as quantite,
  cs.average_cost                            as cout_moyen,
  round(cs.stock_value, 2)                   as valeur,
  cs.low_stock_threshold                     as seuil_alerte,
  cs.low_stock_threshold is not null
    and cs.quantity <= cs.low_stock_threshold as en_alerte,
  inv.date                                   as date_inventaire,
  current_date - inv.date                    as inventaire_jours,

  -- --- ajouts 044, obligatoirement en fin de liste ---------------------------

  -- LE CAS LIMITE EST DANS CETTE FORMULE. Le test d'alerte est `<=`, donc un
  -- article exactement au seuil EST en alerte, et `seuil − stock` vaut alors 0.
  -- `greatest(…, 0)` rend 0 plutôt qu'un nombre négatif, et l'écran affiche la
  -- ligne décochée avec la mention « au seuil exactement ». On ne fabrique pas
  -- une quantité que personne n'a demandée, et on ne cache pas une alerte.
  case
    when cs.low_stock_threshold is not null
     and cs.quantity <= cs.low_stock_threshold
    then greatest(cs.low_stock_threshold - cs.quantity, 0)
    else 0::numeric
  end                                        as a_commander,

  -- Le dernier prix payé, POUR LE BON DE COMMANDE UNIQUEMENT. Tout le reste de
  -- l'app valorise au coût moyen depuis la 027. Ici la question est autre : on
  -- prévoit un décaissement, on ne valorise pas un stock. D'où deux mots
  -- différents à l'écran — « estimation » ici, « valeur » ailleurs.
  cs.last_purchase_price                     as dernier_prix,

  cs.category_id                             as categorie_id,
  cat.sort_order                             as categorie_ordre
from current_stock cs
  left join categories cat on cat.id = cs.category_id
  left join units u        on u.id   = cs.unit_id
  left join lateral (
    select max(inventories.date) as date
    from inventories
    where inventories.status = 'valide'
  ) inv on true
where cs.active;

comment on view v_depot is
  'Le depot, un article par ligne. `a_commander` = ce qu il faut acheter pour '
  'repasser au-dessus du seuil ; vaut 0 pour un article exactement au seuil, '
  'qui est en alerte sans manquer.';


-- --- v_evenements_articles : l'écart, avec sa cause --------------------------
--
-- LES MOTIFS ARRIVENT PAR SOUS-REQUÊTE SCALAIRE, pas par jointure. Une jointure
-- sur `ecarts_motifs` multiplierait les lignes le jour où un article portera
-- deux motifs — et la table est faite pour ça. Une sous-requête agrège, quel
-- que soit le nombre.
--
-- `a.id` ENTRE DANS LE GROUP BY. Il y était par `a.name`, qui n'est unique que
-- pour les articles actifs (la 038 pose un index PARTIEL). Deux homonymes, l'un
-- archivé, fusionnaient donc leurs quantités sur une même ligne. Grouper par
-- l'identifiant les sépare : c'est une correction, pas un effet de bord.
create or replace view v_evenements_articles as
select
  e.id     as event_id,
  e.name   as evenement,
  e.date   as date_evenement,
  a.name   as article,
  a.type   as nature,
  sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end) as preleve,
  sum(case when sm.type = 'retour'      then sm.quantity      else 0 end) as retourne,
  sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
    - sum(case when sm.type = 'retour'  then sm.quantity      else 0 end) as ecart,
  round((sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
       - sum(case when sm.type = 'retour'      then sm.quantity      else 0 end))
        * a.average_cost, 2) as valeur_ecart,

  -- --- ajouts 044, obligatoirement en fin de liste ---------------------------
  a.id     as article_id,
  cat.name as categorie,
  u.abbreviation as unite,

  -- Tous les motifs posés, pour l'affichage.
  (select string_agg(m.name, ', ' order by m.sort_order, m.name)
     from ecarts_motifs em
     join motifs_ecart m on m.id = em.motif_id
    where em.event_id = e.id and em.article_id = a.id) as motifs,

  -- Le premier posé, pour présélectionner le <select> de l'écran. L'interface
  -- n'en expose qu'un ; le jour où elle en expose plusieurs, elle lira `motifs`.
  (select em.motif_id
     from ecarts_motifs em
    where em.event_id = e.id and em.article_id = a.id
    order by em.created_at
    limit 1) as motif_id
from stock_movements sm
  join events e   on e.id = sm.reference_id and sm.reference_type = 'event'
  join articles a on a.id = sm.article_id
  left join categories cat on cat.id = a.category_id
  left join units u        on u.id   = a.unit_id
where sm.type = any (array['prelevement', 'retour'])
group by e.id, e.name, e.date, a.id, a.name, a.type, a.average_cost,
         cat.name, u.abbreviation;

comment on view v_evenements_articles is
  'Un article par evenement : preleve, retourne, ecart, et pourquoi. '
  '`valeur_ecart` est au cout moyen, comme partout depuis la 027.';

commit;

-- Les deux vues gardent leurs grants : `create or replace` ne les touche pas.
-- Vérifié plutôt que supposé — `v_evenements`, `v_evenements_articles` et
-- `v_depot` sont toutes trois déjà en `select` pour `anon` et pour
-- `barometre_lecture`. Aucun grant à réémettre ici.

-- --- Contrôles, à relire après application -----------------------------------
--
--   select article, quantite, seuil_alerte, en_alerte, a_commander
--     from v_depot where en_alerte order by article;
--     → un article à stock 1 pour un seuil 2 rend a_commander = 1
--     → un article à stock 2 pour un seuil 2 rend en_alerte = t, a_commander = 0
--
--   select column_name from information_schema.columns
--    where table_name = 'v_evenements_articles' order by ordinal_position;
--     → … valeur_ecart, article_id, categorie, unite, motifs, motif_id
--
--   select grantee from information_schema.role_table_grants
--    where table_name = 'v_depot' and privilege_type = 'SELECT';
--     → anon, authenticated, barometre_lecture, postgres, service_role
