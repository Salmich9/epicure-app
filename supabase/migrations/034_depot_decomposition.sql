-- =============================================================================
-- 034 — D'où vient la valeur du dépôt
--
-- Objectif d'affichage, sur la page Dépôt :
--
--     59 522 MAD
--     59 672 comptés le 06/09 · − 1 500 sortis · + 1 350 rentrés
--
-- Un chiffre nu ne dit pas d'où il vient. Celui-ci répond à la seule question
-- qui compte quand on le regarde : quelle part repose sur des yeux, et quelle
-- part sur de la paperasse ? Un inventaire d'hier avec deux achats, on y croit.
-- Un inventaire de mars avec quarante mouvements, beaucoup moins.
--
-- LA COUPURE EST `signed_at`, L'HORODATAGE DE VALIDATION — jamais
-- `inventories.date`, qui est saisi à la main et peut lui être antérieur de
-- plusieurs jours. Un mouvement enregistré dans l'intervalle a déjà été absorbé
-- par l'écart d'ajustement ; le compter dans « depuis » le compterait deux fois.
--
-- LA BASE COMPTÉE EST LUE DANS LE JOURNAL, pas dans `inventory_lines`. Deux
-- raisons, et la seconde est la plus forte :
--   — `validate_inventory` ignore silencieusement les articles sans ligne
--     d'inventaire. Ils sont 8 sur 35 aujourd'hui. Passer par les lignes les
--     ferait disparaître de l'addition, qui ne tomberait plus juste.
--   — Par construction, base + depuis = total. L'identité ne PEUT pas dériver,
--     quoi qu'il arrive au journal.
--
-- TOUT EST VALORISÉ AU CMP COURANT, comme `current_stock` : une seule
-- valorisation, principe posé en 026/027. `inventories.total_value`, lui figé,
-- est exposé à côté sous `valeur_signee` — et l'écart entre les deux porte un
-- nom, `effet_prix`, au lieu de rester un mystère.
--
-- `v_depot_decomposition` porte aussi photo, seuil et catégorie : la page Dépôt
-- doit pouvoir se peindre à partir d'UNE lecture. Deux sources sur le même
-- écran finissent toujours par se contredire.
-- =============================================================================

create or replace view v_depot_reference as
select
  i.id                                            as inventaire_id,
  i.label                                         as inventaire_label,
  i.date                                          as inventaire_date,
  i.signed_at                                     as validation,
  coalesce(i.signed_at, '-infinity'::timestamptz) as coupure,
  i.total_value                                   as valeur_signee,
  i.responsible_name                              as responsable
from (select 1) z
left join lateral (
  select * from inventories
   where status = 'valide'
   order by signed_at desc nulls last
   limit 1
) i on true;

comment on view v_depot_reference is
  'L inventaire qui fait foi, et l horodatage qui coupe le journal en deux. '
  'Toujours une ligne, meme sans inventaire valide : la coupure vaut alors '
  '-infinity et tout tombe dans « depuis ». Jamais de double comptage.';


-- L'ordre des colonnes compte : `create or replace view` ne sait pas les
-- reordonner. Y ajouter une colonne au milieu impose de supprimer puis
-- recreer les trois vues, dans l'ordre inverse de leurs dependances.
drop view if exists v_inventaire_couverture;
drop view if exists v_depot_evolution;
drop view if exists v_depot_decomposition;

create view v_depot_decomposition as
with q as (
  select
    a.id                as article_id,
    a.name              as article,
    a.type              as nature,
    a.average_cost      as cout_moyen,
    a.photo_url,
    a.low_stock_threshold,
    a.category_id,
    cat.name            as categorie,
    cat.sort_order      as categorie_ordre,
    un.abbreviation     as unite,
    r.inventaire_id, r.inventaire_label, r.inventaire_date, r.coupure, r.valeur_signee,

    coalesce(sum(sm.quantity) filter (where sm.created_at <= r.coupure), 0)                    as qte_comptee,
    coalesce(sum(sm.quantity) filter (where sm.created_at >  r.coupure
                                        and sm.type = 'achat'), 0)                            as qte_achats,
    coalesce(sum(sm.quantity) filter (where sm.created_at >  r.coupure
                                        and sm.type = 'prelevement'), 0)                      as qte_prelevements,
    coalesce(sum(sm.quantity) filter (where sm.created_at >  r.coupure
                                        and sm.type = 'retour'), 0)                           as qte_retours,
    coalesce(sum(sm.quantity) filter (where sm.created_at >  r.coupure
                                        and sm.type in ('ajustement','inventaire_initial')),0) as qte_ajustements,
    coalesce(sum(sm.quantity) filter (where sm.created_at >  r.coupure
                                        and sm.type = 'perte'), 0)                            as qte_pertes,
    coalesce(sum(sm.quantity), 0)                                                             as qte_actuelle,

    -- Ce qui a RÉELLEMENT été payé depuis la coupure : coût figé, pas le CMP.
    coalesce(sum(sm.quantity * sm.unit_cost) filter (where sm.created_at > r.coupure
                                                       and sm.type = 'achat'), 0)             as montant_achats_paye,
    count(*) filter (where sm.created_at > r.coupure)                                         as mouvements_depuis
  from articles a
  cross join v_depot_reference r
  left join stock_movements sm on sm.article_id = a.id
  left join categories cat     on cat.id = a.category_id
  left join units un           on un.id  = a.unit_id
  where a.active
  group by a.id, a.name, a.type, a.average_cost, a.photo_url, a.low_stock_threshold,
           a.category_id, cat.name, cat.sort_order, un.abbreviation,
           r.inventaire_id, r.inventaire_label, r.inventaire_date, r.coupure, r.valeur_signee
)
select
  q.*,
  qte_comptee       * cout_moyen as valeur_comptee,
  qte_achats        * cout_moyen as valeur_achats,
  qte_prelevements  * cout_moyen as valeur_prelevements,   -- négatif
  qte_retours       * cout_moyen as valeur_retours,
  qte_ajustements   * cout_moyen as valeur_ajustements,
  qte_pertes        * cout_moyen as valeur_pertes,
  qte_actuelle      * cout_moyen as valeur_actuelle,
  (low_stock_threshold is not null and qte_actuelle <= low_stock_threshold) as en_alerte
