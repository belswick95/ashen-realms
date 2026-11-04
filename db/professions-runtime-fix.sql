create or replace function eldervale_private.skill_error(uid uuid,r jsonb,target_id text,drop_id uuid default null) returns text language plpgsql set search_path='' as $$
declare p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;d eldervale_private.ground_drops;k text;v jsonb;xp integer;level integer;station text;kind text;f eldervale_private.skill_fires;
begin
 select * into p from eldervale_private.realm_players where user_id=uid;select * into s from public.player_saves where user_id=uid;
 if p.user_id is null or p.last_seen<clock_timestamp()-interval '15 seconds' or s.health<=0 then return 'Activity stopped: reconnect to the world.';end if;
 if exists(select 1 from eldervale_private.moderation where user_id=uid and (banned_until>clock_timestamp() or kicked_at>p.last_seen)) then return 'Activity stopped.';end if;
 if exists(select 1 from eldervale_private.realm_actors where target=uid and hp>0 and not deleted) then return 'Finish combat before skilling.';end if;
 if not coalesce((r->>'enabled')::boolean,false) then return 'This recipe is disabled.';end if;
 xp:=coalesce((case when r->>'skill'='mining' then s.stats->>'miningXP' when r->>'skill'='woodcutting' then s.stats->>'woodXP' else s.skills->>((r->>'skill')||'XP') end)::integer,0);level:=least(100,1+floor(sqrt(xp/50.0))::integer);
 if level<(r->>'level')::integer then return 'You need '||(r->>'skill')||' level '||(r->>'level')||'.';end if;
 for k in select jsonb_array_elements_text(r->'tools') loop if not eldervale_private.skill_tool(uid,k) then return 'Required tool: '||k||'.';end if;end loop;
 kind:=r->>'kind';station:=r->>'station';
 if drop_id is not null then
  select * into d from eldervale_private.ground_drops where id=drop_id;
  if kind<>'fire' or d.id is null or d.expires_at<=clock_timestamp() or not((r->'inputs')?d.item) or d.amount<1 then return 'Those dropped logs are no longer available.';end if;
  if sqrt(power(d.x-p.x,2)+power(d.z-p.z,2))>3 then return 'Move within reach of the dropped logs.';end if;
 else
  for k,v in select key,value from jsonb_each(r->'inputs') loop if coalesce(eldervale_private.item_quantity(uid,k),0)<v::integer then return 'Not enough '||k||'.';end if;end loop;
 end if;
 if station is not null then
  if station='cooking' and target_id like 'fire:%' then
   select * into f from eldervale_private.skill_fires where id=substring(target_id from 6)::uuid and expires_at>clock_timestamp();
   if f.id is null or sqrt(power(f.x-p.x,2)+power(f.z-p.z,2))>4 then return 'Move closer to a burning fire.';end if;
  else
   select * into o from eldervale_private.realm_objects where id=target_id;
   if o.id is null then return 'Choose a nearby station in the world.';end if;
   if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>4 then return 'Move closer to the station.';end if;
   if not(case station when 'mining_rock' then o.kind='rock' and coalesce(o.data->>'resource','ore')=r->>'resource' when 'cooking' then coalesce(o.data->>'template',o.data->>'type') in('hearth','campfire') when 'water' then coalesce(o.data->>'template',o.data->>'type') in('well','fountain') else coalesce(o.data->>'template',o.data->>'type')=station end) then return 'This is the wrong station.';end if;
   if kind='mine' and o.available_at>clock_timestamp() then return 'This resource is depleted. It will replenish shortly.';end if;
   if kind='plant' and exists(select 1 from eldervale_private.skill_crops where target=target_id) then return 'This patch already contains a crop.';end if;
   if kind='build' and coalesce((o.data->>'built')::boolean,false) then return 'This site is already built. The owner can reset or place another site.';end if;
  end if;
 end if;
 if kind='fire' then
  if drop_id is null then d.x:=p.x;d.z:=p.z;end if;
  if not eldervale_private.can_step(d.x,d.z,d.x,d.z) or exists(select 1 from eldervale_private.realm_objects b where b.kind='door' and sqrt(power(b.x-d.x,2)+power(b.z-d.z,2))<8*coalesce((b.data->>'scale')::float8,1)) then return 'Light fires on clear ground outside buildings.';end if;
  if exists(select 1 from eldervale_private.skill_fires where expires_at>clock_timestamp() and sqrt(power(x-d.x,2)+power(z-d.z,2))<1.5) then return 'There is already a fire here.';end if;
 end if;
 return null;
