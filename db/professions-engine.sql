-- All production, world-resource state and inventory changes are authoritative.
create table eldervale_private.skill_recipes(id text primary key,data jsonb not null);
create table eldervale_private.skill_jobs(user_id uuid primary key references auth.users(id) on delete cascade,recipe text not null references eldervale_private.skill_recipes(id),target text,ground_drop uuid,remaining integer not null check(remaining between 1 and 28),started_at timestamptz not null default clock_timestamp(),due_at timestamptz not null);
create index on eldervale_private.skill_jobs(due_at);
create table eldervale_private.skill_fires(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),x float8 not null,z float8 not null,expires_at timestamptz not null);
create index on eldervale_private.skill_fires(expires_at);
create table eldervale_private.skill_crops(target text primary key references eldervale_private.realm_objects(id) on delete cascade,owner_id uuid not null references auth.users(id),item text not null,amount integer not null,xp integer not null,planted_at timestamptz not null default clock_timestamp(),ready_at timestamptz not null);
create index on eldervale_private.skill_crops(owner_id);
alter table eldervale_private.skill_recipes enable row level security;
alter table eldervale_private.skill_jobs enable row level security;
alter table eldervale_private.skill_fires enable row level security;
alter table eldervale_private.skill_crops enable row level security;
revoke all on eldervale_private.skill_recipes,eldervale_private.skill_jobs,eldervale_private.skill_fires,eldervale_private.skill_crops from public,anon,authenticated;

create function eldervale_private.skill_tool(uid uuid,tool text) returns boolean language sql stable set search_path='' as $$
 select case when tool='firelighter' then coalesce(eldervale_private.item_quantity(uid,'matches'),0)>0 or coalesce(eldervale_private.item_quantity(uid,'tinderbox'),0)>0 else coalesce(eldervale_private.item_quantity(uid,tool),0)>0 end
$$;
create function eldervale_private.skill_xp(uid uuid,skill text,amount integer) returns void language plpgsql set search_path='' as $$
declare key text;begin
 key:=case skill when 'woodcutting' then 'woodXP' else skill||'XP' end;
 if skill in('mining','woodcutting') then update public.player_saves set stats=stats||jsonb_build_object(key,coalesce((stats->>key)::integer,0)+amount) where user_id=uid;
 else update public.player_saves set skills=skills||jsonb_build_object(key,coalesce((skills->>key)::integer,0)+amount) where user_id=uid;end if;
end $$;
create function eldervale_private.skill_error(uid uuid,r jsonb,target_id text,drop_id uuid default null) returns text language plpgsql set search_path='' as $$
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

