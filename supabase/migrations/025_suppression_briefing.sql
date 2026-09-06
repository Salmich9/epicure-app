-- =============================================================================
-- 025 — Suppression du domaine « organisation d'événement »
--
-- L'app ne sert plus à organiser un événement. Elle documente le stock :
-- achats, catalogue, dépôt, inventaires, et par événement les prélèvements,
-- les retours et les écarts.
--
-- ⚠️ MIGRATION DESTRUCTIVE. Elle supprime des tables et leurs données.
--
-- Ce qui part, et pourquoi :
--
--   event_briefing        92 lignes, toutes rattachées au seul événement
--                         « Test 8 » du 14/06/2026. Vérifié avant suppression :
--                         aucune donnée de production.
--   event_billing_lines   6 lignes, dérivées du briefing (migrations 019/024).
--   bot_sessions          état de conversation du bot événement (020).
--   stock_reservations    réserves posées pendant un brief (021). Sans brief,
--                         plus personne n'en pose.
--   bot_users             rôles Telegram du bot événement (023).
--   clients, venues       référentiels que seule la Section 1 du briefing
--                         lisait. `events.client_id` et `events.venue_id`
--                         partent avec.
--   employees, prestataires   créés en 015, jamais peuplés, jamais lus.
--
-- Ce qui reste, parce que c'est encore utilisé :
--   events, event_responsibles, articles, categories, units, stock_movements,
--   inventories, inventory_lines, purchases, suppliers, cocktail_recipes,
--   app_settings, users, roles, permissions, audit_log.
--
-- `events` garde `name`, `date`, `venue` (texte libre) et `status` : de quoi
-- nommer un événement pour y rattacher des prélèvements et des retours.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ce qui dépend de stock_reservations
--
-- `stock_disponible(date)` retranchait les réserves du stock courant. Sans
-- réserves, elle ne dirait plus rien que `current_stock` ne dise déjà.
-- ---------------------------------------------------------------------------

drop view if exists stock_disponible_aujourdhui;
drop function if exists stock_disponible(date);
drop function if exists expirer_reserves_provisoires();

-- ---------------------------------------------------------------------------
-- 2. Les colonnes de `events` qui pointent vers les référentiels supprimés
-- ---------------------------------------------------------------------------

alter table events drop column if exists client_id;
alter table events drop column if exists venue_id;

-- ---------------------------------------------------------------------------
-- 3. Les tables
-- ---------------------------------------------------------------------------

drop table if exists event_billing_lines;
drop table if exists event_briefing;
drop table if exists bot_sessions;
drop table if exists stock_reservations;
drop table if exists bot_users;
drop table if exists clients;
drop table if exists venues;
drop table if exists employees;
drop table if exists prestataires;

-- ---------------------------------------------------------------------------
-- 4. Les rôles du bot événement, devenus sans objet
--
-- `responsable_evenement` et `preparateur` n'existaient que pour le brief et
-- l'attestation de chargement. Les rôles d'Epicure — super_admin, admin,
-- manager, utilisateur — ne sont pas touchés.
-- ---------------------------------------------------------------------------

delete from permissions
 where role_id in (select id from roles
                    where name in ('responsable_evenement','preparateur'))
    or permission_key like 'event.%';

delete from roles
 where name in ('responsable_evenement','preparateur')
   and not exists (select 1 from users u where u.role_id = roles.id);
