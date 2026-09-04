-- =============================================================================
-- 023 — Les deux rôles du bot, et qui est qui sur Telegram
--
-- Purement additif.
--
-- Un utilisateur Telegram n'est pas un utilisateur Supabase : il n'a ni session
-- auth ni JWT. `bot_users` fait le pont, et c'est le seul endroit où un id
-- Telegram devient une identité Epicure.
--
-- ⚠️ À lire avant de s'appuyer sur ces permissions.
-- Les 31 policies RLS d'Epicure sont toutes `USING (true)` pour `anon`, et la
-- fonction `actor_has_permission()` n'est pas déployée en production. Les lignes
-- de `permissions` sont donc un **catalogue**, pas un garde-fou : rien ne les
-- applique côté serveur.
--
-- Le cloisonnement du préparateur — « ne voit ni le client, ni les montants » —
-- est par conséquent tenu **dans le bot**, qui devient la frontière de confiance.
-- C'est pour ça que le bot refuse de démarrer avec une clé anon. Ces lignes
-- servent à déclarer l'intention et à préparer le jour où le RLS sera réparé ;
-- elles ne la garantissent pas aujourd'hui.
-- =============================================================================

create table if not exists bot_users (
  telegram_user_id bigint      primary key,
  user_id          uuid        references users(id),
  role             text        not null
                   check (role in ('responsable_evenement','preparateur')),
  display_name     text,
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_bot_users_role on bot_users(role) where active;

drop trigger if exists trg_bot_users_updated_at on bot_users;
create trigger trg_bot_users_updated_at
  before update on bot_users
  for each row execute function set_updated_at();

-- Aucune policy : service_role uniquement. Savoir qui a le droit de quoi n'a
-- rien à faire dans un navigateur.
alter table bot_users enable row level security;

comment on table bot_users is
  'Pont entre un id Telegram et une identite Epicure. Service_role uniquement.';


-- ---------------------------------------------------------------------------
-- Les deux rôles du brief (§8), ajoutés au catalogue existant
-- ---------------------------------------------------------------------------

insert into roles (name, is_system)
select v.name, true
from (values ('responsable_evenement'), ('preparateur')) as v(name)
where not exists (select 1 from roles r where r.name = v.name);


-- Responsable événement : il briefe, il arbitre, il voit tout.
insert into permissions (role_id, permission_key, allowed)
select r.id, k.cle, true
from roles r
cross join (values
  ('event.brief'), ('event.prepare'),
  ('event.view_brief'), ('event.view_client'), ('event.view_amounts'),
  ('events.read'), ('events.create'), ('events.manage'), ('depot.read')
) as k(cle)
where r.name = 'responsable_evenement'
  and not exists (
    select 1 from permissions p
     where p.role_id = r.id and p.permission_key = k.cle
  );

-- Préparateur : une seule clé. Tout le reste lui est fermé, y compris en
-- lecture — c'est la définition même du cloisonnement demandé.
insert into permissions (role_id, permission_key, allowed)
select r.id, 'event.prepare', true
from roles r
where r.name = 'preparateur'
  and not exists (
    select 1 from permissions p
     where p.role_id = r.id and p.permission_key = 'event.prepare'
  );
