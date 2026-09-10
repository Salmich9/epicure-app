-- =============================================================================
-- 042 — Pourquoi l'article n'est pas revenu
--
-- Jusqu'ici un écart d'événement est un nombre sans cause. « Il manque 3
-- coupettes » ne dit pas si elles sont cassées, oubliées sur place, ou bues.
-- Les trois appellent des décisions opposées : racheter, aller les chercher,
-- ou ne rien faire parce que c'était prévu.
--
-- L'ÉCART N'EST MATÉRIALISÉ NULLE PART. C'est le point qui impose une table
-- plutôt qu'une colonne. `validate_event_returns` n'insère une ligne que
-- `IF v_returned > 0` : un article prélevé et jamais rendu ne produit AUCUN
-- mouvement de retour. Il n'existe donc pas de ligne où poser un motif —
-- précisément dans le cas qui en a le plus besoin.
--
-- L'écart se lit par différence entre `prelevement` et `retour` dans
-- `v_evenements_articles`. Le motif est une donnée à part, portée par
-- (événement, article), et rien d'autre ne peut l'héberger.
--
-- DEUX TABLES.
--   `motifs_ecart`   — le référentiel, modifiable depuis Paramètres.
--   `ecarts_motifs`  — la liaison (événement, article) → motif.
--
-- POURQUOI L'UNICITÉ PORTE SUR LE TRIPLET et non sur (event, article).
-- L'écran n'expose qu'un motif par article — c'est la demande. Mais une caisse
-- de 12 verres peut très bien revenir avec 3 cassés et 2 oubliés, et le jour où
-- ça se saisit, la contrainte serrée obligerait à une migration sur une table
-- déjà pleine. Le triplet coûte zéro aujourd'hui et laisse la porte ouverte.
-- L'unicité côté écran est tenue par la RPC, qui remplace au lieu d'ajouter.
--
-- `perte_reelle` — un consommable qui ne revient pas n'est pas une perte, c'est
-- sa destination. La 026 et la 027 posent déjà cette distinction sur `type`.
-- Le motif « Consommée » la porte au niveau du motif, pour le cas d'un article
-- retournable légitimement consommé.
-- =============================================================================

begin;

-- --- Le référentiel ----------------------------------------------------------
create table if not exists motifs_ecart (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  perte_reelle boolean not null default true,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table motifs_ecart is
  'Referentiel des causes d ecart d evenement. `perte_reelle` a faux pour une '
  'sortie normale (consommation), qui ne doit pas gonfler les statistiques de '
  'casse.';

-- L'index d'unicité est posé LE PREMIER JOUR. `categories` ne l'a jamais eu et
-- a fini à 28 lignes pour 17 familles réelles ; la 029 a dû faire le ménage.
-- Non partiel, contrairement à la 038 sur les articles : un motif ne porte pas
-- d'histoire, un doublon désactivé n'est que du bruit dans une liste.
create unique index if not exists motifs_ecart_name_key
  on motifs_ecart (lower(btrim(name)));

drop trigger if exists motifs_ecart_updated_at on motifs_ecart;
create trigger motifs_ecart_updated_at
  before update on motifs_ecart
  for each row execute function set_updated_at();


-- --- La liaison --------------------------------------------------------------
create table if not exists ecarts_motifs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id)       on delete cascade,
  article_id uuid not null references articles(id)     on delete cascade,
  motif_id   uuid not null references motifs_ecart(id) on delete restrict,
  quantite   numeric,
  note       text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table ecarts_motifs is
  'Pourquoi un article n est pas revenu d un evenement. `quantite` est '
  'indicative : l ecart qui fait foi se lit dans v_evenements_articles.';

-- `on delete cascade` vers events et articles, `restrict` vers le motif : un
-- événement supprimé emporte ses explications, un motif encore utilisé ne se
-- supprime pas en silence. Paramètres le désactivera plutôt.
create unique index if not exists ecarts_motifs_triplet_key
  on ecarts_motifs (event_id, article_id, motif_id);

create index if not exists ecarts_motifs_event_idx on ecarts_motifs (event_id);

drop trigger if exists ecarts_motifs_updated_at on ecarts_motifs;
create trigger ecarts_motifs_updated_at
  before update on ecarts_motifs
  for each row execute function set_updated_at();


