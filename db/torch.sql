-- Torch: an off-hand item (shield slot) that burns while held (client: torch.js, shields.js).
-- Apply after db/osrs-equipment-combat.sql, db/general-store-and-fisherman.sql and
-- db/polish-1-potion-shops.sql. Idempotent: safe to re-run.
--
-- * Catalog: item:shield:torch (shieldsOwned, key "torch") and shield:torch (no bonuses, no level).
--   The existing equip command already accepts it: slot "shield" reads item:shield:<key> from the
--   catalog, and a two-handed weapon clears the shield slot (and the other way round), so the
--   torch is blocked by two-handers exactly like a shield. No function needs patching.
-- * Recipe make_torch (Firemaking 5, 25 XP): logs + linen cloth, with a tinderbox or matches.
--   Seeded once; an owner's later edits to the recipe are kept on a re-run.
-- * Stock: 8 gold (sells for 2), unlimited, at the Birchford and Emberspire general stores, the
--   Winterwatch and Emberspire provisioners and the chandler. Written into each merchant's
--   entities.data.shop (the NPC editor shows it) and seeded once per merchant
--   (eldervale_private.polish_seeds), so a torch the owner removes stays removed.
begin;

insert into eldervale_private.realm_catalog(id,data) values
 ('item:shield:torch','{"name":"Torch","buy":8,"sell":2,"field":"shieldsOwned","key":"torch","req":{}}'::jsonb),
 ('shield:torch','{"name":"Torch","desc":"A pitch-soaked cloth wrapped round a stick. It burns while you hold it.","kind":"shield","defence":0,"torch":true,"req":{},"bonuses":{"astab":0,"aslash":0,"acrush":0,"amagic":0,"arange":0,"dstab":0,"dslash":0,"dcrush":0,"dmagic":0,"drange":0,"str":0,"rstr":0,"mdmg":0,"prayer":0}}'::jsonb)
on conflict (id) do update set data=eldervale_private.realm_catalog.data||excluded.data;

insert into eldervale_private.skill_recipes(id,data) values
 ('make_torch','{"name":"Make a torch","skill":"firemaking","level":5,"xp":25,"inputs":{"wood":1,"linen":1},"outputs":{"shield:torch":1},"tools":["firelighter"],"station":null,"seconds":2.4,"enabled":true,"kind":"process"}'::jsonb)
on conflict (id) do nothing;

create table if not exists eldervale_private.polish_seeds(
 key text primary key,
 seeded_at timestamptz not null default now()
);
revoke all on eldervale_private.polish_seeds from public,anon,authenticated;

do $torch$
declare rev bigint;e record;stock_rows jsonb;merged jsonb;changed integer:=0;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for e in select x.* from eldervale_private.entities x
  where not x.deleted and x.data->>'kind'='npc' and x.data->>'role'='merchant'
   and ((x.data->>'blueprint'='osrs-shops-v1' and x.data->>'blueprintKey' in ('birchford-store-npc','emberspire-store-npc'))
    or x.data->>'name' ilike '%provisioner%' or x.data->>'name' ilike '%chandler%')
 loop
  if exists(select 1 from eldervale_private.polish_seeds where key='torch-stock:'||e.id::text) then continue;end if;
  -- Keep every row the merchant already trades (at its baseline); the entity's own shop wins.
  stock_rows:=coalesce((select jsonb_object_agg(s.item,jsonb_build_object('buy',s.buy,'sell',s.sell,
    'stock',(case when s.stock<0 then -1 else coalesce(s.target_stock,s.stock) end)))
   from eldervale_private.shop_stock s where s.merchant=e.id::text),'{}'::jsonb);
  merged:=stock_rows||coalesce(e.data->'shop','{}'::jsonb);
  if not merged?'shield:torch' then merged:=merged||'{"shield:torch":{"buy":8,"sell":2,"stock":-1}}'::jsonb;end if;
  if merged is distinct from coalesce(e.data->'shop','{}'::jsonb) then
   update eldervale_private.entities set data=data||jsonb_build_object('shop',merged),revision=rev where id=e.id;
   changed:=changed+1;
  end if;
  insert into eldervale_private.polish_seeds(key) values('torch-stock:'||e.id::text) on conflict (key) do nothing;
 end loop;
 if changed=0 then update eldervale_private.settings set revision=revision-1 where id;end if;
 raise notice 'torch: % merchants now stock torches',changed;
end $torch$;

-- Check: the catalog rows, the recipe and the merchants that sell torches.
select (select count(*) from eldervale_private.realm_catalog where id in ('item:shield:torch','shield:torch')) as catalog_rows,
 (select count(*) from eldervale_private.skill_recipes where id='make_torch') as recipe_rows,
 (select count(*) from eldervale_private.shop_stock where item='shield:torch') as merchants_stocking;

commit;
