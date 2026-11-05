-- Weapons, bows and shields for sale at the gear merchants (prices from the
-- catalog, db/weapons-and-archery.sql; unlimited stock like the existing gear).
-- Apply together with the client release that knows these items.
with stock(merchant,item) as (values
  -- Birchford Outfitter (starter town): bronze kit, first bow, light shields
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','weapon:bronzeSword'),('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','weapon:bronzeAxe'),
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','weapon:dagger'),('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','weapon:spear'),
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','weapon:woodenBow'),
  ('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','shield:woodenShield'),('9c32d3de-8fee-4e11-af51-9bc84d7fbb46','shield:roundShield'),
  -- Winterwatch Outfitter: heavy northern arms and the longbow
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','weapon:waraxe'),('4b178de6-0fcb-47d4-9587-40cb9254745e','weapon:battleaxe'),
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','weapon:warhammer'),('4b178de6-0fcb-47d4-9587-40cb9254745e','weapon:hammer'),
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','weapon:longbow'),('4b178de6-0fcb-47d4-9587-40cb9254745e','shield:quarteredShield'),
  ('4b178de6-0fcb-47d4-9587-40cb9254745e','shield:square'),
  -- Emberspire Outfitter: great weapons and the gilded bow
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','weapon:twohand'),('f2365884-03c8-43b6-aa2d-8df745319bbe','weapon:scythe'),
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','weapon:shortsword'),('f2365884-03c8-43b6-aa2d-8df745319bbe','weapon:spear'),
  ('f2365884-03c8-43b6-aa2d-8df745319bbe','weapon:goldenBow'),('f2365884-03c8-43b6-aa2d-8df745319bbe','shield:roundShield'),
  -- Elsa the Quartermaster (castle): the finest arms
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','weapon:goldenSword'),('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','weapon:claymore'),
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','weapon:bloodthornBow'),('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','weapon:longbow'),
  ('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','shield:celticShield'),('36b9aa48-81f4-44bf-b934-dbc4ec8f1a08','shield:square'))
insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock,target_stock)
select s.merchant::uuid,s.item,(c.data->>'buy')::int,(c.data->>'sell')::int,-1,null
from stock s join eldervale_private.realm_catalog c on c.id='item:'||s.item
on conflict (merchant,item) do update set buy=excluded.buy,sell=excluded.sell,stock=-1,target_stock=null;
