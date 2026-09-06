-- =============================================================================
-- 019 — Sortir la facturation d'événement de l'EAV
--
-- `event_briefing` sert d'entrepôt clé/valeur générique. Deux familles de clés y
-- portent de la **facturation**, c'est-à-dire qui paie quoi :
--
--   bar_{N}_entite_facturation                          — au niveau du bar
--   fact_bar_{N}_{cocktail|shot}_{itemId}_{alcool|garnish}  — par article servi
--
-- La seconde famille est construite par `BriefingSection11.jsx`. Ces données
-- n'existent nulle part ailleurs dans le schéma : supprimer `event_briefing`
-- sans les avoir sorties les perdrait définitivement.
--
-- ⚠️ CE QUE CETTE MIGRATION SAUVE RÉELLEMENT, AUJOURD'HUI
--
-- Au moment de l'écrire, la base contient **90 réponses de briefing, dont
-- 0 clé `fact_*`** et **2 clés `entite_facturation`**. La section facturation
-- de l'app est du travail en cours, jamais encore utilisé en production.
--
-- Cette migration n'est donc pas un sauvetage massif : elle sort les deux
-- lignes qui existent, et surtout elle **donne un endroit réel** où la
-- facturation atterrira, pour que la dette ne se recreuse pas. Le backfill des
-- clés `fact_*` est écrit et correct ; il ne trouve simplement rien à reprendre
-- pour l'instant.
--
-- Purement additif : `event_briefing` n'est pas touchée. Les données y restent
-- en double le temps que l'app soit basculée sur cette table.
-- =============================================================================

create table if not exists event_billing_lines (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid    not null references events(id) on delete cascade,

  -- Pas de borne haute. L'app plafonne à 5 bars, mais une table de sauvetage
  -- doit accepter ce que la source contenait : une contrainte trop stricte
  -- ferait échouer la reprise au lieu de récupérer la donnée.
  bar_index   integer not null check (bar_index >= 1),

  -- 'bar' = la facturation globale du bar ; sinon l'article servi.
  item_type   text    not null check (item_type in ('bar','cocktail','shot')),

  -- L'identifiant de l'instance dans le JSON `bar_N_cocktails` / `bar_N_shots`.
  -- Vide pour une ligne de niveau bar. Volontairement `text` et non `uuid` :
  -- c'est une clé d'un blob JSON, rien ne garantit sa forme.
  item_ref    text    not null default '',

  -- Résolue quand le JSON la porte. Peut rester nulle : le catalogue de
  -- recettes est incomplet (3 recettes sur 4 sans verre ni alcool).
  recipe_id   uuid    references cocktail_recipes(id),

  -- Ce qui est facturé sur cette ligne.
  poste       text    not null check (poste in ('global','alcool','garnish')),

  -- Qui paie. Texte libre : les valeurs réelles sont du genre
  -- « Epicure Catering », pas une énumération arrêtée.
  entite      text,

  -- D'où vient la ligne, pour savoir ce qui est repris et ce qui est saisi.
  source      text    not null default 'event_briefing',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint event_billing_lines_unicite
    unique (event_id, bar_index, item_type, item_ref, poste)
);

create index if not exists idx_billing_event on event_billing_lines (event_id);

drop trigger if exists trg_event_billing_lines_updated_at on event_billing_lines;
create trigger trg_event_billing_lines_updated_at
  before update on event_billing_lines
  for each row execute function set_updated_at();

-- Même politique que les autres tables sensibles ajoutées pour le bot : RLS
-- active, aucune policy. Qui paie quoi ne se lit pas avec la clé anon.
alter table event_billing_lines enable row level security;

comment on table event_billing_lines is
  'Facturation par bar et par article, sortie de l EAV event_briefing.';


-- ---------------------------------------------------------------------------
-- Reprise 1 — la facturation au niveau du bar
--   bar_{N}_entite_facturation
-- ---------------------------------------------------------------------------

insert into event_billing_lines (event_id, bar_index, item_type, item_ref, poste, entite, source)
select b.event_id,
       (regexp_match(b.question_key, '^bar_(\d+)_entite_facturation$'))[1]::integer,
       'bar', '', 'global',
       nullif(btrim(b.answer_value), ''),
       'event_briefing'
from event_briefing b
where b.question_key ~ '^bar_\d+_entite_facturation$'
  and nullif(btrim(b.answer_value), '') is not null
on conflict on constraint event_billing_lines_unicite do nothing;


-- ---------------------------------------------------------------------------
-- Reprise 2 — la facturation par article
--   fact_bar_{N}_{cocktail|shot}_{itemId}_{alcool|garnish}
--
-- L'identifiant est un UUID qui contient des tirets, donc le découpage se fait
-- par ancrage sur le suffixe (`_alcool` ou `_garnish`), pas en coupant sur `_`.
--
-- `recipe_id` est retrouvée en cherchant, dans le JSON du bar concerné,
-- l'élément dont `id` vaut l'identifiant extrait de la clé.
-- ---------------------------------------------------------------------------

with decoupees as (
  select b.event_id,
         b.answer_value,
         m[1]::integer as bar_index,
         m[2]           as item_type,
         m[3]           as item_ref,
         m[4]           as poste
  from event_briefing b
  cross join lateral regexp_match(
    b.question_key,
    '^fact_bar_(\d+)_(cocktail|shot)_(.+)_(alcool|garnish)$'
  ) as m
  where m is not null
),
avec_recette as (
  select d.*,
         (
           select (element ->> 'recipe_id')::uuid
           from event_briefing src
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(src.answer_value::jsonb) = 'array'
                  then src.answer_value::jsonb else '[]'::jsonb end
           ) as element
           where src.event_id = d.event_id
             and src.question_key = 'bar_' || d.bar_index || '_' || d.item_type || 's'
             and element ->> 'id' = d.item_ref
             and (element ->> 'recipe_id') is not null
           limit 1
         ) as recipe_id
  from decoupees d
)
insert into event_billing_lines
  (event_id, bar_index, item_type, item_ref, recipe_id, poste, entite, source)
select event_id, bar_index, item_type, item_ref, recipe_id, poste,
       nullif(btrim(answer_value), ''), 'event_briefing'
from avec_recette
where nullif(btrim(answer_value), '') is not null
on conflict on constraint event_billing_lines_unicite do nothing;
