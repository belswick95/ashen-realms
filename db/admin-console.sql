-- Owner game console (admin-console.js): bundles, group transforms, live lists, XP grants,
-- broadcast, mass heal/respawn, NPC behaviour (patrol), monster loot/rewards, farm content.
-- Applied to project aojccnhmvxurrnnzteej as migration "admin_console". Existing functions are
-- edited in place by eldervale_private.patch_function, which refuses any anchor that does not
-- match exactly once. Every new or changed body was first compiled as a *_probe function inside
-- a DO block that raised at the end (see db/admin-console-probe.sql).

-- 1. Guarded in-place editor for function definitions (owner/migration use only).
create or replace function eldervale_private.patch_function(target regprocedure, edits text[], probe boolean default false)
returns text language plpgsql set search_path='' as $fn$
declare def text:=pg_get_functiondef(target);old text;n integer;name text:=target::oid::regproc::text;head text;at integer;
begin
 if edits is null or cardinality(edits)=0 or cardinality(edits)%2<>0 then raise exception 'Edits must be old/new pairs';end if;
 for i in 1..cardinality(edits)/2 loop
  old:=edits[2*i-1];
  if old is null or old='' then raise exception 'Empty patch anchor';end if;
  n:=(length(def)-length(replace(def,old,'')))/length(old);
  if n<>1 then raise exception 'Patch anchor % for % matched % times: %',i,name,n,left(old,120);end if;
  def:=replace(def,old,edits[2*i]);
 end loop;
 if probe then
  head:='FUNCTION '||name||'(';at:=position(head in def);if at=0 then raise exception 'Cannot find header of %',name;end if;
  def:=overlay(def placing 'FUNCTION '||name||'_probe(' from at for length(head));
 end if;
 execute def;
 return case when probe then name||'_probe compiled' else name||' patched' end;
end $fn$;
revoke all on function eldervale_private.patch_function(regprocedure,text[],boolean) from public,anon,authenticated;

-- 2. Next patrol waypoint: the one after the waypoint nearest the actor (stateless loop).
create or replace function eldervale_private.patrol_goal(patrol jsonb, px float8, pz float8, axis integer)
returns float8 language sql immutable set search_path='' as $fn$
 select (patrol->((s.i+1)%s.n)->>axis)::float8 from (select jsonb_array_length(patrol) n,(select o::integer-1 from jsonb_array_elements(patrol) with ordinality e(p,o) order by power((p->>0)::float8-px,2)+power((p->>1)::float8-pz,2) limit 1) i) s
$fn$;
revoke all on function eldervale_private.patrol_goal(jsonb,float8,float8,integer) from public,anon,authenticated;

-- 3. Loot table roll on death. Never raises into world_tick.
create or replace function eldervale_private.actor_loot(actor_id text, killer uuid)
returns void language plpgsql security definer set search_path='' as $fn$
declare a eldervale_private.realm_actors;l jsonb;c jsonb;lo integer;hi integer;n integer;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or killer is null or jsonb_typeof(a.data->'loot') is distinct from 'array' then return;end if;
 if (select count(*) from eldervale_private.ground_drops where owner_id=killer)>=100 then return;end if;
 for l in select value from jsonb_array_elements(a.data->'loot') with ordinality e(value,o) where o<=8 loop
  begin
   if random()>least(1,greatest(0,coalesce((l->>'chance')::float8,1))) then continue;end if;
   select data into c from eldervale_private.realm_catalog where id='item:'||(l->>'item');
   if c is null or c?'noteOf' then continue;end if;
   lo:=least(1000,greatest(1,coalesce((l->>'min')::integer,1)));hi:=least(1000,greatest(lo,coalesce((l->>'max')::integer,lo)));
   n:=case when c?'field' then 1 else lo+floor(random()*(hi-lo+1))::integer end;
   insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,floor) values(killer,l->>'item',n,a.x+(random()-.5)*1.4,a.z+(random()-.5)*1.4,coalesce((a.data->>'floor')::integer,0));
  exception when others then raise warning 'Loot row skipped for %: %',actor_id,sqlerrm;
  end;
 end loop;