end $$;
create or replace function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;item text;n integer;c jsonb;r jsonb;k text;v jsonb;old jsonb;id text;station text;
begin
 if command='setskill' and coalesce(payload->>'skill','') not in('miningXP','woodXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') then return eldervale_private.admin_before_professions(command,payload);end if;
 if command not in('give','catalog_recipe','reset_build','setskill') then return eldervale_private.admin_before_professions(command,payload);end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>8192 then raise exception 'Invalid owner request';end if;
 perform pg_advisory_xact_lock(736211);
 if command='setskill' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());k:=payload->>'skill';n:=(payload->>'level')::integer;
  if k not in('attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','miningXP','woodXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') or n not between 1 and 100 then raise exception 'Choose a skill and a level from 1 to 100';end if;
  if not exists(select 1 from public.player_saves where user_id=uid) then raise exception 'Player has no character';end if;
  if k in('miningXP','woodXP') then update public.player_saves set stats=stats||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;else update public.player_saves set skills=skills||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;end if;r:=jsonb_build_object('skill',k,'level',n,'userId',uid);
 elsif command='give' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());item:=payload->>'item';n:=coalesce((payload->>'amount')::integer,1);
  if n not between 1 and 1000000 then raise exception 'Quantity must be 1–1,000,000';end if;
  if not exists(select 1 from public.player_saves where user_id=uid) then raise exception 'Player has no character';end if;
  if item<>'gold' then
   select data into c from eldervale_private.realm_catalog where realm_catalog.id='item:'||item;if c is null then raise exception 'Unknown item';end if;
   if c?'field' and n<>1 then raise exception 'Grant equipment one at a time; bank storage can hold additional copies';end if;
   if coalesce((c->>'unique')::boolean,false) and (n<>1 or coalesce(eldervale_private.item_quantity(uid,item),0)>0) and coalesce(payload->>'destination','inventory')<>'bank' then raise exception 'You already carry this tool';end if;
  end if;
  if coalesce(payload->>'destination','inventory') not in('inventory','bank') then raise exception 'Choose inventory or bank';end if;
  perform eldervale_private.item_change(uid,item,n,coalesce(payload->>'destination','inventory')='bank');
  if coalesce(payload->>'destination','inventory')='inventory' and eldervale_private.inventory_used(uid)>16 then raise exception 'Inventory full. Free slots, reduce the quantity, or explicitly choose Send to bank.';end if;
  r:=jsonb_build_object('item',item,'amount',n,'destination',coalesce(payload->>'destination','inventory'),'userId',uid);
 elsif command='reset_build' then
  id:=payload->>'id';if not exists(select 1 from eldervale_private.entities where entities.id::text=id and data->>'template'='construction_site' and not deleted) then raise exception 'Choose a construction site';end if;
  update eldervale_private.settings set revision=revision+1 where settings.id;
  update eldervale_private.entities set data=data||'{"built":false}',revision=(select revision from eldervale_private.settings where settings.id) where entities.id::text=id returning data into r;
 else
  id:=payload->>'id';r:=payload->'recipe';
  if id is null or id!~'^[a-z][A-Za-z0-9_]{1,60}$' or r is null or jsonb_typeof(r)<>'object' then raise exception 'Choose a recipe ID and definition';end if;
  if coalesce(r->>'skill','') not in('mining','woodcutting','fishing','firemaking','smithing','cooking','crafting','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving') or length(coalesce(r->>'name','')) not between 2 and 80 or coalesce((r->>'level')::integer,0) not between 1 and 100 or coalesce((r->>'xp')::integer,-1) not between 0 and 10000 or coalesce((r->>'seconds')::numeric,0) not between .6 and 30 then raise exception 'Check skill, name, level (1–100), XP (0–10,000), time (0.6–30s)';end if;
  select data into old from eldervale_private.skill_recipes where skill_recipes.id=id;
  if old is null and (select count(*) from eldervale_private.skill_recipes)>=500 then raise exception 'Recipe catalog limit reached';end if;
  station:=r->>'station';if station is not null and station not in('mining_rock','furnace','anvil','cooking','mill','workbench','spinning_wheel','tanning_rack','rune_altar','farming_patch','hunting_ground','agility_log','thieving_stall','practice_chest','water','herb_patch','flax_patch','wheat_patch','berry_bush','essence_rock') then raise exception 'Unknown station';end if;
  if jsonb_typeof(r->'inputs') is distinct from 'object' or jsonb_typeof(r->'outputs') is distinct from 'object' or jsonb_typeof(r->'tools') is distinct from 'array' then raise exception 'Choose materials, products and tools';end if;
  if (select count(*) from jsonb_each(r->'inputs'))>8 or (select count(*) from jsonb_each(r->'outputs'))>8 or jsonb_array_length(r->'tools')>5 then raise exception 'Use up to 8 materials, 8 products and 5 tools';end if;
  for k,v in select key,value from jsonb_each((r->'inputs')||(r->'outputs')) loop
   if (k<>'gold' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k)) or jsonb_typeof(v)<>'number' or v::numeric not between 1 and 1000 or v::numeric<>trunc(v::numeric) then raise exception 'Invalid item or quantity: %',k;end if;
  end loop;
  for k in select jsonb_array_elements_text(r->'tools') loop if k<>'firelighter' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k) then raise exception 'Unknown tool: %',k;end if;end loop;
  -- Owners can tune built-in special actions; custom recipes use the safe item-processing engine.
  r:=coalesce(old,'{}')||jsonb_build_object('name',r->>'name','skill',r->>'skill','level',(r->>'level')::integer,'xp',(r->>'xp')::integer,'seconds',(r->>'seconds')::float8,'station',station,'inputs',r->'inputs','outputs',r->'outputs','tools',r->'tools','enabled',coalesce((r->>'enabled')::boolean,true),'kind',coalesce(old->>'kind','process'));
  insert into eldervale_private.skill_recipes(id,data) values(id,r) on conflict on constraint skill_recipes_pkey do update set data=excluded.data;
  update eldervale_private.settings set revision=revision+1 where settings.id;
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(uid::text,id),old,r);
 return r;
