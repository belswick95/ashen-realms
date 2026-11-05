-- General stores (Birchford and Emberspire) and a fisherman's hut on The Wander river,
-- each a cottage building with a merchant inside. Apply AFTER db/osrs-skills-and-food.sql
-- (it adds the Sundae, fish tiers, lobster pot and harpoon to the catalog).
-- Idempotent: each building/NPC is keyed by blueprint 'osrs-shops-v1' + blueprintKey and is
-- skipped when it already exists. Sites were chosen on walkable ground (eldervale_private.can_step
-- true at the centre and ±4–5 m around it, outside water outlines, ≥11 m from other objects;
-- the hut sits 9 m from the river shoal with its door facing the water).
-- A merchant standing inside makes the door a held-open business door (db/business-doors.sql).
do $seed$
declare rev bigint;site record;q float8;bid uuid;nid uuid;added integer:=0;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for site in select * from (values
  ('birchford-store','Birchford General Store',-234.0,100.0,0.0,1.45,8150098,12038560,
   'Hilda the Shopkeeper','Welcome to the general store!\nTools, fishing gear, supplies and a sweet treat or two.',9133659,
   '{"sundae":{"buy":12,"sell":3,"stock":-1},"bread":{"buy":14,"sell":4,"stock":40},"cheese":{"buy":12,"sell":3,"stock":30},"apple":{"buy":5,"sell":1,"stock":40},
     "weapon:bronzeAxe":{"buy":30,"sell":9,"stock":-1},"weapon:pickaxe":{"buy":45,"sell":13,"stock":-1},"fishingPole":{"buy":35,"sell":12,"stock":-1},"fishingNet":{"buy":28,"sell":9,"stock":-1},"bait":{"buy":2,"sell":1,"stock":-1},
     "lobsterPot":{"buy":40,"sell":12,"stock":-1},"harpoon":{"buy":45,"sell":14,"stock":-1},"tinderbox":{"buy":15,"sell":4,"stock":-1},"matches":{"buy":15,"sell":4,"stock":-1},"hammer":{"buy":15,"sell":4,"stock":-1},
     "chisel":{"buy":15,"sell":4,"stock":-1},"knife":{"buy":15,"sell":4,"stock":-1},"needle":{"buy":15,"sell":4,"stock":-1},"thread":{"buy":3,"sell":1,"stock":-1},"saw":{"buy":15,"sell":4,"stock":-1},
     "spade":{"buy":15,"sell":4,"stock":-1},"rake":{"buy":15,"sell":4,"stock":-1},"seedDibber":{"buy":15,"sell":4,"stock":-1},"pestle":{"buy":15,"sell":4,"stock":-1},"boxTrap":{"buy":15,"sell":4,"stock":-1},
     "vial":{"buy":3,"sell":1,"stock":-1},"water":{"buy":3,"sell":1,"stock":-1},"woodenBucket":{"buy":10,"sell":3,"stock":-1},"rope":{"buy":12,"sell":3,"stock":-1},"feathers":{"buy":2,"sell":1,"stock":-1},
     "trapBait":{"buy":3,"sell":1,"stock":-1},"wheatSeeds":{"buy":3,"sell":1,"stock":-1},"herbSeeds":{"buy":8,"sell":2,"stock":40},"candle":{"buy":6,"sell":1,"stock":-1}}'),
  ('emberspire-store','Emberspire General Store',251.8,183.5,10.0,1.3,7027250,13419700,
   'Orrin the Shopkeeper','General goods for the road and the workshop.\nIf you can carry it, I probably sell it.',8022106,
   '{"sundae":{"buy":12,"sell":3,"stock":-1},"bread":{"buy":14,"sell":4,"stock":40},"weapon:bronzeAxe":{"buy":30,"sell":9,"stock":-1},"weapon:pickaxe":{"buy":45,"sell":13,"stock":-1},
     "fishingPole":{"buy":35,"sell":12,"stock":-1},"fishingNet":{"buy":28,"sell":9,"stock":-1},"bait":{"buy":2,"sell":1,"stock":-1},"lobsterPot":{"buy":40,"sell":12,"stock":-1},"harpoon":{"buy":45,"sell":14,"stock":-1},
     "tinderbox":{"buy":15,"sell":4,"stock":-1},"hammer":{"buy":15,"sell":4,"stock":-1},"chisel":{"buy":15,"sell":4,"stock":-1},"knife":{"buy":15,"sell":4,"stock":-1},"needle":{"buy":15,"sell":4,"stock":-1},
     "thread":{"buy":3,"sell":1,"stock":-1},"pestle":{"buy":15,"sell":4,"stock":-1},"vial":{"buy":3,"sell":1,"stock":-1},"woodenBucket":{"buy":10,"sell":3,"stock":-1},"rope":{"buy":12,"sell":3,"stock":-1},
     "feathers":{"buy":2,"sell":1,"stock":-1},"candle":{"buy":6,"sell":1,"stock":-1}}'),
  ('wander-fisherman','Fisherman''s Hut',-335.4,-10.4,30.0,1.1,5462855,10057304,
   'Old Tam the Fisherman','The Wander runs rich with fish.\nNets for shrimp, bait for trout and salmon, pots for lobster, harpoons for the big ones. I''ll buy your catch too.',6519160,
   '{"fishingNet":{"buy":28,"sell":9,"stock":-1},"fishingPole":{"buy":35,"sell":12,"stock":-1},"bait":{"buy":2,"sell":1,"stock":-1},"feathers":{"buy":2,"sell":1,"stock":-1},
     "lobsterPot":{"buy":40,"sell":12,"stock":-1},"harpoon":{"buy":45,"sell":14,"stock":-1},
     "rawShrimp":{"buy":8,"sell":3,"stock":40},"shrimp":{"buy":14,"sell":4,"stock":30},"rawFish":{"buy":12,"sell":6,"stock":30},"rawTrout":{"buy":14,"sell":6,"stock":30},"trout":{"buy":24,"sell":7,"stock":25},
     "rawSalmon":{"buy":21,"sell":9,"stock":20},"salmon":{"buy":36,"sell":10,"stock":15},"rawLobster":{"buy":36,"sell":15,"stock":10},"lobster":{"buy":60,"sell":18,"stock":8},
     "rawSwordfish":{"buy":57,"sell":23,"stock":0},"rawStormfin":{"buy":96,"sell":40,"stock":0},"cookedFish":{"buy":18,"sell":5,"stock":0}}')
 ) v(k,name,x,z,yaw,scale,roof,wall,npc,dialogue,color,shop) loop
  q:=radians(site.yaw);
  if not exists(select 1 from eldervale_private.entities where not deleted and data->>'blueprint'='osrs-shops-v1' and data->>'blueprintKey'=site.k) then
   bid:=gen_random_uuid();
   insert into eldervale_private.entities(id,revision,data) values(bid,rev,jsonb_build_object('kind','object','template','cottage','room','cottage','name',site.name,'x',site.x,'z',site.z,'yaw',site.yaw,'scale',site.scale,
    'roof',site.roof,'wallColor',site.wall,'stone',false,'biome','grass','hp',1,'level',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,'blueprint','osrs-shops-v1','blueprintKey',site.k));
   added:=added+1;
  end if;
  if not exists(select 1 from eldervale_private.entities where not deleted and data->>'blueprint'='osrs-shops-v1' and data->>'blueprintKey'=site.k||'-npc') then
   nid:=gen_random_uuid();
   -- Inside, 0.6 m in front of the centre, facing the door.
   insert into eldervale_private.entities(id,revision,data) values(nid,rev,jsonb_build_object('kind','npc','template','merchant','role','merchant','name',site.npc,'dialogue',site.dialogue,
    'x',site.x+.6*sin(q),'z',site.z+.6*cos(q),'yaw',site.yaw,'scale',1,'color',site.color,'hp',45,'level',5,'damage',4,'attackSpeed',2.4,'attackType','stab','weapon','dagger',
    'roam',0,'respawn',30,'attackable',false,'hostile',false,'shop',site.shop::jsonb,'blueprint','osrs-shops-v1','blueprintKey',site.k||'-npc'));
   added:=added+1;
  end if;
 end loop;
 -- Held-open business doors (a merchant now stands inside each new building).
 update eldervale_private.realm_objects o set open=true
  where o.kind='door' and not o.open and o.id in (select id::text from eldervale_private.entities where data->>'blueprint'='osrs-shops-v1') and eldervale_private.door_held_open(o.id);
 if added=0 then update eldervale_private.settings set revision=revision-1 where id;end if;
 raise notice 'general stores and fisherman: % entities added',added;
end $seed$;

-- Sanity report: every new door is open and every merchant has its stock.
select e.data->>'blueprintKey' as key,e.data->>'name' as name,o.kind,o.open,(select count(*) from eldervale_private.shop_stock s where s.merchant=e.id::text) as stock_rows
from eldervale_private.entities e left join eldervale_private.realm_objects o on o.id=e.id::text
where e.data->>'blueprint'='osrs-shops-v1' and not e.deleted order by 1;