end $fn$;
revoke all on function eldervale_private.actor_loot(text,uuid) from public,anon,authenticated;

-- 4. Validation of console-only entity fields (loot, rewards, behaviour, patrol, look, group).
create or replace function eldervale_private.console_check_entity(d jsonb)
returns void language plpgsql stable set search_path='' as $fn$
declare r jsonb;k text;n numeric;
begin
 if d is null or jsonb_typeof(d)<>'object' then return;end if;
 if d?'loot' and jsonb_typeof(d->'loot')<>'null' then
  if jsonb_typeof(d->'loot')<>'array' or jsonb_array_length(d->'loot')>8 then raise exception 'Loot needs up to eight rows';end if;
  for r in select value from jsonb_array_elements(d->'loot') loop
   if jsonb_typeof(r)<>'object' or not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(r->>'item') and not c.data?'noteOf') then raise exception 'Unknown loot item: %',r->>'item';end if;
   if coalesce((r->>'min')::numeric,0) not between 1 and 1000 or coalesce((r->>'max')::numeric,0) not between (r->>'min')::numeric and 1000 or coalesce((r->>'chance')::numeric,0)<=0 or (r->>'chance')::numeric>1 then raise exception 'Loot quantities must be 1–1000 and chance above 0 up to 1';end if;
  end loop;
 end if;
 foreach k in array array['xpReward','goldReward'] loop
  if d?k and jsonb_typeof(d->k)<>'null' then n:=(d->>k)::numeric;if n<>trunc(n) or n<0 or n>case when k='xpReward' then 100000 else 1000000 end then raise exception 'Invalid %',k;end if;end if;
 end loop;
 if d?'behavior' and coalesce(d->>'behavior','') not in ('stationary','wander','patrol') then raise exception 'Behaviour must be stationary, wander or patrol';end if;
 if d?'patrol' and jsonb_typeof(d->'patrol')<>'null' then
  if jsonb_typeof(d->'patrol')<>'array' or jsonb_array_length(d->'patrol') not between 2 and 12 then raise exception 'Patrols need 2–12 waypoints';end if;
  for r in select value from jsonb_array_elements(d->'patrol') loop
   if jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>2 or jsonb_typeof(r->0)<>'number' or jsonb_typeof(r->1)<>'number' or abs((r->>0)::numeric)>4500 or abs((r->>1)::numeric)>4500 then raise exception 'Invalid patrol waypoint';end if;
   if d?'x' and d?'z' and sqrt(power((r->>0)::float8-(d->>'x')::float8,2)+power((r->>1)::float8-(d->>'z')::float8,2))>45 then raise exception 'Keep patrol waypoints within 45 m of the NPC';end if;
  end loop;
 end if;
 if d?'look' and jsonb_typeof(d->'look')<>'null' then
  if jsonb_typeof(d->'look')<>'object' or pg_column_size(d->'look')>600 then raise exception 'Invalid look';end if;
  for k in select jsonb_object_keys(d->'look') loop
   if k not in ('sex','skin','hair','hairColor','beard','outfit','outfitVariant') or length(d->'look'->>k)>40 then raise exception 'Unsupported look field: %',k;end if;
  end loop;
  if coalesce(d->'look'->>'outfit','auto') not in ('auto','none','peasant','knight','wizard','noble','ranger') then raise exception 'Unknown outfit';end if;
 end if;
 if d?'group' and jsonb_typeof(d->'group')<>'null' and coalesce(d->>'group','')!~'^[0-9a-f-]{36}$' then raise exception 'Invalid group';end if;
 if length(coalesce(d->>'groupName',''))>80 then raise exception 'Group name too long';end if;
end $fn$;
revoke all on function eldervale_private.console_check_entity(jsonb) from public,anon,authenticated;