create function eldervale_private.skill_finish(uid uuid,r jsonb,target_id text,drop_id uuid,t timestamptz) returns text language plpgsql set search_path='' as $$
declare problem text;k text;v jsonb;p eldervale_private.realm_players;o eldervale_private.realm_objects;d eldervale_private.ground_drops;failed boolean;kind text;points integer;result text;level integer;
begin
 -- Caller holds the world lock; resource rows and character are locked together.
 perform 1 from public.player_saves where user_id=uid for update;perform 1 from eldervale_private.realm_objects where id=target_id for update;
 if drop_id is not null then perform 1 from eldervale_private.ground_drops where id=drop_id for update;end if;
 problem:=eldervale_private.skill_error(uid,r,target_id,drop_id);if problem is not null then raise exception '%',problem;end if;
 select * into p from eldervale_private.realm_players where user_id=uid;kind:=r->>'kind';
 if drop_id is not null then select * into d from eldervale_private.ground_drops where id=drop_id;if d.amount=1 then delete from eldervale_private.ground_drops where id=drop_id;else update eldervale_private.ground_drops set amount=amount-1 where id=drop_id;end if;
 else for k,v in select key,value from jsonb_each(r->'inputs') loop perform eldervale_private.item_change(uid,k,-(v::integer));end loop;end if;
 if kind='fire' and coalesce(eldervale_private.item_quantity(uid,'tinderbox'),0)=0 then perform eldervale_private.item_change(uid,'matches',-1);end if;
 failed:=random()>coalesce((r->>'chance')::float8,1);
 if r?'burnChance' then
  select least(100,1+floor(sqrt(coalesce((skills->>'cookingXP')::integer,0)/50.0))::integer) into level from public.player_saves where user_id=uid;
  failed:=(r->>'burnChance')::float8>0 and random()<greatest(.01,(r->>'burnChance')::float8-level*.0015);if failed then perform eldervale_private.item_change(uid,'burntFood',1);end if;
 end if;
 if not failed then
  for k,v in select key,value from jsonb_each(r->'outputs') loop perform eldervale_private.item_change(uid,k,v::integer);end loop;
  if kind='mine' then update eldervale_private.realm_objects set available_at=t+make_interval(secs=>(r->>'respawn')::float8) where id=target_id;
  elsif kind='fire' then insert into eldervale_private.skill_fires(owner_id,x,z,expires_at) values(uid,coalesce(d.x,p.x),coalesce(d.z,p.z),t+make_interval(secs=>coalesce((r->>'fireSeconds')::integer,90)));
  elsif kind='plant' then insert into eldervale_private.skill_crops(target,owner_id,item,amount,xp,ready_at) values(target_id,uid,r->'crop'->>'item',(r->'crop'->>'min')::integer+floor(random()*((r->'crop'->>'max')::integer-(r->'crop'->>'min')::integer+1))::integer,(r->'crop'->>'xp')::integer,t+make_interval(secs=>(r->'crop'->>'seconds')::float8));
  elsif kind='build' then update eldervale_private.realm_objects set data=data||'{"built":true}' where id=target_id;update eldervale_private.settings set revision=revision+1 where id;update eldervale_private.entities set data=data||'{"built":true}',revision=(select revision from eldervale_private.settings where id) where id::text=target_id;
  end if;
  points:=(r->>'xp')::integer;perform eldervale_private.skill_xp(uid,r->>'skill',points);result:=(r->>'name')||' complete. +'||points||' '||(r->>'skill')||' XP';
 else result:=case when r?'burnChance' then 'The food burns. Higher Cooking reduces the chance.' else 'The attempt failed. Try again.' end;end if;
 if eldervale_private.inventory_used(uid)>16 then raise exception 'Inventory full. Free space before continuing.';end if;
 return result;
end $$;
create function eldervale_private.skill_tick(t timestamptz) returns void language plpgsql set search_path='' as $$
declare j eldervale_private.skill_jobs;r jsonb;problem text;f eldervale_private.skill_fires;
begin
 for j in select * from eldervale_private.skill_jobs where due_at<=t for update loop
  select data into r from eldervale_private.skill_recipes where id=j.recipe;
  if exists(select 1 from eldervale_private.realm_players where user_id=j.user_id and (path<>'[]' or input_until>t and abs(input_x)+abs(input_z)>.001)) then problem:='You stop skilling to move.';
  else
   problem:=null;
   begin
    perform eldervale_private.emit(jsonb_build_object('type','skill_complete','player',j.user_id,'text',eldervale_private.skill_finish(j.user_id,r,j.target,j.ground_drop,t)));
   exception when others then problem:=sqlerrm;end;
  end if;
  if problem is not null or j.remaining=1 then
   delete from eldervale_private.skill_jobs where user_id=j.user_id;if problem is not null then perform eldervale_private.emit(jsonb_build_object('type','skill_notice','player',j.user_id,'text',problem));end if;
  else update eldervale_private.skill_jobs set remaining=remaining-1,started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8) where user_id=j.user_id;end if;
 end loop;
 delete from eldervale_private.ground_drops where expires_at<=t;
 for f in select * from eldervale_private.skill_fires where expires_at<=t for update loop
  insert into eldervale_private.ground_drops(owner_id,item,amount,x,z) values(f.owner_id,'ashes',1,f.x,f.z);delete from eldervale_private.skill_fires where id=f.id;
 end loop;
end $$;

alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_professions;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;r jsonb;problem text;target_id text;drop_id uuid;n integer;crop eldervale_private.skill_crops;
begin
 if command in('skill_start','skill_cancel','skill_harvest','skill_consume') then
  result:=eldervale_private.realm_request_before_professions($1,'sync','{}',null,$5);
  perform pg_advisory_xact_lock(736211);
  if request_id is null or payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>2000 then raise exception 'Invalid profession request';end if;
  if not exists(select 1 from eldervale_private.realm_requests q where q.user_id=auth.uid() and q.request_id=$4) then
   select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
   if command='skill_cancel' then delete from eldervale_private.skill_jobs where user_id=auth.uid();
   elsif command='skill_consume' then
    select data into r from eldervale_private.realm_catalog where id='item:'||(payload->>'item') and (data->>'profession')::boolean and coalesce((data->>'heal')::integer,0)>0;
    if r is null then raise exception 'This item cannot be consumed';end if;if p.consume_at>clock_timestamp()-interval '1 second' then raise exception 'Wait a moment before eating again';end if;
    perform eldervale_private.item_change(auth.uid(),payload->>'item',-1);update public.player_saves set health=least(max_health,health+(r->>'heal')::integer) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=clock_timestamp() where user_id=auth.uid();
   elsif command='skill_harvest' then
    target_id:=payload->>'target';select * into crop from eldervale_private.skill_crops where target=target_id for update;
    if crop.owner_id is distinct from auth.uid() then raise exception 'This is not your crop';end if;
    if crop.ready_at>clock_timestamp() then raise exception 'The crop is still growing';end if;
    if not exists(select 1 from eldervale_private.realm_objects where id=target_id and sqrt(power(x-p.x,2)+power(z-p.z,2))<4) then raise exception 'Move closer to your crop';end if;
    if exists(select 1 from eldervale_private.realm_actors where target=auth.uid() and not deleted and hp>0) then raise exception 'Finish combat before harvesting';end if;
    n:=least(crop.amount,greatest(0,16-eldervale_private.inventory_used(auth.uid())));if n<1 then raise exception 'Inventory full';end if;
    perform eldervale_private.item_change(auth.uid(),crop.item,n);perform eldervale_private.skill_xp(auth.uid(),'farming',crop.xp*n);if n=crop.amount then delete from eldervale_private.skill_crops where target=target_id;else update eldervale_private.skill_crops set amount=amount-n where target=target_id;end if;
    perform eldervale_private.emit(jsonb_build_object('type','skill_complete','player',auth.uid(),'text','Harvested '||n||' '||crop.item||'. +'||(crop.xp*n)||' Farming XP'));
   else
    select data into r from eldervale_private.skill_recipes where id=payload->>'recipe';if r is null then raise exception 'Unknown recipe';end if;
    target_id:=payload->>'target';drop_id:=(payload->>'drop')::uuid;problem:=eldervale_private.skill_error(auth.uid(),r,target_id,drop_id);if problem is not null then raise exception '%',problem;end if;
    n:=coalesce((payload->>'amount')::integer,1);if n not between 1 and 28 then raise exception 'Choose 1–28 actions';end if;if r->>'kind' in('fire','plant','build','mine') then n:=1;end if;
    delete from eldervale_private.gathering_actions where user_id=auth.uid();
    insert into eldervale_private.skill_jobs(user_id,recipe,target,ground_drop,remaining,due_at) values(auth.uid(),payload->>'recipe',target_id,drop_id,n,clock_timestamp()+make_interval(secs=>(r->>'seconds')::float8)) on conflict(user_id) do update set recipe=excluded.recipe,target=excluded.target,ground_drop=excluded.ground_drop,remaining=excluded.remaining,started_at=clock_timestamp(),due_at=excluded.due_at;
    update eldervale_private.realm_players set path='[]',intent=null,input_x=0,input_z=0,input_until=null where user_id=auth.uid();
   end if;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
  end if;
  result:=eldervale_private.realm_request_before_professions($1,'sync','{}',null,$5);
 else
  if command in('steer','move','jump','equip','drop','trade_offer','bank','fish','woodcut','attack','stop') then delete from eldervale_private.skill_jobs where user_id=auth.uid() and exists(select 1 from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1);end if;
  result:=eldervale_private.realm_request_before_professions($1,$2,$3,$4,$5);
 end if;
 if exists(select 1 from eldervale_private.skill_jobs where user_id=auth.uid()) then result:=jsonb_set(result,'{motion,mounted}','false');end if;
 return result||jsonb_build_object(
 'professionJobs',(select coalesce(jsonb_agg(jsonb_build_object('player',j.user_id,'recipe',j.recipe,'target',j.target,'remaining',j.remaining,'startedAt',j.started_at,'dueAt',j.due_at)),'[]') from eldervale_private.skill_jobs j join eldervale_private.realm_players a on a.user_id=j.user_id join eldervale_private.realm_players viewer on viewer.user_id=auth.uid() where sqrt(power(a.x-viewer.x,2)+power(a.z-viewer.z,2))<180),
 'skillFires',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'x',f.x,'z',f.z,'expiresAt',f.expires_at)),'[]') from eldervale_private.skill_fires f join eldervale_private.realm_players viewer on viewer.user_id=auth.uid() where sqrt(power(f.x-viewer.x,2)+power(f.z-viewer.z,2))<180),
 'skillCrops',(select coalesce(jsonb_agg(jsonb_build_object('target',c.target,'owner',c.owner_id,'item',c.item,'readyAt',c.ready_at,'amount',c.amount)),'[]') from eldervale_private.skill_crops c join eldervale_private.realm_objects o on o.id=c.target join eldervale_private.realm_players viewer on viewer.user_id=auth.uid() where sqrt(power(o.x-viewer.x,2)+power(o.z-viewer.z,2))<180));
