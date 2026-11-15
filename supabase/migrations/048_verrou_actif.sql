-- 048 : le verrou (partie B de 047). À appliquer une fois l'appli qui envoie la session en ligne.
-- Retour arrière possible : 048_retour.sql.

-- 1. Chaque politique existante exige en plus une session (sauf le registre des factures, lu par le bot)
do $$
declare p record; q text; w text;
begin
  for p in select * from pg_policies where schemaname = 'public' and tablename <> 'factures_registre' loop
    q := case when p.qual is not null then format('(%s) and (select public.depot_session()) is not null', p.qual) end;
    w := case when p.with_check is not null then format('(%s) and (select public.depot_session()) is not null', p.with_check) end;
    if q is not null and w is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename, q, w);
    elsif q is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, q);
    elsif w is not null then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, w);
    end if;
  end loop;
end $$;

-- 2. La seule table sans protection
alter table public.dossiers_drive enable row level security;
drop policy if exists depot_session on public.dossiers_drive;
create policy depot_session on public.dossiers_drive for all to anon, authenticated
  using ((select public.depot_session()) is not null) with check ((select public.depot_session()) is not null);

-- 3. Les vues lisent avec les droits de celui qui les interroge (donc avec le verrou)
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v' loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
  end loop;
end $$;

-- 4. Les fonctions sensibles exigent la session, et l'utilisateur annoncé doit être celui de la session
do $$
declare f record; def text; neuf text; appel text;
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('annuler_achat', 'annuler_prelevement', 'corriger_motif_ecart',
             'enregistrer_achat', 'validate_event_returns', 'validate_inventory', 'get_dashboard_stats', 'set_user_pin') loop
    def := pg_get_functiondef(f.oid);
    if def ~ '_depot_exige' then continue; end if;
    appel := case when f.proname = 'get_dashboard_stats' then 'perform public._depot_exige();'
                  when f.proname = 'set_user_pin' then 'perform public._depot_exige(); if p_user_id <> public.depot_session() and not exists (select 1 from public.users u join public.permissions pe on pe.role_id = u.role_id where u.id = public.depot_session() and pe.permission_key = ''users.manage'' and pe.allowed) then raise exception ''reserve_admin'' using errcode = ''42501''; end if;'
                  else 'perform public._depot_exige(p_user_id);' end;
    neuf := regexp_replace(def, '(\$function\$\s*(declare.*?)?\mbegin\M)', '\1 ' || appel, 'is');
    if neuf = def then raise exception 'point d''insertion introuvable dans %', f.proname; end if;
    execute neuf;
  end loop;
end $$;

-- 5. Les codes chiffrés ne sortent plus vers le téléphone
revoke select (pin_hash) on public.users from anon, authenticated;
