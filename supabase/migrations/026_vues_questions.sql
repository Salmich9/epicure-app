-- =============================================================================
-- 026 — Vues de lecture pour le bot Telegram
--
-- Le bot pose des questions, il ne connaît pas le schéma. Ces vues répondent
-- directement à ce qu'on lui demandera, sans qu'il ait à joindre six tables :
--
--   « Combien vaut mon dépôt ? »              -> v_depot_resume
--   « Combien j'ai de verres Old Fashioned ? » -> v_depot
--   « Qu'avons-nous acheté ce mois-ci ? »      -> v_achats
--   « Combien de casses au dernier événement ?» -> v_evenements
--   « Que s'est-il passé sur cet article ? »   -> v_mouvements
--
-- Deux principes.
--
-- **Chaque chiffre de stock porte la date de son inventaire.** Un chiffre de
-- trente jours ne se lit pas comme un chiffre d'hier, et un bot qui répond
-- « 122 verres » sans le dire ment par omission.
--
-- **Une seule valorisation.** Tout est valorisé au coût moyen pondéré
-- (`articles.average_cost`), comme `current_stock`. À noter :
-- `get_dashboard_stats()` valorise les écarts au dernier prix d'achat, ce qui
-- donne un autre chiffre pour la même chose. Incohérence connue, laissée telle
-- quelle — la corriger changerait des chiffres déjà affichés dans l'app.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Le dépôt, article par article
-- ---------------------------------------------------------------------------

create or replace view v_depot as
  select
    cs.article_id,
    cs.name                         as article,
    cat.name                        as categorie,
    u.abbreviation                  as unite,
    cs.type                         as nature,          -- retournable | consommable
    cs.quantity                     as quantite,
    cs.average_cost                 as cout_moyen,
    round(cs.stock_value, 2)        as valeur,
    cs.low_stock_threshold          as seuil_alerte,
    (cs.low_stock_threshold is not null
       and cs.quantity <= cs.low_stock_threshold) as en_alerte,
    inv.date                        as date_inventaire,
    (current_date - inv.date)       as inventaire_jours
  from current_stock cs
  left join categories cat on cat.id = cs.category_id
  left join units u        on u.id   = cs.unit_id
  left join lateral (
    select max(date) as date from inventories where status = 'valide'
  ) inv on true
  where cs.active;

comment on view v_depot is
  'Un article par ligne : quantite, valeur au CMP, alerte, et age de l inventaire.';


-- ---------------------------------------------------------------------------
-- Le dépôt en un chiffre
-- ---------------------------------------------------------------------------

create or replace view v_depot_resume as
  select
    round(sum(valeur), 2)                          as valeur_totale,
    count(*)                                       as articles,
    count(*) filter (where quantite > 0)           as articles_en_stock,
    count(*) filter (where en_alerte)              as articles_en_alerte,
    round(sum(valeur) filter (where nature = 'retournable'), 2) as valeur_retournable,
    round(sum(valeur) filter (where nature = 'consommable'), 2) as valeur_consommable,
    max(date_inventaire)                           as date_inventaire,
    max(inventaire_jours)                          as inventaire_jours
  from v_depot;

comment on view v_depot_resume is
  'Une seule ligne : la valeur du depot et la date de l inventaire qui la fonde.';


-- ---------------------------------------------------------------------------
-- Les achats
-- ---------------------------------------------------------------------------

create or replace view v_achats as
  select
    p.id,
    p.date                                  as date_achat,
    to_char(p.date, 'YYYY-MM')              as mois,
    a.name                                  as article,
    cat.name                                as categorie,
    coalesce(s.name, 'Fournisseur non renseigné') as fournisseur,
    p.quantity                              as quantite,
    p.unit_price                            as prix_unitaire,
    round(p.total_price, 2)                 as total,
    p.note
  from purchases p
  join articles a          on a.id   = p.article_id
  left join categories cat on cat.id = a.category_id
  left join suppliers s    on s.id   = p.supplier_id;

comment on view v_achats is
  'Un achat par ligne, avec son mois pret a filtrer (colonne `mois`).';