-- 5. Console commands. Returns null for commands it does not own so admin_action continues.
create or replace function eldervale_private.admin_console(command text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r jsonb;e jsonb;ids jsonb:='[]';gid uuid;uid uuid;k text;n numeric;cx float8;cz float8;deg float8;dx float8;dz float8;ent record;cnt integer:=0;px float8;pz float8;before_row jsonb;
begin
 if command in ('spawn','update') then perform eldervale_private.console_check_entity(payload);return null;end if;
 if command is null or command not like 'console\_%' then return null;end if;
 -- Every console command is owner-only, checked here on the server.
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>65536 then raise exception 'Invalid console payload';end if;
 if command='console_live' then
  return jsonb_build_object('serverTime',now(),
   'players',(select coalesce(jsonb_agg(jsonb_build_object('userId',p.user_id,'name',s.character_name,'level',s.level,'health',s.health,'maxHealth',s.max_health,'gold',s.gold,'x',round(p.x::numeric,1),'z',round(p.z::numeric,1),'floor',p.floor,'muted',m.muted_until>now(),'fighting',exists(select 1 from eldervale_private.realm_actors a where a.target=p.user_id)) order by s.character_name),'[]') from eldervale_private.realm_players p join public.player_saves s on s.user_id=p.user_id left join eldervale_private.moderation m on m.user_id=p.user_id where p.last_seen>now()-interval '15 seconds'),
   'actors',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.data->>'name','kind',a.data->>'kind','template',a.data->>'template','species',a.data->>'species','role',a.data->>'role','level',(a.data->>'level')::integer,'x',round(a.x::numeric,1),'z',round(a.z::numeric,1),'hp',a.hp,'maxHp',(a.data->>'hp')::integer,'hostile',coalesce((a.data->>'hostile')::boolean,false),'frozen',coalesce((a.data->>'frozen')::boolean,false),'deleted',a.deleted,'fighting',a.target is not null,'group',a.data->>'group')),'[]') from eldervale_private.realm_actors a),
   'drops',(select count(*) from eldervale_private.ground_drops));
 end if;
 if command='console_bundle' then
  if jsonb_typeof(payload->'entities')<>'array' or jsonb_array_length(payload->'entities') not between 1 and 80 then raise exception 'Bundles hold 1–80 entities';end if;
  gid:=gen_random_uuid();
  for e in select value from jsonb_array_elements(payload->'entities') loop
   if jsonb_typeof(e)<>'object' then raise exception 'Invalid bundle entity';end if;
   r:=eldervale_private.admin_action('spawn',(e-'id'-'group')||jsonb_build_object('group',gid::text,'groupName',left(coalesce(payload->>'name','Group'),80)));
   ids:=ids||jsonb_build_array(r->>'id');
  end loop;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,gid::text,null,jsonb_build_object('name',payload->>'name','ids',ids));
  return jsonb_build_object('group',gid,'ids',ids);
 end if;
 if command='console_group' then
  k:=coalesce(payload->>'op','');if coalesce(payload->>'group','')!~'^[0-9a-f-]{36}$' or k not in ('move','rotate','delete','restore') then raise exception 'Choose a group and move, rotate, delete or restore';end if;
  dx:=coalesce((payload->>'dx')::float8,0);dz:=coalesce((payload->>'dz')::float8,0);deg:=coalesce((payload->>'degrees')::float8,0);
  if abs(dx)>500 or abs(dz)>500 or abs(deg)>360 or dx::text in ('NaN','Infinity','-Infinity') or dz::text in ('NaN','Infinity','-Infinity') or deg::text in ('NaN','Infinity','-Infinity') then raise exception 'Move up to 500 m and rotate up to 360°';end if;
  select avg((data->>'x')::float8),avg((data->>'z')::float8) into cx,cz from eldervale_private.entities where data->>'group'=payload->>'group' and deleted=(k='restore');
  if cx is null then raise exception 'Group not found';end if;
  for ent in select id,data from eldervale_private.entities where data->>'group'=payload->>'group' and deleted=(k='restore') order by id loop
   if k in ('delete','restore') then perform eldervale_private.admin_action(k,jsonb_build_object('id',ent.id));
   else
    px:=(ent.data->>'x')::float8-cx;pz:=(ent.data->>'z')::float8-cz;
    r:=jsonb_build_object('id',ent.id,'x',round((cx+px*cos(radians(deg))+pz*sin(radians(deg))+dx)::numeric,1),'z',round((cz-px*sin(radians(deg))+pz*cos(radians(deg))+dz)::numeric,1),'yaw',round(((((coalesce((ent.data->>'yaw')::float8,0)+deg)::numeric%360)+540)%360-180),1));
    if jsonb_typeof(ent.data->'patrol')='array' then r:=r||jsonb_build_object('patrol',(select jsonb_agg(jsonb_build_array(round(((p->>0)::float8-(ent.data->>'x')::float8+(r->>'x')::float8)::numeric,1),round(((p->>1)::float8-(ent.data->>'z')::float8+(r->>'z')::float8)::numeric,1)) order by o) from jsonb_array_elements(ent.data->'patrol') with ordinality q(p,o)));end if;
    perform eldervale_private.admin_action('update',r);
   end if;
   cnt:=cnt+1;
  end loop;
  return jsonb_build_object('group',payload->>'group','op',k,'count',cnt);
 end if;
 if command='console_give_xp' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());k:=payload->>'skill';n:=(payload->>'amount')::numeric;
  if k not in ('attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','miningXP','woodXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') or n is null or n<>trunc(n) or n<1 or n>5000000 then raise exception 'Choose a skill and 1–5,000,000 XP';end if;
  select to_jsonb(s) into before_row from public.player_saves s where user_id=uid for update;if before_row is null then raise exception 'Player has no character';end if;
  if k in ('miningXP','woodXP') then update public.player_saves set stats=stats||jsonb_build_object(k,least(13000000,coalesce((stats->>k)::numeric,0)+n)) where user_id=uid;
  else update public.player_saves set skills=skills||jsonb_build_object(k,least(13000000,coalesce((skills->>k)::numeric,0)+n)) where user_id=uid;update public.player_saves set level=eldervale_private.combat_level(skills) where user_id=uid;end if;
  select jsonb_build_object('userId',user_id,'skill',k,'xp',coalesce(skills->k,stats->k),'level',level) into r from public.player_saves where user_id=uid;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,jsonb_build_object('skills',before_row->'skills'),r);
  return r;
 end if;
 if command='console_goto_player' then
  select x,z into px,pz from eldervale_private.realm_players where user_id=(payload->>'userId')::uuid;if px is null then raise exception 'Player has no world position';end if;
  return eldervale_private.admin_action('teleport',jsonb_build_object('x',round((px+2)::numeric,1),'z',round(pz::numeric,1)));
 end if;
 perform pg_advisory_xact_lock(736211);
 if command='console_heal_all' then
  update public.player_saves set health=max_health where user_id in (select user_id from eldervale_private.realm_players where last_seen>now()-interval '15 seconds') and health<max_health;get diagnostics cnt=row_count;
 elsif command='console_respawn_all' then
  update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where not deleted and (hp<=0 or coalesce((payload->>'all')::boolean,false));get diagnostics cnt=row_count;
 elsif command='console_clear_drops' then
  n:=coalesce((payload->>'radius')::numeric,30);if n<1 or n>500 or not(payload?'x' and payload?'z') then raise exception 'Choose a point and a 1–500 m radius';end if;
  delete from eldervale_private.ground_drops where sqrt(power(x-(payload->>'x')::float8,2)+power(z-(payload->>'z')::float8,2))<=n;get diagnostics cnt=row_count;
 elsif command='console_broadcast' then
  n:=coalesce((payload->>'minutes')::numeric,10);if length(trim(coalesce(payload->>'text','')))<1 or length(payload->>'text')>1000 or n<1 or n>240 then raise exception 'Write a message (1–1000 characters) for 1–240 minutes';end if;
  update eldervale_private.settings set announcement=trim(payload->>'text'),announcement_until=now()+n*interval '1 minute',revision=revision+1 where id;
  cnt:=1;
 else raise exception 'Unknown console command';end if;
 r:=jsonb_build_object('command',command,'count',cnt);
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,null,null,payload||r);
 return r;
