-- =============================================================================
-- 032 — Le journal, lisible et porteur de son coût
--
-- Deux manques empêchent la page Dépôt d'expliquer sa valeur.
--
-- 1. `stock_movements` n'a AUCUN index hors la clé primaire. La décomposition
--    filtre sur created_at, l'historique d'article sur (article_id, created_at),
--    les vues événement sur (reference_type, reference_id). Trois parcours
--    complets de la table à chaque lecture.
--
-- 2. Aucun coût n'est figé sur le mouvement. Sans lui, « 6 200 MAD achetés
--    depuis » se recalcule au CMP d'aujourd'hui : ce n'est pas ce qui a été
--    payé, et le chiffre bouge tout seul dès qu'un achat ultérieur déplace le
--    CMP. On veut pouvoir dire les deux : ce que ça vaut, et ce que ça a coûté.
--
-- SUR LA REPRISE DE L'EXISTANT. Il n'existe aucune source historique du coût.
-- On inscrit le CMP courant et on le DIT, `cost_basis = 'reprise'` : une valeur
-- reconstituée ne doit jamais se faire passer pour une valeur observée.
--
-- Cette reprise est exacte AUJOURD'HUI — 29 mouvements, aucun achat depuis
-- l'inventaire, donc aucun CMP n'a bougé depuis leur écriture. Elle ne le sera
-- plus jamais après le premier achat. C'est tout l'argument pour la faire
-- maintenant plutôt que plus tard.
-- =============================================================================

alter table stock_movements
  add column if not exists unit_cost  numeric(12,4),
  add column if not exists cost_basis text;

alter table stock_movements drop constraint if exists stock_movements_cost_basis_check;
alter table stock_movements add constraint stock_movements_cost_basis_check
  check (cost_basis is null or cost_basis in ('achat_reel', 'cmp_snapshot', 'reprise'));

comment on column stock_movements.unit_cost is
  'Cout unitaire fige a l ecriture. Pour un achat : le prix reellement paye. '
  'Ne valorise PAS le depot (toujours au CMP courant, cf. 026/027) : sert a '
  'dire ce qui a ete paye, et a mesurer l ecart avec le CMP.';

comment on column stock_movements.cost_basis is
  'D ou vient unit_cost. achat_reel = prix facture | cmp_snapshot = CMP au '
  'moment du mouvement | reprise = reconstitue en 032, valeur NON observee.';

update stock_movements sm
   set unit_cost = a.average_cost, cost_basis = 'reprise'
  from articles a
 where a.id = sm.article_id and sm.unit_cost is null;

-- --- Index -------------------------------------------------------------------
-- Chacun repond a une lecture reelle, pas a une intuition :
--   (article_id, created_at)      fetchArticleMovements, fiche article du Depot
--   (created_at)                  la coupure « depuis le dernier inventaire »
--   (reference_type, reference_id) prelevements/retours d un evenement, v_evenements
--   (type, created_at)            la ventilation par nature de la decomposition
--   (created_by)                  cle etrangere non indexee (advisor Supabase)
create index if not exists idx_sm_article_created on stock_movements (article_id, created_at desc);
create index if not exists idx_sm_created_at      on stock_movements (created_at);
create index if not exists idx_sm_reference       on stock_movements (reference_type, reference_id);
create index if not exists idx_sm_type_created    on stock_movements (type, created_at);
create index if not exists idx_sm_created_by      on stock_movements (created_by);

create index if not exists idx_purchases_article  on purchases (article_id);
create index if not exists idx_purchases_date     on purchases (date desc);
create index if not exists idx_purchases_supplier on purchases (supplier_id);

create index if not exists idx_inventory_lines_article on inventory_lines (article_id);

-- Partiel : une seule ligne a la fois (l archivage de la 011 le garantit).
-- La coupure se lit alors en un seul acces index.
create index if not exists idx_inventories_valide on inventories (signed_at desc)
  where status = 'valide';
