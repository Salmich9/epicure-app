-- =============================================================================
-- 027 — Le dashboard lit les mêmes vues que le bot
--
-- `get_dashboard_stats()` valorisait les écarts au **dernier prix d'achat**,
-- alors que le dépôt et les vues du bot les valorisent au **coût moyen
-- pondéré**. Deux chiffres pour la même chose.
--
-- Mesuré sur juin 2026, 8 événements clôturés :
--
--     dernier prix d'achat   12 545 MAD
--     coût moyen pondéré     15 545 MAD     (+24 %)
--
-- L'écart vient de 11 articles sur 33 dont les deux prix diffèrent.
--
-- ⚠️ Le chiffre « écarts du mois » affiché dans l'app va donc augmenter.
-- Ce n'est pas une régression : le dépôt était déjà valorisé au CMP, seuls
-- les écarts ne l'étaient pas.
--
-- -----------------------------------------------------------------------------
-- Plutôt que de corriger le prix et de laisser deux copies de la formule, la
-- fonction lit désormais les vues créées en 026. Une seule définition de
-- « valeur du dépôt » et une seule d'« écart » : elles ne peuvent plus diverger.
--
-- Effet de bord assumé : l'écart ne compte plus que les articles retournables,
-- comme dans `v_evenements`. Un consommable qui ne revient pas n'est pas une
-- casse, c'est sa destination. Sur juin, ça retire 30 MAD sur 15 545.
-- =============================================================================

create or replace function get_dashboard_stats()
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_depot        record;
  v_events       integer;
  v_ecarts_mois  numeric;
begin
  -- Valeur du dépôt et articles en alerte : une seule ligne, déjà calculée.
  select valeur_totale, articles_en_alerte, date_inventaire, inventaire_jours
    into v_depot
  from v_depot_resume;

  select count(*) into v_events
  from events where status = 'en_cours';

  -- Écarts des événements clôturés ce mois-ci, au CMP, retournables seuls.
  select coalesce(sum(valeur_ecart), 0) into v_ecarts_mois
  from v_evenements
  where statut = 'cloture'
    and date_trunc('month', derniere_activite) = date_trunc('month', now());

  return json_build_object(
    'depot_value',     coalesce(v_depot.valeur_totale, 0),
    'events_en_cours', v_events,
    'ecarts_mois',     v_ecarts_mois,
    'articles_alerte', coalesce(v_depot.articles_en_alerte, 0),
    -- Nouveau : le dashboard peut enfin dater son chiffre, comme le bot.
    'inventaire_date', v_depot.date_inventaire,
    'inventaire_jours', v_depot.inventaire_jours
  );
end;
$$;

comment on function get_dashboard_stats() is
  'KPIs du dashboard, lus depuis v_depot_resume et v_evenements. '
  'Meme valorisation (CMP) et meme definition de l ecart que le bot.';