end $fn$;
revoke all on function eldervale_private.admin_console(text,jsonb) from public,anon,authenticated;

-- 6. Hook the console in front of the existing owner command chain.
select eldervale_private.patch_function('eldervale_private.admin_action(text,jsonb)'::regprocedure,array[
$a$begin
 if command in ('spawn','update') then$a$,
$a$begin
 r:=eldervale_private.admin_console(command,payload);if r is not null then return r;end if;
 if command in ('spawn','update') then$a$]);

-- 7. New monster, livestock and farm templates for spawn/update.
select eldervale_private.patch_function('eldervale_private.admin_owner_base(text,jsonb)'::regprocedure,array[
$a$'ruin') then raise exception 'Unknown template'$a$,
$a$'ruin','zombie','orc','cow','chicken','sheep','pig','farm_hut','chicken_coop','hay_bale','water_trough','scarecrow','flower_bed','stone_statue','wheelbarrow') then raise exception 'Unknown template'$a$]);

-- 8. Monster rewards and loot on death; NPC/monster patrol routes.
select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
$a$update public.player_saves set gold=gold+case when coalesce((a.data->>'hostile')::boolean,false) then 8 else 2 end,xp=xp+30,$a$,
$a$update public.player_saves set gold=least(1000000000,gold+coalesce(least(1000000,greatest(0,(a.data->>'goldReward')::integer)),case when coalesce((a.data->>'hostile')::boolean,false) then 8 else 2 end)),xp=xp+coalesce(least(100000,greatest(0,(a.data->>'xpReward')::integer)),30),$a$,
$a$perform eldervale_private.emit(jsonb_build_object('type','death','target',a.id,'player',a.target));$a$,
$a$perform eldervale_private.actor_loot(a.id,a.target);perform eldervale_private.emit(jsonb_build_object('type','death','target',a.id,'player',a.target));$a$,
$a$chance:=random()*pi()*2;period:=$a$,
$a$if jsonb_typeof(a.data->'patrol')='array' and jsonb_array_length(a.data->'patrol')>1 then gx:=eldervale_private.patrol_goal(a.data->'patrol',a.x,a.z,0);gz:=eldervale_private.patrol_goal(a.data->'patrol',a.x,a.z,1);else chance:=random()*pi()*2;period:=$a$,
$a$gz:=gz+sin(chance)*period;$a$,
$a$gz:=gz+sin(chance)*period;end if;$a$]);

-- 9. Farm buildings and props block movement like camp props (mirrors navigation-obstacles.js).
select eldervale_private.patch_function('eldervale_private.can_step(double precision,double precision,double precision,double precision)'::regprocedure,array[
$a$'weapon_rack','campfire') loop$a$,
$a$'weapon_rack','campfire','farm_hut','chicken_coop','hay_bale','water_trough','stone_statue','wheelbarrow','scarecrow','flower_bed') loop$a$,
$a$"campfire":[0.65,0.65]}'::jsonb$a$,
$a$"campfire":[0.65,0.65],"farm_hut":[2.2,1.8],"chicken_coop":[0.75,0.55],"hay_bale":[1.1,0.45],"water_trough":[0.95,0.4],"stone_statue":[0.55,0.55],"wheelbarrow":[0.4,0.7],"scarecrow":[0.15,0.15],"flower_bed":[1,0.45]}'::jsonb$a$]);
