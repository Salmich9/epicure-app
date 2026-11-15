-- 047 : verrou du dépôt. Jusqu'ici, la clé publique (lisible dans le code de toute page) suffisait
-- pour lire, modifier ou effacer le stock, les utilisateurs, les droits et le journal.
-- Désormais : le PIN ouvre une session (jeton envoyé dans l'en-tête x-depot-session) et la base
-- exige cette session partout. Pour l'équipe, rien ne change à l'écran.
-- Deux temps : A (sans effet sur l'appli actuelle), puis B (le verrou), une fois la nouvelle appli en ligne.

-- ===================== A. Sessions =====================
create table if not exists public.depot_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '60 days'
);
alter table public.depot_sessions enable row level security;
revoke all on public.depot_sessions from anon, authenticated;

-- Frein contre le forçage du PIN (le PIN seul identifie la personne : le frein est global)
create table if not exists public.depot_essais (
  id int primary key default 1 check (id = 1),
  rates int not null default 0,
  debut timestamptz not null default now(),
  bloque_jusqu timestamptz
);
alter table public.depot_essais enable row level security;
revoke all on public.depot_essais from anon, authenticated;
insert into public.depot_essais (id) values (1) on conflict do nothing;

-- Utilisateur de la session portée par la requête, ou null
create or replace function public.depot_session() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.user_id from public.depot_sessions s join public.users u on u.id = s.user_id and u.active
  where s.token = (select case when h ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then h::uuid end from (select current_setting('request.headers', true)::json->>'x-depot-session' h) x)
    and s.expire_le > now()
$$;

-- À appeler en tête des fonctions sensibles
create or replace function public._depot_exige(p_user_id uuid default null) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := public.depot_session();
begin
  if u is null then raise exception 'session_depot' using errcode = '42501', hint = 'Reconnecte-toi avec ton PIN.'; end if;
  if p_user_id is not null and p_user_id <> u then raise exception 'utilisateur_session' using errcode = '42501'; end if;
  return u;
end $$;

create or replace function public.depot_session_ok() returns boolean
language sql stable security definer set search_path = '' as $$ select public.depot_session() is not null $$;

create or replace function public.depot_deconnexion() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.depot_sessions where token = (select case when h ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then h::uuid end from (select current_setting('request.headers', true)::json->>'x-depot-session' h) x);
  return found;
end $$;

-- Le PIN ouvre une session ; 20 échecs en 15 minutes bloquent les essais 15 minutes.
-- Pas d'exception sur échec : elle annulerait le compteur.
create or replace function public.verify_pin(p_pin text) returns json
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare v_user record; e public.depot_essais; t uuid;
begin
  select * into e from public.depot_essais where id = 1 for update;
  if e.bloque_jusqu is not null and e.bloque_jusqu > now() then
    return json_build_object('erreur', 'bloque');
  end if;
  select u.id, u.full_name, u.role_id, r.name as role_name into v_user
  from users u join roles r on r.id = u.role_id
  where u.pin_hash = crypt(p_pin, u.pin_hash) and u.active = true
  limit 1;
  if not found then
    update public.depot_essais set
      rates = case when debut < now() - interval '15 minutes' then 1 else rates + 1 end,
      debut = case when debut < now() - interval '15 minutes' then now() else debut end,
      bloque_jusqu = case when (case when debut < now() - interval '15 minutes' then 1 else rates + 1 end) >= 20
                          then now() + interval '15 minutes' else null end
    where id = 1;
    perform pg_sleep(1);
    return null;
  end if;
  delete from public.depot_sessions where expire_le < now();
  insert into public.depot_sessions (user_id) values (v_user.id) returning token into t;
  return json_build_object('id', v_user.id, 'full_name', v_user.full_name, 'role_id', v_user.role_id,
                           'role_name', v_user.role_name, 'session', t);
end $$;

grant execute on function public.depot_session(), public.depot_session_ok(), public.depot_deconnexion(), public.verify_pin(text) to anon, authenticated;
revoke execute on function public._depot_exige(uuid) from public, anon, authenticated;