from q;

comment on view v_depot_decomposition is
  'Par article : ce qui etait compte au dernier inventaire, ce qui s est passe '
  'depuis par nature, ce qui reste. Porte aussi photo, seuil et categorie, pour '
  'que la page Depot se peigne d une seule lecture. Valeurs NON arrondies a '
  'dessein : on arrondit une seule fois, a la fin, sinon la somme des arrondis '
  'ne retombe pas sur le total.';


-- Les colonnes de référence viennent de `v_depot_reference`, qui n'a qu'une
-- ligne : on les groupe plutôt que de les agréger. `max()` n'existe d'ailleurs
-- pas sur un uuid — et agréger une constante serait dire qu'on ignore qu'elle
-- en est une.
create view v_depot_evolution as
select
  r.inventaire_id,
  r.inventaire_label,
  r.inventaire_date,
  r.coupure,
  r.valeur_signee,

  round(sum(d.valeur_comptee), 2)               as valeur_comptee,
  round(sum(d.valeur_achats), 2)                as valeur_achats,
  round(sum(d.valeur_prelevements), 2)          as valeur_prelevements,
  round(sum(d.valeur_retours), 2)               as valeur_retours,
  round(sum(d.valeur_ajustements), 2)           as valeur_ajustements,
  round(sum(d.valeur_pertes), 2)                as valeur_pertes,
  round(sum(d.valeur_actuelle), 2)              as valeur_totale,

  round(sum(d.montant_achats_paye), 2)          as montant_achats_paye,
  round(sum(d.valeur_comptee) - coalesce(r.valeur_signee, 0), 2) as effet_prix,

  count(*) filter (where d.qte_achats       <> 0) as articles_achetes,
  count(*) filter (where d.qte_prelevements <> 0) as articles_sortis,
  count(*) filter (where d.qte_ajustements  <> 0) as articles_ajustes,
  count(*) filter (where d.en_alerte)             as articles_en_alerte,
  coalesce(sum(d.mouvements_depuis), 0)           as mouvements_depuis,

  -- Auto-contrôle. Doit valoir 0.00. Toute autre valeur signale que la
  -- partition du journal a un trou ou un recouvrement : c'est un détecteur de
  -- bug gratuit, et il vit dans la vue plutôt que dans un test qu'on oublie
  -- de lancer.
  round(sum(d.valeur_actuelle)
        - sum(d.valeur_comptee + d.valeur_achats + d.valeur_prelevements
              + d.valeur_retours + d.valeur_ajustements + d.valeur_pertes), 2) as controle
from v_depot_decomposition d
cross join v_depot_reference r
group by r.inventaire_id, r.inventaire_label, r.inventaire_date,
         r.coupure, r.valeur_signee;

comment on view v_depot_evolution is
  'Une ligne : la valeur du depot et sa decomposition depuis le dernier '
  'inventaire valide. `controle` doit valoir 0.00. `effet_prix` = ce que le '
  'deplacement du CMP a ajoute au comptage signe.';


-- Ce que l'inventaire n'a pas vu. `validate_inventory` ignore en silence tout
-- article sans ligne : le trou existe, autant le rendre visible.
create view v_inventaire_couverture as
select
  r.inventaire_id,
  r.inventaire_date,
  count(*)                                                            as articles_actifs,
  count(*) filter (where il.id is not null)                           as articles_comptes,
  count(*) filter (where il.id is null)                               as articles_non_comptes,
  count(*) filter (where il.id is null and d.qte_actuelle <> 0)       as non_comptes_avec_stock,
  round(coalesce(sum(d.valeur_actuelle) filter (where il.id is null), 0), 2) as valeur_non_comptee
from v_depot_decomposition d
cross join v_depot_reference r
left join inventory_lines il
       on il.inventory_id = r.inventaire_id and il.article_id = d.article_id
group by r.inventaire_id, r.inventaire_date;

comment on view v_inventaire_couverture is
  'Combien d articles le dernier inventaire n a pas comptes, et ce qu ils pesent.';

-- Les nouvelles vues n'héritent d'aucun GRANT : sans ceci, le bot ne les voit pas.
grant select on v_depot_reference, v_depot_decomposition,
                v_depot_evolution, v_inventaire_couverture
to barometre_lecture;
