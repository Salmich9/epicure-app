-- =============================================================================
-- 043 — Trois unités, pas seize
--
-- `units` porte 16 lignes pour 3 unités réelles. Le seed a été appliqué deux
-- fois : chaque nom existe en double, à l'identique. C'est le même accident que
-- sur `categories`, que la 029 a réparé — sans toucher aux unités.
--
--   Bidon ×2   Bouteille ×2   Carton ×2   Litre ×2   Paquet ×2   Pièce ×2
--   Rouleau ×2                Kilogramme ×1          Unité ×1
--
-- ET « Kilogramme » PORTE UNE ESPACE FINALE. Invisible à l'écran, fatale à un
-- index d'unicité sur `name` nu : « Kilogramme » et « Kilogramme » seraient
-- deux clés distinctes. Même chose pour « Unité », qui part de toute façon.
-- On normalise avant de dédoublonner, pas l'inverse.
--
-- LA FENÊTRE EST OUVERTE MAINTENANT. Après le reset de la 041 il reste
-- 3 articles, tous sur « Pièce » ; les 13 lignes vouées à disparaître n'en
-- portent aucun. Une seule clé étrangère pointe vers `units`. Attendre un
-- catalogue rempli transformerait cette suppression en repointage de masse.
--
-- POURQUOI SUPPRIMER PLUTÔT QUE DÉSACTIVER. Une unité ne porte aucune histoire :
-- ce n'est pas un article, il n'y a pas de mouvement rattaché, rien à retrouver
-- plus tard. Une ligne désactivée qu'on ne réactivera jamais est du bruit dans
-- une liste déroulante, pour toujours — c'est l'argument de la 041 sur le
-- catalogue, appliqué à un référentiel.
--
-- « Pièce » RESTE AU SINGULIER, comme « Bouteille » et « Kilogramme ». La
-- demande disait « Pièces » ; les trois noms au singulier se lisent mieux
-- ensemble, et c'est le nom que portent déjà les 3 articles du catalogue.
-- =============================================================================

begin;

-- --- Garde-fou 1 : les trois survivantes existent bien -----------------------
-- Si un renommage depuis Paramètres avait fait disparaître l'un des trois noms,
-- la suite viderait la table. On s'arrête plutôt.
do $$
declare v_trouvees integer;
begin
  select count(distinct lower(btrim(name))) into v_trouvees
  from units
  where lower(btrim(name)) in ('bouteille', 'kilogramme', 'pièce');

  if v_trouvees <> 3 then
    raise exception 'Refus : % nom(s) gardé(s) trouvé(s) sur 3 attendus.', v_trouvees
      using errcode = '42501',
            hint    = 'Verifier les noms dans units avant de rejouer.';
  end if;
end $$;


-- --- La normalisation, d'abord -----------------------------------------------
update units set name = btrim(name), abbreviation = btrim(abbreviation)
where name <> btrim(name) or abbreviation <> btrim(abbreviation);


-- --- Qui survit --------------------------------------------------------------
-- Une par nom normalisé : l'active en priorité, la plus ancienne à défaut.
-- Aucun UUID n'est écrit en dur — les identifiants sont générés, une migration
-- qui les cite ne se rejoue nulle part ailleurs. Le `distinct on` est répété
-- dans les deux ordres qui suivent plutôt que figé dans une table temporaire :
-- une table temporaire lie la migration au fait d'être exécutée en un seul bloc.


-- --- Le repointage -----------------------------------------------------------
-- `articles.unit_id` est la SEULE clé étrangère vers `units`. Vérifié plutôt
-- que supposé : le contrôle ci-dessous refuse la migration si une autre table
-- s'est mise à pointer ici depuis.
do $$
declare v_refs integer;
begin
  select count(*) into v_refs
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where c.contype = 'f'
    and c.confrelid = 'units'::regclass
    and not (t.relname = 'articles');

  if v_refs > 0 then
    raise exception 'Refus : % clé(s) étrangère(s) inattendue(s) vers units.', v_refs
      using errcode = '42501';
  end if;
end $$;

with gardees as (
  select distinct on (lower(name)) id, name
  from units
  where lower(name) in ('bouteille', 'kilogramme', 'pièce')
  order by lower(name), active desc, created_at asc
)
update articles a
   set unit_id = g.id
  from units u
  join gardees g on lower(g.name) = lower(u.name)
 where a.unit_id = u.id
   and a.unit_id <> g.id;


-- --- La suppression ----------------------------------------------------------
with gardees as (
  select distinct on (lower(name)) id
  from units
  where lower(name) in ('bouteille', 'kilogramme', 'pièce')
  order by lower(name), active desc, created_at asc
)
delete from units
where id not in (select id from gardees);


-- --- Garde-fou 2 : plus rien ne pend -----------------------------------------
do $$
declare v_orphelins integer; v_restantes integer;
begin
  select count(*) into v_orphelins
  from articles a
  where a.unit_id is not null
    and not exists (select 1 from units u where u.id = a.unit_id);

  if v_orphelins > 0 then
    raise exception 'Refus : % article(s) pointent vers une unite supprimee.', v_orphelins
      using errcode = '42501';
  end if;

  select count(*) into v_restantes from units;
  if v_restantes <> 3 then
    raise exception 'Refus : % unite(s) restante(s), 3 attendues.', v_restantes
      using errcode = '42501';
  end if;
end $$;


-- --- Le verrou, pour que ça ne se reproduise pas -----------------------------
-- La récidive à empêcher est un seed rejoué, qui écrit à l'identique. `lower` et
-- `btrim` couvrent aussi la saisie humaine « bouteille » et « Bouteille  ».
--
-- NON PARTIEL, contrairement à la 038 sur les articles : là-bas un nom archivé
-- porte de l'histoire — des mouvements, des achats — et doit pouvoir cohabiter
-- avec un homonyme actif. Ici, rien.
--
-- Les accents restent hors du filet : « Piece » et « Pièce » seraient deux clés.
-- `unaccent` est une extension à installer pour trois lignes, et ce n'est pas
-- par là que le doublon est arrivé.
create unique index if not exists units_name_key
  on units (lower(btrim(name)));

create unique index if not exists units_abbreviation_key
  on units (lower(btrim(abbreviation)));

-- Les trois restantes sont visibles dans les listes déroulantes.
update units set active = true where not active;

commit;

-- --- Contrôles, à relire après application -----------------------------------
--
--   select '['||name||']', '['||abbreviation||']', active from units order by name;
--     → [Bouteille] [btl] t / [Kilogramme] [Kg] t / [Pièce] [pce] t
--
--   select count(*) from articles where unit_id is not null
--     and unit_id not in (select id from units);                 -- 0
--
-- Et le verrou doit mordre :
--   insert into units (name, abbreviation) values ('bouteille', 'x');  -- 23505