-- --- Le seed -----------------------------------------------------------------
-- `on conflict do nothing` sur l'index d'unicité : la migration se rejoue sans
-- fabriquer de doublons. C'est exactement ce qui a manqué au seed des unités,
-- que la 043 va devoir nettoyer.
insert into motifs_ecart (name, perte_reelle, sort_order) values
  ('Consommée',          false, 10),
  ('Casse',              true,  20),
  ('Oublié sur place',   true,  30),
  ('Vol',                true,  40),
  ('Détérioré',          true,  50),
  ('Non retrouvé',       true,  60),
  ('Pas d''explication', true,  99)
on conflict do nothing;


-- --- RLS ---------------------------------------------------------------------
alter table motifs_ecart  enable row level security;
alter table ecarts_motifs enable row level security;

-- Le référentiel se gère depuis Paramètres, comme les unités et les catégories :
-- écriture directe assumée, au même niveau de confiance que le reste de l'app.
create policy "motifs_lecture"  on motifs_ecart
  for select to anon, authenticated using (true);
create policy "motifs_ecriture" on motifs_ecart
  for all to anon, authenticated using (true) with check (true);

-- La liaison, elle, ne s'écrit que par RPC. Un motif posé à la main sur un
-- article sans écart raconterait une histoire que le journal contredit.
create policy "ecarts_motifs_lecture" on ecarts_motifs
  for select to anon, authenticated using (true);

-- Supabase pose `grant all to anon` sur toute table neuve. Le revoke n'est pas
-- redondant avec l'absence de policy : une policy réintroduite par erreur ne
-- rouvrirait rien à elle seule. C'est la leçon de la 035.
revoke insert, update, delete on ecarts_motifs from anon, authenticated;


