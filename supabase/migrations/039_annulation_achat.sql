-- =============================================================================
-- 039 — Annuler un achat, sans réécrire le journal
--
-- Depuis la 035 le journal est en ajout seul. Une faute de frappe sur un achat
-- — un zéro de trop, un article de test — n'avait donc plus aucune issue.
--
-- L'ASYMÉTRIE AVEC LE PRÉLÈVEMENT EST VOULUE. Un prélèvement saisi par erreur
-- sur un événement encore ouvert est un brouillon : `annuler_prelevement` le
-- supprime, et aucune vue en aval ne doit le voir. Un achat est une pièce
-- comptable : il se COMPENSE. La ligne reste dans `purchases`, marquée annulée,
-- et un mouvement inverse remet le stock où il était.
--
-- LA LIMITE DU COÛT MOYEN PONDÉRÉ, ET POURQUOI ELLE BORNE CETTE FONCTION.
-- Le CMP est une moyenne mobile : il n'est exactement réversible que si aucun
-- achat postérieur n'a touché l'article. Sinon, retirer la couche du milieu
-- donnerait un chiffre qui n'a jamais existé. On refuse plutôt que d'inventer.
--
-- Même règle de période close que pour le prélèvement : un achat antérieur à
-- la validation du dernier inventaire a déjà été absorbé par le comptage.
--
-- `v_achats` est reconstruite pour ignorer les achats annulés — sans changer
-- sa liste de colonnes, donc sans toucher la table étrangère que lit le bot
-- Barometre à travers postgres_fdw.
-- =============================================================================

alter table purchases
  add column if not exists annule_at    timestamptz,
  add column if not exists annule_par   uuid references users(id),
  add column if not exists annule_motif text;

comment on column purchases.annule_at is
  'Horodatage d annulation. Une piece annulee reste une piece : la ligne ne '
  'disparait pas, elle est marquee et sort de v_achats.';


create or replace function annuler_achat(
  p_purchase_id uuid,
  p_user_id     uuid,
  p_motif       text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p       purchases%rowtype;
  v_coupure timestamptz;
  v_qty     numeric;
  v_avg     numeric;
  v_new     numeric;
begin
  select * into v_p from purchases where id = p_purchase_id;
  if not found then
    raise exception 'Achat introuvable (%)', p_purchase_id using errcode = 'P0002';
  end if;
  if v_p.annule_at is not null then
    raise exception 'Cet achat est deja annule' using errcode = '42501';
  end if;

  if exists (select 1 from purchases
              where article_id = v_p.article_id and annule_at is null
                and created_at > v_p.created_at) then
    raise exception 'Un achat plus recent existe sur cet article : le cout moyen ne peut pas etre rembobine exactement'
      using errcode = '42501',
            hint = 'Corriger par un achat rectificatif, ou revalider un inventaire.';
  end if;

  select coupure into v_coupure from v_depot_reference;
  if exists (select 1 from stock_movements
              where reference_type = 'purchase' and reference_id = v_p.id
                and created_at <= v_coupure) then
    raise exception 'Achat anterieur a la validation du dernier inventaire. Periode close.'
      using errcode = '42501',
            hint = 'Le comptage a deja absorbe cet achat : l annuler ferait mentir l inventaire.';
  end if;

  -- Le mouvement inverse. `reference_type` le distingue de l'achat d'origine,
  -- pour qu'un lecteur du journal voie une annulation et non un second achat.
  insert into stock_movements (article_id, type, quantity, reference_type, reference_id,
                               note, unit_cost, cost_basis, created_by)
  values (v_p.article_id, 'achat', -v_p.quantity, 'purchase_annulation', v_p.id,
          coalesce(p_motif, 'Annulation d achat'), v_p.unit_price, 'achat_reel', p_user_id);

  -- Retrait exact de la couche d'achat, calcule AVANT compensation :
  --     (Q x cmp − q x prix) / (Q − q)
  select coalesce(sum(quantity), 0) into v_qty
    from stock_movements
   where article_id = v_p.article_id
     and not (reference_type = 'purchase_annulation' and reference_id = v_p.id);
  select average_cost into v_avg from articles where id = v_p.article_id;

  v_new := case
    when v_qty - v_p.quantity <= 0 then 0        -- plus rien en stock : le CMP n a plus d objet
    else round(((v_qty * v_avg) - (v_p.quantity * v_p.unit_price)) / (v_qty - v_p.quantity), 4)
  end;

  update articles set average_cost = greatest(v_new, 0), updated_at = now()
   where id = v_p.article_id;

  update purchases
     set annule_at = now(), annule_par = p_user_id, annule_motif = p_motif
   where id = v_p.id;

  insert into audit_log (entity, entity_id, action, actor, payload)
  values ('purchase', v_p.id, 'cancel', p_user_id,
          to_jsonb(v_p) || jsonb_build_object('motif', p_motif,
                                              'cout_moyen_apres', greatest(v_new, 0)));

  return json_build_object('success', true, 'article_id', v_p.article_id,
                           'cout_moyen', greatest(v_new, 0));
end;
$$;

comment on function annuler_achat is
  'Annule un achat par mouvement compensatoire. Refuse si un achat plus recent '
  'a deplace le CMP, ou si un inventaire a deja absorbe celui-ci.';

revoke all on function annuler_achat(uuid, uuid, text) from public;
grant execute on function annuler_achat(uuid, uuid, text) to anon, authenticated;


-- Colonnes inchangees : la table etrangere du projet Barometre n'est pas
-- affectee par un filtre de lignes.
create or replace view v_achats as
select p.id,
       p.date                          as date_achat,
       to_char(p.date, 'YYYY-MM')      as mois,
       a.name                          as article,
       cat.name                        as categorie,
       coalesce(s.name, 'Fournisseur non renseigné') as fournisseur,
       p.quantity                      as quantite,
       p.unit_price                    as prix_unitaire,
       round(p.total_price, 2)         as total,
       p.note
from purchases p
join articles a on a.id = p.article_id
left join categories cat on cat.id = a.category_id
left join suppliers s on s.id = p.supplier_id
where p.annule_at is null;

comment on view v_achats is
  'Les achats qui tiennent. Un achat annule reste dans `purchases` mais sort '
  'd ici : le bot ne doit pas le compter dans « qu a-t-on achete ce mois-ci ».';
