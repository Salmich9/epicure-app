-- =============================================================================
-- 024 — Rendre `event_billing_lines` accessible à la PWA
--
-- La 019 a créé la table avec le RLS actif et **aucune policy**, sur le modèle
-- des tables du bot (`bot_sessions`, `stock_reservations`, `bot_users`) qui ne
-- sont lues qu'en `service_role`.
--
-- C'était une erreur ici : `BriefingSection11.jsx` écrit depuis le navigateur,
-- avec la clé `anon`. Sans policy, la section ne peut ni lire ni enregistrer.
--
-- ⚠️ CE QUE CETTE MIGRATION N'EST PAS
--
-- Elle n'ouvre rien de nouveau. Ces données de facturation vivent aujourd'hui
-- dans `event_briefing`, dont les policies sont déjà `USING (true)` pour `anon`
-- — comme les 31 policies du schéma. Le niveau d'exposition est donc identique
-- avant et après.
--
-- Mais il faut le dire clairement : **cette table est aussi ouverte que le
-- reste d'Epicure**, c'est-à-dire complètement. N'importe qui disposant de la
-- clé anon peut lire qui facture quoi. Réparer ça est un chantier à part —
-- il concerne les 31 policies et la fonction `actor_has_permission()`, écrite
-- dans les fichiers SQL mais jamais déployée. Le faire sur cette seule table
-- donnerait une fausse impression de cloisonnement.
--
-- Le bot, lui, ne dépend pas de ces policies : il tourne en `service_role` et
-- refuse de démarrer avec une clé anon.
-- =============================================================================

drop policy if exists event_billing_lines_anon on event_billing_lines;
create policy event_billing_lines_anon
  on event_billing_lines for all
  to anon
  using (true) with check (true);

drop policy if exists event_billing_lines_auth on event_billing_lines;
create policy event_billing_lines_auth
  on event_billing_lines for all
  to authenticated
  using (true) with check (true);

comment on table event_billing_lines is
  'Facturation par bar et par article, sortie de l EAV event_briefing. '
  'Policies permissives comme le reste du schema Epicure : voir 024.';
