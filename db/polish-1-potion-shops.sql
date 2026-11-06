-- Potion shops (polish pass). Apply after db/mechanics-ii-1-core.sql (potions in the catalog) and
-- db/bosses-4-gear.sql (the Breathward tonic). Idempotent; owner edits survive a re-run.
--
-- * Sorrel the Apothecary (Birchford, the capital) stocks every potion in the catalog, the
--   Breathward tonic included. The Winterwatch and Emberspire Provisioners gain a small
--   apothecary shelf themed on the lairs near them (frost and dragon breath in the north;
--   venom, poison and dragons in the south-east).
-- * Prices are the catalog values, in OSRS-like tiers: everyday remedies 28-40 gold, prayer and
--   stamina brews 90-180, the dragon tonic 2,400. Sell-back is the catalog's 30 %.
-- * Restock, existing style: cheap remedies are unlimited (-1, fixed price, like the healing
--   draught Sorrel already sold); the rest are finite with a baseline (shop_stock.target_stock),
--   so prices float 65-150 % with supply (merchant_quote). eldervale_private.shop_restock(), run
--   every minute by pg_cron, moves finite stock that players bought down back up toward its
--   baseline (about 5 % of the baseline per minute, at least 1). It never adds above a baseline.
-- * Items flagged shopless in the catalog (all unique gear) are never stocked here.
-- * Stock goes into each merchant's entities.data.shop, so the Game console NPC editor
--   (World > NPC > Trading) shows and edits it like any other stock. A merchant is seeded once
--   (eldervale_private.polish_seeds); after that the owner's edits are left alone on a re-run,
--   including a potion the owner removed.

create table if not exists eldervale_private.polish_seeds(
 key text primary key,
 seeded_at timestamptz not null default now()
);
revoke all on eldervale_private.polish_seeds from public,anon,authenticated;

do $potions$
declare rev bigint;spec record;e record;stock_rows jsonb;potions jsonb;merged jsonb;changed integer:=0;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for spec in select * from (values
  -- Sorrel the Apothecary, Birchford (capital): the full shelf.
  ('potion-shop:capital-apothecary','89442a02-1c15-4867-8936-9b498cbfd821',
   '{"healingPotion":-1,"briskTonic":-1,"antidote":-1,"shrineDraught":25,"windstepBrew":20,"serpentbaneTonic":15,"breathwardTonic":10}'::jsonb),
  -- Winterwatch Provisioner: frontier supplies for the Rimecoil Cavern and the Wyrmhold road.
  ('potion-shop:winterwatch-provisioner','c5d3eefa-bb92-4e53-9036-f82c7f2e7626',
   '{"healingPotion":-1,"briskTonic":-1,"antidote":-1,"windstepBrew":15,"breathwardTonic":10}'::jsonb),
  -- Emberspire Provisioner: cures and breath wards for the Cindervault and the Ashscale scar.
  ('potion-shop:emberspire-provisioner','445f771f-540c-4bd4-bef9-b77f78d38232',
   '{"healingPotion":-1,"antidote":-1,"serpentbaneTonic":15,"shrineDraught":15,"breathwardTonic":10}'::jsonb)
 ) v(key,merchant,items) loop
  if exists(select 1 from eldervale_private.polish_seeds where key=spec.key) then continue;end if;
  select * into e from eldervale_private.entities x where x.id::text=spec.merchant and not x.deleted;
  if not found then raise notice 'potion shops: merchant % not found, skipped',spec.merchant;continue;end if;
  -- Keep every row the merchant already trades (some were added straight into shop_stock), at its
  -- baseline quantity; the entity's own saved shop wins where both have an item.
  stock_rows:=coalesce((select jsonb_object_agg(s.item,jsonb_build_object('buy',s.buy,'sell',s.sell,
    'stock',(case when s.stock<0 then -1 else coalesce(s.target_stock,s.stock) end)))
   from eldervale_private.shop_stock s where s.merchant=spec.merchant),'{}'::jsonb);
  merged:=stock_rows||coalesce(e.data->'shop','{}'::jsonb);
  -- Potions at catalog prices; never a shopless item, never one the merchant already lists.
  potions:=coalesce((select jsonb_object_agg(i.key,jsonb_build_object('buy',(c.data->>'buy')::integer,
    'sell',least((c.data->>'sell')::integer,(c.data->>'buy')::integer),'stock',(i.value#>>'{}')::integer))
   from jsonb_each(spec.items) i join eldervale_private.realm_catalog c on c.id='item:'||i.key
   where not coalesce((c.data->>'shopless')::boolean,false) and not merged?i.key
    and (c.data->>'buy')::integer>0),'{}'::jsonb);
  merged:=merged||potions;
  if merged is distinct from coalesce(e.data->'shop','{}'::jsonb) then
   update eldervale_private.entities set data=data||jsonb_build_object('shop',merged),revision=rev where id=e.id;
   changed:=changed+1;
  end if;
  insert into eldervale_private.polish_seeds(key) values(spec.key) on conflict (key) do nothing;
 end loop;
 if changed=0 then update eldervale_private.settings set revision=revision-1 where id;end if;
 raise notice 'potion shops: % merchants restocked',changed;
end $potions$;

-- Timed restock toward each finite row's baseline (OSRS-style shop restock).
create or replace function eldervale_private.shop_restock() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update eldervale_private.shop_stock s
  set stock=least(s.target_stock,s.stock+greatest(1,ceil(s.target_stock/20.0)::integer))
  where s.stock>=0 and s.target_stock is not null and s.stock<s.target_stock;
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function eldervale_private.shop_restock() from public,anon,authenticated;

-- cron.schedule updates the job in place when the name already exists (pg_cron >= 1.3).
select cron.schedule('eldervale_shop_restock','* * * * *','select eldervale_private.shop_restock()');

-- Report: each potion merchant and its potion rows.
select e.data->>'name' as merchant,s.item,s.buy,s.sell,s.stock,s.target_stock
from eldervale_private.shop_stock s join eldervale_private.entities e on e.id::text=s.merchant
where s.item in ('healingPotion','briskTonic','antidote','shrineDraught','windstepBrew','serpentbaneTonic','breathwardTonic')
order by 1,2;
