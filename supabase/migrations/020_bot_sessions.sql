-- =============================================================================
-- 020 — Etat de conversation du bot evenement
--
-- Purement additif : aucune table existante n'est touchee.
--
-- L'etat vit ici et nulle part ailleurs. Le process du bot ne garde rien en
-- memoire : on peut le tuer au milieu d'un brief de quarante minutes, il reprend
-- a la meme question. C'est l'exigence SS6 du brief.
-- =============================================================================

create table if not exists bot_sessions (
  id                     uuid primary key default gen_random_uuid(),

  -- Un utilisateur Telegram n'est pas un utilisateur Supabase. On garde son id
  -- Telegram comme cle d'entree, et on le relie a users quand il est reconnu.
  telegram_user_id       bigint      not null unique,
  user_id                uuid        references users(id),
  role                   text        not null default 'responsable_evenement',

  event_id               uuid        references events(id) on delete set null,

  -- Position dans le questionnaire
  questionnaire_version  text,
  module                 text,
  question_key           text,
  loop_context           jsonb,
  pending_computed       text,

  -- Reponses accumulees. jsonb et non une table par reponse : tant que le brief
  -- est en cours, c'est un brouillon. Les reponses ne deviennent des lignes
  -- metier qu'a la cloture (phase 3).
  answers                jsonb       not null default '{}'::jsonb,

  status                 text        not null default 'active'
                                     check (status in ('active','paused','done','abandoned')),

  -- Telegram redelivre les updates non acquittes. On memorise le dernier vu
  -- pour ne pas rejouer deux fois la meme reponse.
  last_update_id         bigint,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_bot_sessions_status  on bot_sessions(status);
create index if not exists idx_bot_sessions_event   on bot_sessions(event_id);

drop trigger if exists trg_bot_sessions_updated_at on bot_sessions;
create trigger trg_bot_sessions_updated_at
  before update on bot_sessions
  for each row execute function set_updated_at();

-- RLS active, AUCUNE policy : la table est donc inaccessible via les cles anon
-- et authenticated, et lisible uniquement en service_role (qui contourne le RLS).
--
-- C'est deliberement l'inverse du reste du schema Epicure, ou toutes les policies
-- sont USING(true) pour anon. Une session porte le brief complet d'un evenement,
-- client et montants compris : elle n'a rien a faire dans une PWA cote navigateur.
alter table bot_sessions enable row level security;

comment on table bot_sessions is
  'Etat de conversation du bot evenement. Service_role uniquement — aucune policy RLS, donc inaccessible depuis le client web.';
