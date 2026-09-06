-- =============================================================================
-- 029 — Fusion des familles d'articles en double
--
-- Les 11 categories du seed d'origine ont ete inserees deux fois : « Base
-- commune » apparaissait deux fois dans la liste deroulante, « Base verrerie »
-- aussi, et ainsi de suite. 28 categories pour 17 reelles.
--
-- On garde la plus ancienne de chaque paire, on y rattache les articles de
-- l'autre, puis on supprime la seconde.
--
-- Trois paires portaient des articles DES DEUX COTES (Base commune 3+3,
-- Base hygiene 1+1, Base verrerie 1+3). Sans le repointage, supprimer l'une
-- d'elles aurait echoue sur la cle etrangere — ou pire, emporte ses articles.
-- =============================================================================

with paires as (
  select id,
         lower(btrim(name)) as cle,
         first_value(id) over (partition by lower(btrim(name))
                               order by created_at, id) as garde,
         sort_order
  from categories
),
doublons as (
  select id as a_supprimer, garde, cle from paires where id <> garde
),
repointes as (
  update articles a
     set category_id = d.garde, updated_at = now()
    from doublons d
   where a.category_id = d.a_supprimer
  returning a.id
),
ordre as (
  update categories c
     set sort_order = greatest(c.sort_order, p.sort_order)
    from paires p
   where c.id = p.garde and p.id <> p.garde and p.sort_order > c.sort_order
  returning c.id
),
supprimees as (
  delete from categories c
   using doublons d
   where c.id = d.a_supprimer
  returning c.id
)
select (select count(*) from repointes)  as articles_repointes,
       (select count(*) from supprimees) as categories_supprimees;
