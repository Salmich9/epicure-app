-- =============================================================================
-- 046 — Le public ne supprime plus les photos
--
-- `article_photos` portait quatre policies pour `anon` et `authenticated` :
-- SELECT, INSERT, UPDATE et DELETE. Or `anon` n'est pas un role d'utilisateur
-- connecte : c'est la cle publiee, compilee dans le bundle envoye au
-- navigateur. Ce qu'elle peut faire, tout visiteur le peut.
--
-- Au 10/09/2026, n'importe qui ouvrant l'application pouvait donc effacer les
-- 105 photos du catalogue, en une requete, depuis la console. Constate en
-- passant : le script de purge des orphelins a supprime nuef fichiers avec la
-- seule cle publique, sans jamais avoir besoin de `service_role`.
--
-- C'EST LA MEME CORRECTION QUE LA 035, sur un autre objet. La RLS y contraint
-- la FORME de ce qui est ecrit ; ici elle doit contraindre le GESTE lui-meme,
-- parce que l'application n'a jamais eu besoin de supprimer.
--
-- CE QUE L'APPLICATION FAIT VRAIMENT, verifie plutot que suppose. Un seul
-- appel au stockage dans tout `src/` : `uploadArticlePhoto`, qui depose sous un
-- nom horodate (`<article_id>-<Date.now()>.<ext>`) et lit une URL publique.
-- Elle ne supprime jamais, elle n'ecrase jamais. Retirer DELETE ne lui coute
-- donc rien — c'est mesure, pas espere.
--
-- CE QUI RESTE OUVERT, ET POURQUOI. UPDATE demeure : `upload()` est appele
-- avec `upsert: true`, qui demande formellement ce droit meme si la collision
-- est impossible en pratique (il faudrait deux envois sur le meme article dans
-- la meme milliseconde). Le retirer risquerait de casser le televersement,
-- c'est-a-dire la fonction. La bonne suite est de passer `upsert: false` dans
-- `src/data/articles.js`, de deployer, PUIS de retirer UPDATE. Deux etapes,
-- dans cet ordre, et pas dans la meme migration que celle-ci.
--
-- CONSEQUENCE POUR LA MAINTENANCE. `scripts/purger-photos-orphelines.mjs`
-- supprimait avec la cle publique. Il lui faut desormais `service_role`, ce
-- qui est sa place : un outil de maintenance s'authentifie, une page web non.
-- =============================================================================

begin;

-- Garde-fou. Si la policy a deja ete retiree, ou renommee, on veut le savoir
-- plutot que de croire avoir ferme une porte qui l'etait deja — ou pire, qui
-- porte maintenant un autre nom et reste ouverte.
do $$
declare v_delete integer; v_lecture integer; v_ajout integer;
begin
  select count(*) into v_delete   from pg_policies
   where schemaname='storage' and tablename='objects' and cmd='DELETE';
  select count(*) into v_lecture  from pg_policies
   where schemaname='storage' and tablename='objects' and cmd='SELECT';
  select count(*) into v_ajout    from pg_policies
   where schemaname='storage' and tablename='objects' and cmd='INSERT';

  if v_delete <> 1 then
    raise exception 'Refus : % policy(ies) DELETE sur storage.objects, 1 attendue.', v_delete
      using errcode = '42501',
            hint = 'Relire pg_policies avant de rejouer : le nom a peut-etre change.';
  end if;

  -- On ne ferme pas une porte en en fermant trois. La lecture et le depot
  -- doivent survivre, sinon l'application ne peut plus afficher ni ajouter.
  if v_lecture < 1 or v_ajout < 1 then
    raise exception 'Refus : lecture=% ajout=%, il en faut au moins une de chaque.',
      v_lecture, v_ajout using errcode = '42501';
  end if;
end $$;

drop policy if exists "article_photos_suppression" on storage.objects;

-- Le privilege lui-meme, en plus de la policy. Ce n'est pas redondant : une
-- policy DELETE reintroduite par erreur ne rouvrirait rien a elle seule. C'est
-- la lecon de la 035, et elle vaut ici parce qu'`article_photos` est le SEUL
-- bucket du projet — le retrait ne peut donc en penaliser aucun autre.
--
-- `service_role` contourne la RLS et n'est pas concerne : le script de
-- maintenance continue de fonctionner avec lui.
revoke delete on storage.objects from anon, authenticated;

commit;

-- --- Contrôles, à relire après application -----------------------------------
--
--   select cmd, policyname, roles::text from pg_policies
--    where schemaname='storage' and tablename='objects' order by cmd;
--     → INSERT, SELECT, UPDATE. Plus de DELETE.
--
-- Et le verrou doit MORDRE. Le test qui compte n'est pas de relire la liste
-- des policies, c'est d'exercer le geste :
--
--   begin;
--     set local role anon;
--     delete from storage.objects
--      where bucket_id = 'article_photos'
--        and name = (select name from storage.objects
--                     where bucket_id='article_photos' limit 1);
--     -- doit afficher DELETE 0, et non DELETE 1
--   rollback;
--
-- Zero ligne touchee : la RLS a refuse en silence, comme elle le fait toujours.
-- Le rollback n'est la que par principe — il n'y a rien a annuler.
