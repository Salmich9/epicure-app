-- =============================================================================
-- 045 — La photo descend jusqu'au dépôt
--
-- Les 91 articles du catalogue portent tous une photo, et aucune des six vues
-- que lit BETA_BOT n'expose de colonne pour ça. Le bot ne peut donc pas montrer
-- ce qu'il décrit — « 240 coupettes » ne dit pas à quoi ressemble une coupette,
-- et c'est précisément la question qu'on se pose devant une étagère.
--
-- LE STOCKAGE EST PUBLIC, et c'est ce qui rend le reste petit. Le bucket
-- `article_photos` a `public = true` : une requête sans authentification rend
-- l'image. Telegram peut donc aller la chercher lui-même à partir de l'URL, sans
-- que rien ne transite par la fonction serverless. Vérifié avant d'écrire :
--
--   200  image/webp  5782 octets
--
-- `create or replace` ET JAMAIS `drop`/`create` — un drop révoquerait EN
-- SILENCE le `grant select … to barometre_lecture`. C'est la leçon de la 036,
-- et la contrainte de la 040 comme de la 044. Corollaire : `photo_url` s'ajoute
-- EN FIN DE LISTE, seule modification qu'un `replace` accepte. L'ordre ci-dessous
-- est donc dicté par l'existant, pas par la lisibilité.
--
-- ⚠️ CETTE MIGRATION NE SUFFIT PAS. `v_depot` est lue par le bot à travers une
-- TABLE ÉTRANGÈRE dans barometre-prod, dont la liste de colonnes est figée. Sans
-- le `alter foreign table` correspondant, `select photo_url` échoue là-bas avec
-- « column does not exist » sur une colonne qui existe pourtant ici. Voir
-- `barometre-lightspeed-connector/docs/epicure-lien-fdw.md`, section « Ajouter
-- une colonne : DEUX bases, pas une ».
--
-- CE QUE LA VUE NE MONTRERA PAS. `v_depot` filtre sur `cs.active` : 87 articles
-- sur 91. La photo d'un article archivé reste dans le stockage et reste dans
-- `articles`, mais le bot ne la verra pas. C'est cohérent — on ne demande pas à
-- voir un article retiré du catalogue — et mieux vaut l'écrire que le laisser
-- découvrir.
-- =============================================================================

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
  case
    when cs.low_stock_threshold is not null
     and cs.quantity <= cs.low_stock_threshold
    then greatest(cs.low_stock_threshold - cs.quantity, 0)
    else 0::numeric
  end                                        as a_commander,
  cs.last_purchase_price                     as dernier_prix,
  cs.category_id                             as categorie_id,
  cat.sort_order                             as categorie_ordre,

  -- --- ajout 045, obligatoirement en fin de liste ---------------------------

  -- L'URL PUBLIQUE, TELLE QUELLE. Pas de transformation, pas de vignette : les
  -- fichiers pèsent 10 ko en moyenne, et il n'y a de toute façon aucune
  -- bibliothèque d'images sur Vercel pour en fabriquer une.
  --
  -- Elle vaut NULL pour un article créé sans photo — c'est facultatif dans
  -- l'application. Le bot doit dire « pas de photo », pas se taire.
  cs.photo_url                               as photo_url
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
  'qui est en alerte sans manquer. `photo_url` est l URL publique du bucket '
  'article_photos, NULL si l article n a pas de photo, et absente pour un '
  'article archive puisque la vue ne montre que les actifs.';

-- --- Contrôles, à relire après application -----------------------------------
--
--   select count(*) filter (where photo_url is not null) as avec_photo,
--          count(*)                                      as articles
--     from v_depot;                                       -- 87 | 87 aujourd'hui
--
--   select column_name from information_schema.columns
--    where table_name = 'v_depot' order by ordinal_position;
--     → … a_commander, dernier_prix, categorie_id, categorie_ordre, photo_url
--
--   select grantee from information_schema.role_table_grants
--    where table_name = 'v_depot' and privilege_type = 'SELECT';
--     → anon, authenticated, barometre_lecture, postgres, service_role
--
-- PUIS, DANS barometre-prod ET PAS ICI :
--   alter foreign table v_depot add column if not exists photo_url text;
