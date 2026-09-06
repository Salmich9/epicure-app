-- =============================================================================
-- 033 — Un achat, une transaction
--
-- `createPurchase` faisait QUATRE appels non atomiques depuis le navigateur :
-- insert purchases, insert stock_movements, update last_purchase_price (dont
-- l'erreur n'etait jamais lue), rpc recalculate_average_cost (idem). Une
-- coupure reseau entre les deux derniers laissait le stock augmente et le CMP
-- inchange : la valeur du depot devenait fausse, en silence.
--
-- Tant que le module servait zero fois, c'etait theorique. L'achat devient un
-- geste quotidien depuis la page Depot : ca ne l'est plus.
--
-- TROIS POINTS STRUCTURANTS.
--
-- ORDRE. `recalculate_average_cost` fait `SUM(quantity) - p_qty_bought` : elle
-- SUPPOSE le mouvement deja inscrit. L'ordre n'est pas une affaire de style, il
-- est dans la formule. Il n'a desormais qu'un seul endroit ou etre tenu.
--
-- HORODATAGE. Le mouvement porte `created_at = now()`, jamais `p_date`.
-- `p_date` est la date de la piece — facture, bon de livraison — elle vit dans
-- `purchases` et alimente `v_achats`. Anteriorer le mouvement le ferait passer
-- AVANT la coupure du dernier inventaire, la ou le comptage l'a deja absorbe :
-- l'achat serait compte deux fois. Le journal est chronologique par saisie.
--
-- ARTICLE. La RPC peut le creer, parce que la page Catalogue disparait : plus
-- aucun ecran ne pourra reparer une fiche orpheline laissee par un achat
-- echoue. Un nom deja pris est REUTILISE, jamais duplique — la 029 a du
-- fusionner 28 categories pour 17 reelles, faute de ce garde-fou.
-- =============================================================================

create or replace function enregistrer_achat(
  p_user_id      uuid,
  p_quantity     numeric,
  p_unit_price   numeric,
  p_article_id   uuid default null,
  p_supplier_id  uuid default null,
  p_date         date default current_date,
  p_note         text default null,
  -- Creation a la volee. Ignores si p_article_id est fourni.
  p_article_nom  text default null,
  p_category_id  uuid default null,
  p_unit_id      uuid default null,
  p_article_type text default 'consommable'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid := p_article_id;
  v_cree       boolean := false;
  v_reutilise  boolean := false;
  v_purchase   purchases%rowtype;
  v_avg        numeric;
  v_qty        numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantite invalide (%) : un achat entre en stock, il est strictement positif', p_quantity
      using errcode = '22023';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Prix unitaire invalide (%)', p_unit_price using errcode = '22023';
  end if;
  if not exists (select 1 from users where id = p_user_id and active) then
    raise exception 'Utilisateur inconnu ou inactif (%)', p_user_id using errcode = '42501';
  end if;
  if p_date > current_date then
    raise exception 'Date d''achat dans le futur (%)', p_date using errcode = '22023';
  end if;

  -- 1. L'article : designe, retrouve, ou cree.
  if v_article_id is null then
    if coalesce(btrim(p_article_nom), '') = '' then
      raise exception 'Article requis : p_article_id, ou p_article_nom avec categorie et unite'
        using errcode = '22023';
    end if;

    -- Comparaison insensible a la casse et aux espaces : « Coupette »,
    -- « coupette » et « Coupette  » sont le meme article.
    select id into v_article_id
      from articles
     where lower(btrim(name)) = lower(btrim(p_article_nom))
     order by active desc, created_at
     limit 1;

    if v_article_id is null then
      if p_category_id is null or p_unit_id is null then
        raise exception 'Nouvel article « % » : categorie et unite obligatoires', p_article_nom
          using errcode = '22023';
      end if;
      insert into articles (name, category_id, unit_id, type, last_purchase_price, average_cost)
      values (btrim(p_article_nom), p_category_id, p_unit_id, p_article_type, p_unit_price, 0)
      returning id into v_article_id;
      v_cree := true;
    else
      v_reutilise := true;
    end if;

  elsif not exists (select 1 from articles where id = v_article_id) then
    raise exception 'Article introuvable (%)', v_article_id using errcode = '23503';
  end if;

  -- 2. La piece comptable.
  insert into purchases (article_id, supplier_id, quantity, unit_price, date, note, created_by)
  values (v_article_id, p_supplier_id, p_quantity, p_unit_price, p_date, p_note, p_user_id)
  returning * into v_purchase;

  -- 3. L'entree en stock, horodatee a l'enregistrement, avec son cout fige.
  insert into stock_movements (article_id, type, quantity, reference_type, reference_id,
                               note, unit_cost, cost_basis, created_by, created_at)
  values (v_article_id, 'achat', p_quantity, 'purchase', v_purchase.id,
          p_note, p_unit_price, 'achat_reel', p_user_id, now());

  -- 4. Le prix de reference, qui sert au budget des evenements.
  update articles set last_purchase_price = p_unit_price, updated_at = now()
   where id = v_article_id;

  -- 5. Le CMP — APRES le mouvement, la formule l'exige.
  v_avg := recalculate_average_cost(v_article_id, p_quantity, p_unit_price);

  select coalesce(sum(quantity), 0) into v_qty
    from stock_movements where article_id = v_article_id;

  insert into audit_log (entity, entity_id, action, actor, payload)
  values ('purchase', v_purchase.id, 'create', p_user_id,
          jsonb_build_object('article_id', v_article_id, 'article_cree', v_cree,
                             'article_reutilise', v_reutilise, 'quantity', p_quantity,
                             'unit_price', p_unit_price, 'date', p_date,
                             'supplier_id', p_supplier_id, 'average_cost', v_avg));

  return json_build_object(
    'success',           true,
    'purchase_id',       v_purchase.id,
    'article_id',        v_article_id,
    'article_cree',      v_cree,
    'article_reutilise', v_reutilise,
    'quantite_stock',    v_qty,
    'cout_moyen',        v_avg,
    'valeur_stock',      round(v_qty * v_avg, 2));
end;
$$;

comment on function enregistrer_achat is
  'Un achat en une transaction : piece, mouvement, prix de reference, CMP. '
  'Remplace les 4 appels client de createPurchase. Peut creer l article, et '
  'reutilise un nom deja present plutot que de le dupliquer.';

revoke all on function enregistrer_achat(uuid,numeric,numeric,uuid,uuid,date,text,text,uuid,uuid,text) from public;
grant execute on function enregistrer_achat(uuid,numeric,numeric,uuid,uuid,date,text,text,uuid,uuid,text) to anon, authenticated;
