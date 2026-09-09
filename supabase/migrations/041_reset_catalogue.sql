-- =============================================================================
-- 041 — Le catalogue repart de zéro
--
-- La 030 avait vidé l'exploitation en gardant les 42 articles. Cette fois les
-- articles partent aussi : les 51 sont archivés, ils portent des doublons —
-- « Cloche épices » et « Cloches Épices », « Caméra Wifi » en trois
-- exemplaires, « Coupette » et « Citron séché » en double, deux « Hdbsjsbs » —
-- et le prochain inventaire est le premier vrai.
--
-- Un catalogue qu'on n'a pas l'intention de réutiliser mais qu'on garde « au
-- cas où » est du bruit dans toutes les listes déroulantes, pour toujours.
--
-- CE QUI PART                    CE QUI RESTE
--   articles          (51)         categories   (19, toutes actives)
--   inventory_lines  (179)         units        (16, dont 9 actives)
--   inventories        (5)         suppliers     (7)
--   stock_movements  (149)         users         (5)
--   purchases         (10)         roles, permissions, app_settings (7)
--   events             (6)
--   event_responsibles (3)
--   audit_log        (328)
--
-- ARCHIVÉ AVANT DE PARTIR, comme la 037 l'a fait pour les recettes :
--   docs/archives/articles-2026-09-09.json     — les 51 fiches
--   docs/archives/audit_log-2026-09-09.json    — les 328 lignes de journal
--
-- Sans le second, plus rien n'attesterait qu'un catalogue a existé entre juin
-- et septembre.
--
-- LE VERROU D'AJOUT SEUL. Depuis la 035, un trigger refuse tout DELETE sur
-- `stock_movements`, sauf sous le drapeau que pose `annuler_prelevement()`.
-- Deux façons de passer :
--
--   (a) `alter table … disable trigger` puis `enable`.        ← RETENU
--   (b) emprunter `set_config('epicure.annulation_prelevement','on',true)`.
--
-- Les deux sont également sûres sur l'axe qui inquiète d'abord : le DDL est
-- transactionnel en Postgres, donc un échec en cours de migration restaure le
-- trigger, et `set_config(…, true)` est lui aussi local à la transaction.
--
-- Ce qui tranche est la lisibilité de l'intention. (b) affirmerait quelque
-- chose de faux — que cette suppression est l'annulation d'un prélèvement.
-- Qui auditera le drapeau plus tard trouvera un usage qui n'en est pas un.
-- Et si la garde d'`annuler_prelevement` est un jour resserrée, ce reset se
-- mettrait à obéir en silence à des règles écrites pour un autre geste.
--
-- Le reproche à (a) est assumé : il suspend la règle pour tout le monde le
-- temps de la transaction. Quelques millisecondes, à usage unique.
-- =============================================================================

begin;

-- Garde-fou. La prémisse de cette migration est « les 51 articles sont
-- archivés ». Si l'un est redevenu actif entre l'audit et l'exécution, on
-- s'arrête plutôt que de supprimer un catalogue vivant.
do $$
declare v_actifs integer;
begin
  select count(*) into v_actifs from articles where active;
  if v_actifs > 0 then
    raise exception 'Refus : % article(s) encore actif(s). Archiver d abord, ou revoir cette migration.', v_actifs
      using errcode = '42501';
  end if;
end $$;

alter table stock_movements disable trigger stock_movements_append_only;

-- L'ordre est contraint par trois clés étrangères NO ACTION vers `articles` :
-- inventory_lines, purchases et stock_movements doivent être vides d'abord.
delete from inventory_lines;      -- → articles, → inventories
delete from inventories;
delete from purchases;            -- → articles, → suppliers (conservés)
delete from stock_movements;      -- → articles
delete from event_responsibles;   -- CASCADE depuis events, explicite quand même
delete from events;
delete from audit_log;            -- aucune FK, mais archivé (voir l'en-tête)
delete from articles;             -- en dernier, nécessairement

alter table stock_movements enable trigger stock_movements_append_only;

commit;

-- --- Contrôles, à relire après application -----------------------------------
--
--   select (select count(*) from articles)        as articles,      -- 0
--          (select count(*) from stock_movements) as mouvements,    -- 0
--          (select count(*) from categories)      as categories,    -- 19
--          (select count(*) from suppliers)       as fournisseurs;  -- 7
--
--   select tgenabled from pg_trigger
--    where tgname = 'stock_movements_append_only';                  -- 'O'
--
--   select valeur_totale, controle from v_depot_evolution;          -- 0 | 0
--
-- Et le verrou doit mordre à nouveau : un DELETE sur `stock_movements` doit
-- lever 42501.
--
-- LES 9 PHOTOS du bucket `article_photos` deviennent orphelines. Ne PAS les
-- supprimer en SQL : effacer les lignes de `storage.objects` laisserait les
-- fichiers dans le stockage objet, injoignables — pire que de garder les deux.
-- À retirer via le tableau de bord Storage, une fois ce reset vérifié.
