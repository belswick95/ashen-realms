-- Outfit armour for sale: each gear merchant carries three themed colour sets,
-- together covering all twelve knight/noble/ranger/wizard sets. Prices come from
-- the catalog (db/outfit-catalog.sql); stock is unlimited, like the weapons.
-- Peasant clothes are not sold: everyone wears them via character creation.
-- The iron knight set uses the legacy keys helm/chest/legs/boots for its four main pieces.
with sets(merchant,outfit,variant) as (values
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','knight',1),  -- Birchford Outfitter: Iron knight
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','ranger',1),  --   Forest ranger
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','wizard',1),  --   Blue wizard
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','knight',3),  -- Winterwatch Outfitter: Blacksteel knight
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','ranger',3),  --   Hunter ranger
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','wizard',2),  --   Violet wizard
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','noble',1),   -- Emberspire Outfitter: Crimson noble
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','ranger',2),  --   Shadow ranger
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','wizard',3),  --   Crimson wizard
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','knight',2),  -- Elsa the Quartermaster: Gilded knight
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','noble',2),   --   Royal blue noble
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','noble',3)),  --   Emerald noble
items as (select data->>'key' as key,(data->>'buy')::int buy,(data->>'sell')::int sell,
   case when data->>'key' in ('helm','chest','legs','boots') then 'knight' else substring(data->>'key' from '^[a-z]+') end as outfit,
   case when data->>'key' in ('helm','chest','legs','boots') then 1 else right(data->>'key',1)::int end as variant
  from eldervale_private.realm_catalog where id like 'item:armor:%' and data->>'key'<>'cape')
insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock,target_stock)
select s.merchant::uuid,'armor:'||i.key,i.buy,i.sell,-1,null from sets s join items i on i.outfit=s.outfit and i.variant=s.variant
on conflict (merchant,item) do update set buy=excluded.buy,sell=excluded.sell,stock=-1,target_stock=null;