-- --- La saisie, à la clôture -------------------------------------------------
-- SIGNATURE INCHANGÉE. `p_returns` est un jsonb sans schéma : une clé `motif_id`
-- de plus est absorbée sans qu'aucun appelant existant ne casse. Le front qui
-- ne l'envoie pas continue de fonctionner à l'identique.
--
-- ET LA VALORISATION PASSE AU COÛT MOYEN. La 027 a tranché avec une mesure :
-- `last_purchase_price` surévaluait le dépôt de 24 %. Cette fonction est restée
-- sur l'ancien prix, si bien que le même événement affichait un montant ici et
-- un autre dans `v_evenements`. Un écart, c'est du stock qui sort : il vaut ce
-- que le dépôt dit qu'il vaut.
create or replace function validate_event_returns(
  p_event_id uuid,
  p_user_id  uuid,
  p_returns  jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item        jsonb;
  v_article_id  uuid;
  v_returned    numeric;
  v_ecart       numeric;
  v_motif_id    uuid;
  v_ecart_value numeric := 0;
begin
  if not exists (select 1 from events where id = p_event_id and status <> 'cloture') then
    raise exception 'Événement introuvable ou déjà clôturé';
  end if;

  for v_item in select * from jsonb_array_elements(p_returns)
  loop
    v_article_id := (v_item->>'article_id')::uuid;
    v_returned   := coalesce((v_item->>'returned_qty')::numeric, 0);
    v_ecart      := coalesce((v_item->>'ecart')::numeric, 0);
    -- `nullif('')` : un <select> vide envoie une chaîne vide, pas null.
    v_motif_id   := nullif(v_item->>'motif_id', '')::uuid;

    -- Retour : ramène les articles dans le stock.
    if v_returned > 0 then
      insert into stock_movements (
        id, article_id, type, quantity,
        reference_type, reference_id, note, created_by, created_at
      ) values (
        gen_random_uuid(), v_article_id, 'retour', v_returned,
        'event', p_event_id, null, p_user_id, now()
      );
    end if;

    -- NOTE : pas de mouvement 'perte' — l'écart est déjà capturé par la
    -- différence entre le prélèvement (-qty) et le retour (+returned).
    -- Insérer une perte en plus causerait un double comptage.

    if v_ecart > 0 then
      select v_ecart_value + v_ecart * coalesce(average_cost, 0)
        into v_ecart_value
      from articles where id = v_article_id;

      -- Le motif ne s'enregistre QUE s'il y a un écart. Un motif sans écart
      -- serait une explication pour un fait qui n'a pas eu lieu.
      if v_motif_id is not null then
        insert into ecarts_motifs (event_id, article_id, motif_id, quantite, created_by)
        values (p_event_id, v_article_id, v_motif_id, v_ecart, p_user_id)
        on conflict (event_id, article_id, motif_id)
        do update set quantite = excluded.quantite, updated_at = now();
      end if;
    end if;
  end loop;

  update events
    set status = 'cloture', updated_at = now()
  where id = p_event_id;

  insert into audit_log (id, entity, entity_id, action, actor, payload, created_at)
  values (
    gen_random_uuid(), 'event', p_event_id, 'returns_validated',
    p_user_id,
    p_returns || jsonb_build_object('ecart_value_mad', v_ecart_value),
    now()
  );

  return json_build_object('success', true, 'ecart_value', v_ecart_value);
end;
$$;


-- --- La correction, après clôture --------------------------------------------
-- UNE RPC DISTINCTE, ET C'EST VOULU. `validate_event_returns` refuse à bon
-- droit un second passage : le rejouer réinsérerait les mouvements de retour et
-- doublerait le stock. Rouvrir cette porte pour corriger une étiquette serait
-- disproportionné.
--
-- Celle-ci n'écrit que dans `ecarts_motifs` et `audit_log`. Elle n'a pas les
-- instructions pour toucher au stock — ce n'est pas une consigne qu'on lui
-- donne, c'est une capacité qu'elle n'a pas.
create or replace function corriger_motif_ecart(
  p_event_id   uuid,
  p_article_id uuid,
  p_motif_id   uuid,
  p_user_id    uuid,
  p_note       text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ecart   numeric;
  v_article text;
  v_avant   jsonb;
begin
  select name into v_article from articles where id = p_article_id;
  if not found then
    raise exception 'Article introuvable (%)', p_article_id using errcode = 'P0002';
  end if;

  -- L'écart se RECALCULE depuis le journal. Le croire sur parole permettrait
  -- de poser un motif sur un article qui est intégralement revenu.
  select coalesce(sum(case when sm.type = 'prelevement' then abs(sm.quantity) else 0 end), 0)
       - coalesce(sum(case when sm.type = 'retour'      then sm.quantity      else 0 end), 0)
    into v_ecart
  from stock_movements sm
  where sm.reference_type = 'event'
    and sm.reference_id   = p_event_id
    and sm.article_id     = p_article_id
    and sm.type in ('prelevement', 'retour');

  if coalesce(v_ecart, 0) <= 0 then
    raise exception 'Aucun ecart sur « % » pour cet evenement : rien a expliquer.', v_article
      using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object('motif_id', motif_id, 'quantite', quantite))
    into v_avant
  from ecarts_motifs
  where event_id = p_event_id and article_id = p_article_id;

  -- « Un seul motif par article » est tenu ICI, pas par le schéma : on efface
  -- les autres avant d'écrire. Le jour où l'écran en accepte plusieurs, cette
  -- ligne saute et la table suit sans migration.
  delete from ecarts_motifs
  where event_id = p_event_id and article_id = p_article_id
    and (p_motif_id is null or motif_id <> p_motif_id);

  if p_motif_id is not null then
    insert into ecarts_motifs (event_id, article_id, motif_id, quantite, note, created_by)
    values (p_event_id, p_article_id, p_motif_id, v_ecart, p_note, p_user_id)
    on conflict (event_id, article_id, motif_id)
    do update set quantite = excluded.quantite,
                  note     = excluded.note,
                  updated_at = now();
  end if;

  insert into audit_log (entity, entity_id, action, actor, payload)
  values ('event', p_event_id, 'motif_ecart_corrige', p_user_id,
          jsonb_build_object('article_id', p_article_id,
                             'article',    v_article,
                             'ecart',      v_ecart,
                             'avant',      v_avant,
                             'motif_id',   p_motif_id,
                             'note',       p_note));

  return json_build_object('success', true, 'ecart', v_ecart);
end;
$$;

comment on function corriger_motif_ecart is
  'Change le motif d un ecart apres cloture. N ecrit que dans ecarts_motifs et '
  'audit_log : les quantites et le stock sont hors de portee.';

revoke all on function corriger_motif_ecart(uuid, uuid, uuid, uuid, text) from public;
grant execute on function corriger_motif_ecart(uuid, uuid, uuid, uuid, text)
  to anon, authenticated;

commit;

-- --- Contrôles, à relire après application -----------------------------------
--
--   select count(*) from motifs_ecart;                       -- 7
--   select relrowsecurity from pg_class
--    where relname in ('motifs_ecart','ecarts_motifs');       -- t, t
--
-- Un INSERT direct depuis le navigateur doit être refusé :
--   insert into ecarts_motifs (event_id, article_id, motif_id) values (…);
--                                                             -- 42501
--
-- Et un motif sur un article sans écart :
--   select corriger_motif_ecart(<event>, <article intégralement rendu>, …);
--                                                             -- 42501
