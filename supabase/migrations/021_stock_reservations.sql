-- =============================================================================
-- 021 — Réserves de stock pour les événements
--
-- Purement additif : aucune table existante n'est touchée.
--
-- Une ligne = un article engagé sur un événement. C'est la pièce qui manquait
-- pour que « disponible » veuille dire quelque chose : sans elle, deux
-- événements peuvent engager les mêmes 122 verres sans que rien ne le signale.
--
-- MONO-DÉPÔT : pas de `depot_id`. Epicure n'a aucune notion de dépôt (le stock
-- est un pool global, `current_stock` somme tous les mouvements sans filtre).
-- Décision assumée pour la v1.
-- =============================================================================

create table if not exists stock_reservations (
  id          uuid primary key default gen_random_uuid(),

  event_id    uuid    not null references events(id)   on delete cascade,
  article_id  uuid    not null references articles(id),
  quantity    numeric not null check (quantity > 0),

  -- Les six paniers du brief. Seuls `prelevement` et `achat` sont réellement
  -- branchés en v1 : les quatre autres existent ici pour ne pas avoir à migrer
  -- la table quand ils arriveront, mais le bot refuse de les écrire.
  flow_type   text    not null default 'prelevement'
              check (flow_type in ('prelevement','achat','location',
                                   'production','fabrication','chargement')),

  -- Copiée d'`articles.type` au moment de la réserve, et non lue à la volée :
  -- si quelqu'un reclasse un article plus tard, les réserves déjà posées ne
  -- doivent pas changer de nature dans le dos de l'événement.
  --   retournable -> réserve datée, elle bloque puis libère
  --   consommable -> réserve définitive, elle décrémente et ne revient pas
  nature      text    not null
              check (nature in ('retournable','consommable')),

  -- provisoire ──> confirmee ──> chargee ──> retournee   (retournable)
  --     │                              └──> consommee    (consommable)
  --     └──> expiree (48 h)        annulee (à tout moment)
  status      text    not null default 'provisoire'
              check (status in ('provisoire','confirmee','chargee',
                                'retournee','consommee','expiree','annulee')),

  starts_at   date    not null,
  ends_at     date    not null,

  -- L'état « provisoire » est le plus important des sept. Sans expiration, un
  -- questionnaire commencé un vendredi soir et abandonné gèle 122 verres pour
  -- toujours. C'est la logique du panier d'un site marchand.
  expires_at  timestamptz,

  -- Renseignées à l'attestation de chargement (J−1) puis au retour (J+1).
  quantity_loaded   numeric,
  quantity_returned numeric,
  quantity_broken   numeric,

  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint stock_reservations_dates_coherentes check (ends_at >= starts_at),
  constraint stock_reservations_expiration_provisoire
    check (status <> 'provisoire' or expires_at is not null)
);

-- La requête chaude : « qui engage cet article, à cette date ? »
create index if not exists idx_reservations_article_dates
  on stock_reservations (article_id, starts_at, ends_at)
  where status in ('provisoire','confirmee','chargee');

create index if not exists idx_reservations_event   on stock_reservations (event_id);
create index if not exists idx_reservations_expires on stock_reservations (expires_at)
  where status = 'provisoire';

-- Un même article ne peut être engagé qu'une fois par flux et par événement.
-- Sans ça, relancer un brief doublerait les réserves en silence.
create unique index if not exists idx_reservations_unicite
  on stock_reservations (event_id, article_id, flow_type)
  where status not in ('annulee','expiree');

drop trigger if exists trg_stock_reservations_updated_at on stock_reservations;
create trigger trg_stock_reservations_updated_at
  before update on stock_reservations
  for each row execute function set_updated_at();

-- RLS activé, aucune policy : service_role uniquement, comme bot_sessions.
-- Une réserve engage du stock ; elle ne s'écrit pas depuis un navigateur.
alter table stock_reservations enable row level security;

comment on table stock_reservations is
  'Articles engages sur un evenement. Mono-depot en v1. Service_role uniquement.';
comment on column stock_reservations.nature is
  'Copie de articles.type au moment de la reserve, volontairement figee.';