end $$;
-- Owner-placed world items are collected atomically into carried inventory.
-- The public entry point and its established authentication remain unchanged.
create or replace function eldervale_private.pickup(entity_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e eldervale_private.entities;p eldervale_private.realm_players;n integer;rev bigint;
begin
 if not eldervale_private.allowed() or exists(select 1 from eldervale_private.settings where maintenance and not eldervale_private.is_owner()) then raise exception 'Access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() for update;
 if not found or p.last_seen<clock_timestamp()-interval '15 seconds' then raise exception 'Reconnect to the shared world';end if;
 if exists(select 1 from eldervale_private.moderation where user_id=auth.uid() and (banned_until>clock_timestamp() or kicked_at>p.last_seen)) then raise exception 'Access denied' using errcode='42501';end if;
 select * into e from eldervale_private.entities where id=entity_id for update;
 if e.id is null or e.deleted or e.data->>'kind'<>'item' then raise exception 'Item is no longer available';end if;
 if sqrt(power(p.x-(e.data->>'x')::float8,2)+power(p.z-(e.data->>'z')::float8,2))>3 then raise exception 'Move closer to pick up this item';end if;
 n:=coalesce((e.data->>'amount')::integer,1);perform eldervale_private.item_change(auth.uid(),e.data->>'item',n);
 if eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Inventory full. Free space before collecting this item';end if;
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 update eldervale_private.entities set deleted=true,revision=rev where id=entity_id;
 return jsonb_build_object('collected',true,'item',e.data->>'item','amount',n);
end $$;
revoke all on function eldervale_private.pickup(uuid) from public,anon,authenticated;
grant execute on function eldervale_private.pickup(uuid) to authenticated;
