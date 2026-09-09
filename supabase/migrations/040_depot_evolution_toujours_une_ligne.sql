-- =============================================================================
-- 040 — Une vue qui ne rend rien ne dit pas « zéro », elle ne dit rien
--
-- `v_depot_evolution` groupe sur `v_depot_decomposition`. Sans article actif,
-- celle-ci rend 0 ligne, donc 0 groupe, donc 0 ligne — et `fetchDepotEvolution`
-- en `.maybeSingle()` rend `null`. La page Dépôt teste `if (!evo) return null` :
-- l'en-tête n'est pas affichée à 0 MAD, elle n'est pas affichée du tout.
--
-- Un dépôt vide est un fait. L'absence de fait est un bug. Et le cas n'a rien
-- de théorique : il s'est produit le 09/09, tous les articles ayant été
-- archivés avant le reset.
--
-- LA CORRECTION : partir de `v_depot_reference`, qui rend TOUJOURS une ligne
-- par construction (`from (select 1) z left join lateral … `), et joindre la
-- décomposition en LEFT JOIN. Zéro article donne alors une ligne de zéros.
--
-- `create or replace` et non `drop`/`create` : les noms, l'ordre et les types
-- des colonnes ne changent pas, et un `drop` révoquerait EN SILENCE le
-- `grant select … to barometre_lecture` posé par la 034. C'est la leçon de
-- la 036.
-- =============================================================================

create or replace view v_depot_evolution as
select
  r.inventaire_id,
  r.inventaire_label,
  r.inventaire_date,
  r.coupure,
  r.valeur_signee,

  coalesce(round(sum(d.valeur_comptee),      2), 0::numeric) as valeur_comptee,
  coalesce(round(sum(d.valeur_achats),       2), 0::numeric) as valeur_achats,
  coalesce(round(sum(d.valeur_prelevements), 2), 0::numeric) as valeur_prelevements,
  coalesce(round(sum(d.valeur_retours),      2), 0::numeric) as valeur_retours,
  coalesce(round(sum(d.valeur_ajustements),  2), 0::numeric) as valeur_ajustements,
  coalesce(round(sum(d.valeur_pertes),       2), 0::numeric) as valeur_pertes,
  coalesce(round(sum(d.valeur_actuelle),     2), 0::numeric) as valeur_totale,

  coalesce(round(sum(d.montant_achats_paye), 2), 0::numeric) as montant_achats_paye,
  coalesce(round(sum(d.valeur_comptee) - coalesce(r.valeur_signee, 0), 2), 0::numeric) as effet_prix,

  -- `count(d.article_id)` et non `count(*)` : avec un LEFT JOIN sans
  -- correspondance la ligne existe quand même, et `count(*)` vaudrait 1 là où
  -- la réponse est 0.
  count(d.article_id) filter (where d.qte_achats       <> 0) as articles_achetes,
  count(d.article_id) filter (where d.qte_prelevements <> 0) as articles_sortis,
  count(d.article_id) filter (where d.qte_ajustements  <> 0) as articles_ajustes,
  count(d.article_id) filter (where d.en_alerte)             as articles_en_alerte,
  coalesce(sum(d.mouvements_depuis), 0)                      as mouvements_depuis,

  coalesce(round(sum(d.valeur_actuelle)
        - sum(d.valeur_comptee + d.valeur_achats + d.valeur_prelevements
              + d.valeur_retours + d.valeur_ajustements + d.valeur_pertes), 2),
           0::numeric) as controle
from v_depot_reference r
left join v_depot_decomposition d on true
group by r.inventaire_id, r.inventaire_label, r.inventaire_date,
         r.coupure, r.valeur_signee;

comment on view v_depot_evolution is
  'Une ligne, toujours — meme catalogue vide, ou tout vaut zero. `controle` '
  'doit valoir 0.00. `effet_prix` = ce que le deplacement du CMP a ajoute au '
  'comptage signe.';


-- Même défaut, même correction.
create or replace view v_inventaire_couverture as
select
  r.inventaire_id,
  r.inventaire_date,
  count(d.article_id)                                                      as articles_actifs,
  count(d.article_id) filter (where il.id is not null)                     as articles_comptes,
  count(d.article_id) filter (where il.id is null)                         as articles_non_comptes,
  count(d.article_id) filter (where il.id is null and d.qte_actuelle <> 0) as non_comptes_avec_stock,
  round(coalesce(sum(d.valeur_actuelle) filter (where il.id is null), 0), 2) as valeur_non_comptee
from v_depot_reference r
left join v_depot_decomposition d on true
left join inventory_lines il
       on il.inventory_id = r.inventaire_id and il.article_id = d.article_id
group by r.inventaire_id, r.inventaire_date;

comment on view v_inventaire_couverture is
  'Combien d articles le dernier inventaire n a pas comptes, et ce qu ils '
  'pesent. Une ligne, toujours.';
