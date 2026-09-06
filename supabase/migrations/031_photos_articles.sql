-- =============================================================================
-- 031 — Les photos d'article, enfin televersables
--
-- Le code d'upload existait depuis longtemps et n'avait jamais pu fonctionner,
-- pour deux raisons cumulees :
--
--   1. le code visait le bucket `article-photos` (tiret), le bucket cree
--      s'appelle `article_photos` (souligne) — corrige cote app ;
--   2. `storage.objects` ne portait AUCUNE policy pour ce bucket. Le RLS y est
--      actif par defaut : sans policy, tout INSERT est refuse. Silencieusement,
--      du point de vue de l'utilisateur.
--
-- Le plafond de 512 Ko n'est pas une contrainte subie, c'est la regle : une
-- photo sert a reconnaitre un article dans une liste. `src/lib/image.js`
-- compresse cote navigateur avant l'envoi — 400 px sur le grand cote, WebP
-- qualite 0.5, soit ~24 Ko pour une photo de telephone de 5 Mo. Le plafond
-- n'est que le filet si cette compression est contournee.
--
-- Les policies visent `anon` autant qu'`authenticated` : l'app s'authentifie
-- par PIN applicatif, pas par Supabase Auth, et ecrit donc avec la cle anon.
-- Meme choix que pour les tables metier (voir la note de la 024).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article_photos', 'article_photos', true, 512000,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "article_photos_select" on storage.objects;
drop policy if exists "article_photos_insert" on storage.objects;
drop policy if exists "article_photos_update" on storage.objects;
drop policy if exists "article_photos_delete" on storage.objects;

create policy "article_photos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'article_photos');

create policy "article_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'article_photos');

create policy "article_photos_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'article_photos')
  with check (bucket_id = 'article_photos');

create policy "article_photos_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'article_photos');