end $$;
revoke all on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
revoke all on function eldervale_private.realm_request_before_professions(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

alter function eldervale_private.admin_action(text,jsonb) rename to admin_before_professions;
create function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;item text;n integer;c jsonb;r jsonb;k text;v jsonb;old jsonb;recipe_key text;station text;
begin
 if command='setskill' and coalesce(payload->>'skill','') not in('miningXP','woodXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') then return eldervale_private.admin_before_professions(command,payload);end if;
 if command not in('give','catalog_recipe','reset_build','setskill','catalog_item') then return eldervale_private.admin_before_professions(command,payload);end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>8192 then raise exception 'Invalid owner request';end if;
 perform pg_advisory_xact_lock(736211);
 if command='catalog_item' then
  k:=coalesce(payload->>'model','sack');if k not in('sack','ore','bar','logs','potion','vial','bread','fish','apple','herb','gem','ring','rune','plank','nails','arrows','hide','seeds','feather','bow','trap','mortar','leather','food','meat','berries') then raise exception 'Choose an available drop model';end if;
  r:=eldervale_private.admin_before_professions(command,payload);r:=r||jsonb_build_object('model',k);update eldervale_private.realm_catalog set data=data||jsonb_build_object('model',k) where realm_catalog.id='item:'||(payload->>'id');
 elsif command='setskill' then
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
  recipe_key:=payload->>'id';if not exists(select 1 from eldervale_private.entities where entities.id::text=recipe_key and data->>'template'='construction_site' and not deleted) then raise exception 'Choose a construction site';end if;
  update eldervale_private.settings set revision=revision+1 where settings.id;
  update eldervale_private.entities set data=data||'{"built":false}',revision=(select revision from eldervale_private.settings where settings.id) where entities.id::text=recipe_key returning data into r;
 else
  recipe_key:=payload->>'id';r:=payload->'recipe';
  if recipe_key is null or recipe_key!~'^[a-z][A-Za-z0-9_]{1,60}$' or r is null or jsonb_typeof(r)<>'object' then raise exception 'Choose a recipe ID and definition';end if;
  if coalesce(r->>'skill','') not in('mining','woodcutting','fishing','firemaking','smithing','cooking','crafting','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving') or length(coalesce(r->>'name','')) not between 2 and 80 or coalesce((r->>'level')::integer,0) not between 1 and 100 or coalesce((r->>'xp')::integer,-1) not between 0 and 10000 or coalesce((r->>'seconds')::numeric,0) not between .6 and 30 then raise exception 'Check skill, name, level (1–100), XP (0–10,000), time (0.6–30s)';end if;
  select data into old from eldervale_private.skill_recipes where skill_recipes.id=recipe_key;
  if old is null and (select count(*) from eldervale_private.skill_recipes)>=500 then raise exception 'Recipe catalog limit reached';end if;
  station:=r->>'station';if station is not null and station not in('mining_rock','furnace','anvil','cooking','mill','workbench','spinning_wheel','tanning_rack','rune_altar','farming_patch','hunting_ground','agility_log','thieving_stall','practice_chest','water','herb_patch','flax_patch','wheat_patch','berry_bush','essence_rock') then raise exception 'Unknown station';end if;
  if jsonb_typeof(r->'inputs') is distinct from 'object' or jsonb_typeof(r->'outputs') is distinct from 'object' or jsonb_typeof(r->'tools') is distinct from 'array' then raise exception 'Choose materials, products and tools';end if;
  if (select count(*) from jsonb_each(r->'inputs'))>8 or (select count(*) from jsonb_each(r->'outputs'))>8 or jsonb_array_length(r->'tools')>5 then raise exception 'Use up to 8 materials, 8 products and 5 tools';end if;
  for k,v in select key,value from jsonb_each((r->'inputs')||(r->'outputs')) loop
   if (k<>'gold' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k)) or jsonb_typeof(v)<>'number' or v::numeric not between 1 and 1000 or v::numeric<>trunc(v::numeric) then raise exception 'Invalid item or quantity: %',k;end if;
  end loop;
  for k in select jsonb_array_elements_text(r->'tools') loop if k<>'firelighter' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k) then raise exception 'Unknown tool: %',k;end if;end loop;
  if old->>'kind'='mine' and r?'respawn' then if (r->>'respawn')::integer not between 15 and 3600 then raise exception 'Resource respawn must be 15–3600 seconds';end if;old:=old||jsonb_build_object('respawn',(r->>'respawn')::integer);end if;
  if old->>'kind'='fire' and r?'fireSeconds' then if (r->>'fireSeconds')::integer not between 30 and 600 then raise exception 'Fire lifetime must be 30–600 seconds';end if;old:=old||jsonb_build_object('fireSeconds',(r->>'fireSeconds')::integer);end if;
  if old->>'kind'='plant' and r?'crop' then
   c:=r->'crop';if coalesce((c->>'seconds')::integer,0) not between 30 and 86400 or coalesce((c->>'min')::integer,0) not between 1 and 10 or coalesce((c->>'max')::integer,0) not between (c->>'min')::integer and 10 or coalesce((c->>'xp')::integer,-1) not between 0 and 10000 then raise exception 'Check crop growth (30–86400s), yield (1–10) and XP';end if;old:=old||jsonb_build_object('crop',(old->'crop')||jsonb_build_object('seconds',(c->>'seconds')::integer,'min',(c->>'min')::integer,'max',(c->>'max')::integer,'xp',(c->>'xp')::integer));
  end if;
  if r?'chance' then if (r->>'chance')::float8 not between .05 and 1 then raise exception 'Success chance must be 0.05–1';end if;old:=coalesce(old,'{}')||jsonb_build_object('chance',(r->>'chance')::float8);end if;
  if r?'burnChance' then if (r->>'burnChance')::float8 not between 0 and .95 then raise exception 'Burn chance must be 0–0.95';end if;old:=coalesce(old,'{}')||jsonb_build_object('burnChance',(r->>'burnChance')::float8);end if;
  -- Owners can tune built-in special actions; custom recipes use the safe item-processing engine.
  r:=coalesce(old,'{}')||jsonb_build_object('name',r->>'name','skill',r->>'skill','level',(r->>'level')::integer,'xp',(r->>'xp')::integer,'seconds',(r->>'seconds')::float8,'station',station,'inputs',r->'inputs','outputs',r->'outputs','tools',r->'tools','enabled',coalesce((r->>'enabled')::boolean,true),'kind',coalesce(old->>'kind','process'));
  insert into eldervale_private.skill_recipes(id,data) values(recipe_key,r) on conflict on constraint skill_recipes_pkey do update set data=excluded.data;
  update eldervale_private.settings set revision=revision+1 where settings.id;
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(uid::text,recipe_key,payload->>'id'),old,r);
 return r;
