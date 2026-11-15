-- Retour arrière de 048 et 049 (à n'utiliser qu'en cas de panne) : rouvre comme avant 048.
do $$
declare p record;
begin
  for p in select * from pg_policies where schemaname = 'public' and tablename <> 'factures_registre' and tablename <> 'dossiers_drive' loop
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename,
        replace(p.qual, ' AND (public.depot_session() IS NOT NULL)', ''), replace(p.with_check, ' AND (public.depot_session() IS NOT NULL)', ''));
    elsif p.qual is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, replace(p.qual, ' AND (public.depot_session() IS NOT NULL)', ''));
    elsif p.with_check is not null then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, replace(p.with_check, ' AND (public.depot_session() IS NOT NULL)', ''));
    end if;
  end loop;
end $$;
alter table public.dossiers_drive disable row level security;
grant select on public.users to anon, authenticated;
-- Les fonctions gardent leur contrôle de session : avec l'appli à jour, il ne gêne pas.
