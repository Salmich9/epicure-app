-- =============================================================================
-- 022 — Disponibilité d'un article à une date
--
-- « Cette formule est calculée par une vue en base, jamais par le bot. Le jour
--   où la règle change, elle change à un seul endroit. »
--
-- Une réserve technique : une vue ne peut pas prendre une date en paramètre.
-- C'est donc une FONCTION qui renvoie une table, plus une vue de confort pour
-- aujourd'hui. L'intention du brief est tenue — un seul endroit, jamais dans le
-- bot ; c'est la forme qui change.
--
-- -----------------------------------------------------------------------------
-- LA FORMULE, ET POURQUOI ELLE DIFFÈRE DE CELLE DU BRIEF
--
-- Le brief propose :
--     dernier inventaire − engagements − casse et perte depuis l'inventaire
--                        + retours attendus
--
-- Or `validate_inventory` insère l'écart constaté comme mouvement `ajustement`,
-- et `current_stock` somme TOUS les mouvements. Donc :
--
--     dernier inventaire − casse et perte depuis  ≡  current_stock.quantity
--
-- Reprendre la formule du brief mot pour mot soustrairait la casse deux fois.
-- La bonne formule sur ce schéma :
--
--     disponible(article, D) = current_stock.quantity
--                            − engagements pas encore sortis qui pèsent sur D
--                            + retours attendus avant D
--
-- Le détail qui fait tout : un engagement `chargee` a DÉJÀ son mouvement de
-- prélèvement en base, donc `current_stock` l'a déjà retiré. Le soustraire une
-- seconde fois serait la même erreur. On ne soustrait que ce qui n'est pas
-- encore sorti (`provisoire`, `confirmee`), et on rajoute ce qui est sorti mais
-- rentre avant D.
-- =============================================================================

create or replace function stock_disponible(p_date date)
returns table (
  article_id         uuid,
  name               text,
  type               text,
  quantity_stock     numeric,
  engaged            numeric,
  expected_returns   numeric,
  available          numeric,
  inventory_date     date,
  inventory_age_days integer
)
language sql
stable
set search_path to 'public'
as $$
  with inventaire as (
    select max(date) as d from inventories where status = 'valide'
  ),
  -- Engagé : pas encore sorti du stock, et pèse sur la date demandée.
  --   retournable -> seulement si la période chevauche D (il revient après)
  --   consommable -> dès que la sortie est prévue avant ou à D (il ne revient pas)
  engage as (
    select r.article_id, sum(r.quantity) as q
    from stock_reservations r
    where r.status in ('provisoire', 'confirmee')
      and r.starts_at <= p_date
      and (r.nature = 'consommable' or r.ends_at >= p_date)
    group by r.article_id
  ),
  -- Déjà sorti (donc déjà déduit de current_stock) mais rentre avant D.
  retours as (
    select r.article_id, sum(r.quantity) as q
    from stock_reservations r
    where r.status = 'chargee'
      and r.nature = 'retournable'
      and r.ends_at < p_date
    group by r.article_id
  )
  select
    cs.article_id,
    cs.name,
    cs.type,
    cs.quantity,
    coalesce(e.q, 0),
    coalesce(t.q, 0),
    cs.quantity - coalesce(e.q, 0) + coalesce(t.q, 0),
    i.d,
    -- L'âge se compte depuis aujourd'hui, pas depuis la date demandée :
    -- « un chiffre de trente jours ne se lit pas comme un chiffre d'hier ».
    case when i.d is null then null else (current_date - i.d)::integer end
  from current_stock cs
  left join engage  e on e.article_id = cs.article_id
  left join retours t on t.article_id = cs.article_id
  cross join inventaire i
  where cs.active;
$$;

comment on function stock_disponible(date) is
  'Disponibilite par article a une date. Seul endroit ou la formule existe.';

-- Vue de confort. Toute la logique reste dans la fonction.
create or replace view stock_disponible_aujourdhui as
  select * from stock_disponible(current_date);


-- =============================================================================
-- Expiration des réserves provisoires
--
-- Sans ça, un brief abandonné le vendredi soir gèle du stock pour toujours et
-- l'affichage devient faux dans l'autre sens.
-- =============================================================================

create or replace function expirer_reserves_provisoires()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nb integer;
begin
  update stock_reservations
     set status = 'expiree', updated_at = now()
   where status = 'provisoire'
     and expires_at is not null
     and expires_at < now();
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

comment on function expirer_reserves_provisoires() is
  'Passe les reserves provisoires echues a expiree. A appeler par un cron.';
