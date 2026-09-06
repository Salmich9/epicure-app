-- =============================================================================
-- 030 — Remise a zero des donnees d'exploitation
--
-- Tout ce qui a ete saisi jusqu'ici etait du test : 10 evenements dont
-- « Test 8 », 13 inventaires, 102 mouvements, 7 achats. On repart du reel.
--
-- CE QUI PART                          CE QUI RESTE
--   inventory_lines                      articles      (42)
--   inventories                          categories    (17, apres la 029)
--   stock_movements                      units         (15)
--   purchases                            suppliers      (3)
--   event_responsibles                   cocktail_recipes (4)
--   events                               users          (5)
--   audit_log
--
-- Deux points a comprendre avant de rejouer ceci :
--
-- 1. `current_stock` est une VUE — somme des mouvements. Vider
--    stock_movements suffit a mettre tout le depot a zero ; il n'y a pas de
--    quantite stockee ailleurs a corriger.
--
-- 2. `articles.average_cost` et `last_purchase_price` sont VOLONTAIREMENT
--    conserves. Ce sont des attributs du catalogue, pas des donnees
--    d'exploitation : sans eux, le tout premier inventaire vaudrait 0 MAD et
--    il faudrait ressaisir 25 prix a la main. La quantite repart de zero, le
--    prix reste connu.
--
-- Transactionnel : soit tout part, soit rien. Une suppression a moitie faite
-- laisserait des mouvements orphelins pointant vers des evenements disparus.
-- =============================================================================

begin;

delete from inventory_lines;
delete from inventories;
delete from stock_movements;
delete from purchases;
delete from event_responsibles;
delete from events;
delete from audit_log;

commit;

-- Verification : v_depot_resume doit renvoyer 0.00 et une date d'inventaire
-- nulle, le catalogue doit etre intact.
--
--   select valeur_totale, articles_en_stock, date_inventaire from v_depot_resume;
--   select count(*) from articles;