-- ---------------------------------------------------------------------------
-- Les événements : prélevé, retourné, écart
--
-- L'écart est la différence entre ce qui est sorti et ce qui est revenu.
-- C'est la mesure de la casse et des pertes : `validate_event_returns` ne crée
-- volontairement aucun mouvement `perte`, pour ne pas compter deux fois.
--
-- Seuls les articles retournables comptent dans l'écart : un consommable qui
-- ne revient pas n'est pas une casse, c'est sa destination.
-- ---------------------------------------------------------------------------

create or replace view v_evenements as
  select
    e.id                                    as event_id,
    e.name                                  as evenement,
    e.date                                  as date_evenement,
    e.status                                as statut,
    e.updated_at                            as derniere_activite,
    coalesce(m.preleve, 0)                  as preleve,
    coalesce(m.retourne, 0)                 as retourne,
    coalesce(m.ecart, 0)                    as ecart,
    round(coalesce(m.valeur_ecart, 0), 2)   as valeur_ecart,
    case when coalesce(m.preleve, 0) > 0
         then round(100.0 * coalesce(m.retourne, 0) / m.preleve, 1)
    end                                     as taux_retour_pct,
    coalesce(m.articles, 0)                 as articles_concernes
  from events e
  left join lateral (
    select
      sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end) as preleve,
      sum(case when sm.type = 'retour'      then sm.quantity      else 0 end) as retourne,
      sum(case when a.type = 'retournable'
               then (case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
                  - (case when sm.type = 'retour'      then sm.quantity      else 0 end)
               else 0 end)                                                    as ecart,
      sum(case when a.type = 'retournable'
               then ((case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
                   - (case when sm.type = 'retour'      then sm.quantity      else 0 end))
                    * a.average_cost
               else 0 end)                                                    as valeur_ecart,
      count(distinct sm.article_id)                                           as articles
    from stock_movements sm
    join articles a on a.id = sm.article_id
    where sm.reference_type = 'event'
      and sm.reference_id   = e.id
      and sm.type in ('prelevement', 'retour')
  ) m on true;

comment on view v_evenements is
  'Par evenement : preleve, retourne, ecart et sa valeur. L ecart ne compte que les retournables.';


-- ---------------------------------------------------------------------------
-- Le détail des écarts, article par article
-- ---------------------------------------------------------------------------

create or replace view v_evenements_articles as
  select
    e.id                              as event_id,
    e.name                            as evenement,
    e.date                            as date_evenement,
    a.name                            as article,
    a.type                            as nature,
    sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end) as preleve,
    sum(case when sm.type = 'retour'      then sm.quantity      else 0 end) as retourne,
    sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
      - sum(case when sm.type = 'retour'  then sm.quantity      else 0 end) as ecart,
    round((sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end)
         - sum(case when sm.type = 'retour'      then sm.quantity      else 0 end))
          * a.average_cost, 2)                                              as valeur_ecart
  from stock_movements sm
  join events   e on e.id = sm.reference_id and sm.reference_type = 'event'
  join articles a on a.id = sm.article_id
  where sm.type in ('prelevement', 'retour')
  group by e.id, e.name, e.date, a.name, a.type, a.average_cost;

comment on view v_evenements_articles is
  'Le detail d un ecart : quel article, combien sorti, combien revenu.';


-- ---------------------------------------------------------------------------
-- L'historique des mouvements
-- ---------------------------------------------------------------------------

create or replace view v_mouvements as
  select
    sm.id,
    sm.created_at                     as horodatage,
    sm.created_at::date               as jour,
    to_char(sm.created_at, 'YYYY-MM') as mois,
    sm.type                           as type_mouvement,
    a.name                            as article,
    cat.name                          as categorie,
    sm.quantity                       as quantite,
    round(sm.quantity * a.average_cost, 2) as valeur,
    sm.reference_type                 as rattache_a,
    coalesce(e.name, i.label)         as reference,
    u.full_name                       as par,
    sm.note
  from stock_movements sm
  join articles a           on a.id   = sm.article_id
  left join categories cat  on cat.id = a.category_id
  left join users u         on u.id   = sm.created_by
  left join events e        on e.id   = sm.reference_id and sm.reference_type = 'event'
  left join inventories i   on i.id   = sm.reference_id and sm.reference_type = 'inventory';

comment on view v_mouvements is
  'Tous les mouvements a plat, avec leur rattachement lisible.';