end $$;
revoke all on function eldervale_private.admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function eldervale_private.admin_action(text,jsonb) to authenticated;
revoke all on function eldervale_private.admin_before_professions(text,jsonb) from public,anon,authenticated;

alter function eldervale_private.snapshot(bigint) rename to snapshot_before_professions;
create function eldervale_private.snapshot(cursor_revision bigint default -1) returns jsonb language plpgsql security definer set search_path='' as $$begin
 return eldervale_private.snapshot_before_professions(cursor_revision)||jsonb_build_object('professions',jsonb_build_object('recipes',(select coalesce(jsonb_object_agg(id,data),'{}') from eldervale_private.skill_recipes)));
end $$;
revoke all on function eldervale_private.snapshot(bigint) from public,anon,authenticated;
grant execute on function eldervale_private.snapshot(bigint) to authenticated;
revoke all on function eldervale_private.snapshot_before_professions(bigint) from public,anon,authenticated;

alter function eldervale_private.can_step(double precision,double precision,double precision,double precision) rename to can_step_before_professions;
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language plpgsql stable set search_path='' as $$
declare o record;s float8;a float8;dx float8;dz float8;hx float8;hz float8;begin
 if not eldervale_private.can_step_before_professions(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where abs(x-bx)<10 and abs(z-bz)<10 and data->>'template' in('furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','thieving_stall','practice_chest','essence_rock','construction_site') loop
  s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if not(o.data?'scaleX') then a:=a*pi()/180;end if;
  hx:=case when o.data->>'template' in('furnace','workbench','thieving_stall') then 1.2 else .8 end;hz:=.8;
  dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;
  if abs(dx)<hx+.2 and abs(dz)<hz+.2 then return false;end if;
 end loop;return true;
end $$;

-- Default execute grants are removed, including for invoker-only internal helpers.
revoke all on function eldervale_private.skill_tool(uuid,text),eldervale_private.skill_xp(uuid,text,integer),eldervale_private.skill_error(uuid,jsonb,text,uuid),eldervale_private.skill_finish(uuid,jsonb,text,uuid,timestamptz),eldervale_private.skill_tick(timestamptz),eldervale_private.can_step(double precision,double precision,double precision,double precision),eldervale_private.can_step_before_professions(double precision,double precision,double precision,double precision) from public,anon,authenticated;

create function eldervale_private.tree_log_item(d jsonb) returns text language sql immutable set search_path='' as $$select case when d->>'logItem' in('oakLogs','willowLogs','mapleLogs','yewLogs') then d->>'logItem' else 'wood' end$$;
create function eldervale_private.tree_log_xp(d jsonb) returns integer language sql immutable set search_path='' as $$select case d->>'logItem' when 'oakLogs' then 38 when 'willowLogs' then 68 when 'mapleLogs' then 100 when 'yewLogs' then 175 else 25 end$$;
alter function eldervale_private.gathering_error(uuid,text,text) rename to gathering_error_before_professions;
create function eldervale_private.gathering_error(uid uuid,target_id text,method text) returns text language plpgsql set search_path='' as $$declare problem text;o eldervale_private.realm_objects;xp integer;required integer;begin
 problem:=eldervale_private.gathering_error_before_professions(uid,target_id,method);if problem is not null then return problem;end if;
 if method='woodcut' then select * into o from eldervale_private.realm_objects where id=target_id;required:=case o.data->>'logItem' when 'oakLogs' then 15 when 'willowLogs' then 30 when 'mapleLogs' then 45 when 'yewLogs' then 60 else 1 end;
 select coalesce((stats->>'woodXP')::integer,0) into xp from public.player_saves where user_id=uid;if 1+floor(sqrt(xp/50.0))<required then return 'You need Woodcutting level '||required||' for this tree.';end if;end if;return null;
end $$;
revoke all on function eldervale_private.tree_log_item(jsonb),eldervale_private.tree_log_xp(jsonb),eldervale_private.gathering_error(uuid,text,text),eldervale_private.gathering_error_before_professions(uuid,text,text) from public,anon,authenticated;
