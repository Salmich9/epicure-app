-- =============================================================================
-- 035 — Le journal ne se réécrit pas
--
-- ⚠️  À APPLIQUER EN DERNIER, après le déploiement du front. C'est la seule
--     migration de ce lot qui casse du code existant : `deleteWithdrawal` en
--     DELETE direct cesse de fonctionner.
--
-- `stock_movements` porte en commentaire depuis `001_schema.sql` : « registre
-- des mouvements de stock (append-only, jamais modifié ni supprimé) ». Rien ne
-- l'imposait. La policy `anon_all` est `FOR ALL ... USING(true) WITH
-- CHECK(true)`, et la clé anon est compilée en clair dans le bundle envoyé au
-- navigateur : n'importe qui pouvait vider la table depuis la console.
--
-- Tant que le dépôt était un écran de consultation, c'était supportable. Il
-- devient le chiffre de référence — « ce qui a été compté, plus ce qui a bougé
-- depuis » — et un journal qu'on peut réécrire ne prouve plus rien.
--
-- DEUX VERROUS INDÉPENDANTS.
--   1. Un trigger : aucun UPDATE, jamais. Aucun DELETE, sauf par la porte que
--      `annuler_prelevement()` ouvre le temps d'une transaction.
--   2. La RLS : `anon` lit, et n'insère que des prélèvements d'événement
--      négatifs. Un mouvement `achat` devient impossible à créer hors de
--      `enregistrer_achat()` — le stock ne peut donc plus monter sans que le
--      coût moyen suive.
--
-- POURQUOI SUPPRIMER PLUTÔT QUE COMPENSER, pour un prélèvement annulé.
-- Compenser par un `prelevement` positif ferait afficher « prélevé 10 » là où
-- il faut 0 : `v_evenements` somme des valeurs absolues. Compenser par un
-- `retour` inventerait un retour qui n'a pas eu lieu et fausserait le taux de
-- retour. Les deux obligeraient à modifier deux vues que le bot Telegram lit.
-- La suppression ne change aucune lecture en aval, et l'audit garde la ligne
-- entière avant qu'elle disparaisse.
--
-- L'asymétrie est assumée : un prélèvement saisi par erreur sur un événement
-- encore ouvert est un brouillon, pas de l'histoire. Un achat, lui, est une
-- pièce comptable — il se compense, il ne s'efface pas.
--
-- LA RÈGLE : ON NE SUPPRIME QUE DANS LA QUEUE DU JOURNAL. Un prélèvement
-- antérieur à la validation du dernier inventaire a déjà été absorbé par le
-- comptage ; le retirer ferait mentir l'inventaire. Période close.
-- =============================================================================

create or replace function stock_movements_immuable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Le journal des mouvements ne se modifie pas (mouvement %).', old.id
      using errcode = '42501',
            hint    = 'Inscrire un mouvement compensatoire, ou passer par une RPC dediee.';
  end if;

  -- Le drapeau n'existe que dans la transaction d'`annuler_prelevement`.
  if coalesce(current_setting('epicure.annulation_prelevement', true), 'off') <> 'on' then
    raise exception 'Un mouvement ne se supprime pas (mouvement %).', old.id
      using errcode = '42501',
            hint    = 'Annuler un prelevement d evenement : annuler_prelevement().';
  end if;

  return old;
end;
$$;

drop trigger if exists stock_movements_append_only on stock_movements;
create trigger stock_movements_append_only
  before update or delete on stock_movements
  for each row execute function stock_movements_immuable();


create or replace function annuler_prelevement(p_movement_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mv      stock_movements%rowtype;
  v_event   record;
  v_coupure timestamptz;
begin
  select * into v_mv from stock_movements where id = p_movement_id;
  if not found then
    raise exception 'Mouvement introuvable (%)', p_movement_id using errcode = 'P0002';
  end if;

  if v_mv.type <> 'prelevement' or v_mv.reference_type <> 'event' then
    raise exception 'Seul un prelevement d evenement s annule (type=%, rattachement=%)',
      v_mv.type, v_mv.reference_type using errcode = '42501';
  end if;

  select id, name, status into v_event from events where id = v_mv.reference_id;
  if not found then
    raise exception 'Evenement introuvable pour ce prelevement' using errcode = 'P0002';
  end if;
  if v_event.status = 'cloture' then
    raise exception 'Evenement « % » cloture : le prelevement ne s annule plus', v_event.name
      using errcode = '42501';
  end if;

  select coupure into v_coupure from v_depot_reference;
  if v_mv.created_at <= v_coupure then
    raise exception 'Prelevement anterieur a la validation du dernier inventaire (%). Periode close.',
      v_coupure using errcode = '42501',
      hint = 'Le comptage a deja absorbe ce mouvement : le retirer ferait mentir l inventaire.';
  end if;

  -- La ligne entiere part a l'audit avant de disparaitre : rien n'est perdu.
  insert into audit_log (entity, entity_id, action, actor, payload)
  values ('stock_movement', v_mv.id, 'delete', p_user_id,
          to_jsonb(v_mv) || jsonb_build_object('motif', 'annulation prelevement',
                                               'event_id', v_event.id,
                                               'event_name', v_event.name));

  perform set_config('epicure.annulation_prelevement', 'on', true);
  delete from stock_movements where id = v_mv.id;
  perform set_config('epicure.annulation_prelevement', 'off', true);

  return json_build_object('success', true, 'article_id', v_mv.article_id,
                           'quantity', v_mv.quantity, 'event_id', v_event.id);
end;
$$;

comment on function annuler_prelevement is
  'Annule un prelevement d evenement encore ouvert, posterieur au dernier '
  'inventaire valide. Seule porte de sortie du trigger d ajout seul.';

revoke all on function annuler_prelevement(uuid, uuid) from public;
grant execute on function annuler_prelevement(uuid, uuid) to anon, authenticated;


-- --- RLS ---------------------------------------------------------------------
drop policy if exists "anon_all" on stock_movements;
drop policy if exists "authenticated_all" on stock_movements;

create policy "mouvements_lecture" on stock_movements
  for select to anon, authenticated using (true);

-- Le seul écrit direct que le navigateur conserve : `addWithdrawal`. Négatif
-- obligatoirement — un « prélèvement » positif augmenterait le stock.
create policy "mouvements_prelevement" on stock_movements
  for insert to anon, authenticated
  with check (type = 'prelevement' and reference_type = 'event' and quantity < 0);

-- Le privilège lui-même est retiré, en plus des policies : une policy
-- réintroduite par erreur ne rouvrirait rien à elle seule.
revoke update, delete on stock_movements from anon, authenticated;

-- Les achats ne s'écrivent plus que par `enregistrer_achat()`.
drop policy if exists "anon_all" on purchases;
drop policy if exists "authenticated_all" on purchases;
create policy "achats_lecture" on purchases
  for select to anon, authenticated using (true);
revoke insert, update, delete on purchases from anon, authenticated;

-- Les fonctions SECURITY DEFINER (validate_inventory, validate_event_returns,
-- enregistrer_achat, annuler_prelevement) s'exécutent en `postgres`,
-- propriétaire des tables : elles contournent la RLS et ne sont pas touchées.
--
-- CE QUE CECI NE FAIT PAS. La clé anon est publique et l'app s'authentifie par
-- PIN applicatif, pas par Supabase Auth. La RLS contraint la FORME de ce qui
-- est écrit, jamais l'IDENTITÉ de qui écrit : `created_by` reste déclaratif.
-- Le cran suivant serait de passer `addWithdrawal` en RPC et de retirer tout
-- INSERT à `anon` — hors de ce lot, pour ne pas toucher au flux événement.
