-- RuneScape-style death (Nov 2026).
-- When a monster brings a player to 0 HP:
--  * the player keeps their 3 most valuable item units (catalog "buy" price per single unit, so a
--    stack of 500 arrows is 500 units at the arrow price; equipped and carried items both count;
--    ties: equipped first, then item id). Coins count at 1 gold each, as in OSRS.
--    Items flagged untradeable / questItem / keepOnDeath in the catalog are always kept and do not
--    use one of the 3 places. The bank is never touched.
--  * everything else (inventory, worn equipment, coins) is dropped at the death spot as ordinary
--    ground drops: visible to and lootable by ANY player at once, expiring exactly 15 minutes later
--    (the existing world_tick sweep removes expired drops). Stackables and notes drop as one pile,
--    other items one drop per unit (like OSRS).
--  * the player lies dead for 2.8 s at the spot (monsters let go, movement and actions are frozen),
--    then respawns at the world spawn point (settings.spawn_x/spawn_z) with full HP.
--  * events: player_death {player,x,z,floor,kept,dropped,expiresAt,respawnAt} and player_respawn.
--    game_flags.deathPile {x,z,floor,expiresAt,ids,kept} lets the client show the pile on the map.
-- Schema-safe: no table or column changes and no row removal here; only new functions plus exact-once world_tick edits through
-- eldervale_private.patch_function. Re-running is safe: the world_tick edits are skipped once applied.
-- Works with either inventory size (16 or 28): nothing here depends on the backpack capacity.

-- Which units are kept and which drop, without changing anything (also usable for previews).
create or replace function eldervale_private.death_keep_plan(uid uuid, keep integer default 3)
returns jsonb language plpgsql stable set search_path='' as $fn$
declare s public.player_saves;r record;left_over integer:=greatest(0,keep);k integer;kept jsonb:='[]';dropped jsonb:='[]';
begin
 select * into s from public.player_saves where user_id=uid;
 if s.user_id is null then return jsonb_build_object('kept','[]'::jsonb,'dropped','[]'::jsonb);end if;
 for r in
  with c as (select substring(id from 6) item,data from eldervale_private.realm_catalog where id like 'item:%'),
  carried as (
   -- Equipment-style items: one array entry per copy; a worn copy is still carried.
   select c.item,c.data,count(*)::integer n,
    bool_or(coalesce(case f.key when 'armorOwned' then s.equipment->v.value='true'::jsonb
     when 'weaponsOwned' then s.equipment->>'weapon'=v.value
     when 'shieldsOwned' then s.equipment->>'shield'=v.value
     when 'mountsOwned' then s.equipment->>'mount'=v.value
     else s.equipment->>'amulet'=v.value or s.equipment->>'trinket'=v.value end,false)) equipped
   from jsonb_each(coalesce(s.inventory,'{}'::jsonb)) f
   cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.value)='array' then f.value else '[]'::jsonb end) v
   join c on c.data->>'field'=f.key and c.data->>'key'=v.value
   where f.key in ('armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned')
   group by c.item,c.data
   union all
   -- Counted items (resources, food, tools, notes, ammo) live in stats.
   select c.item,c.data,least(1000000000,floor((s.stats->>c.item)::numeric))::integer,false
   from c where not(c.data?'field') and jsonb_typeof(s.stats->c.item)='number' and (s.stats->>c.item)::numeric>=1
   union all
   select 'gold','{"buy":1,"stackable":true,"name":"Coins"}'::jsonb,least(s.gold,1000000000)::integer,false where s.gold>0)
  select u.item,u.n,u.equipped,coalesce(u.data->>'name',u.item) as name,
   (u.data->'stackable'='true'::jsonb or u.data?'noteOf') as stack,
   coalesce(u.data->'untradeable'='true'::jsonb or u.data->'questItem'='true'::jsonb or u.data->'keepOnDeath'='true'::jsonb,false) as protected,
   case when jsonb_typeof(u.data->'buy')='number' then (u.data->>'buy')::numeric else 0 end as value
  from carried u where u.n>0
  order by 6 desc,7 desc,3 desc,1
 loop
  if r.protected then k:=r.n;else k:=least(r.n,left_over);left_over:=left_over-k;end if;
  if k>0 then kept:=kept||jsonb_build_array(jsonb_build_object('item',r.item,'amount',k,'name',r.name,'value',r.value,'protected',r.protected));end if;
  if r.n>k then dropped:=dropped||jsonb_build_array(jsonb_build_object('item',r.item,'amount',r.n-k,'value',r.value,'equipped',r.equipped and k=0,'stack',coalesce(r.stack,false)));end if;
 end loop;
 return jsonb_build_object('kept',kept,'dropped',dropped);
end $fn$;
revoke all on function eldervale_private.death_keep_plan(uuid,integer) from public,anon,authenticated;

-- The death itself: drop the pile, start the 2.8 s death pose, tell everyone.
create or replace function eldervale_private.player_die(uid uuid, t timestamptz default clock_timestamp(), killer text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare s public.player_saves;p eldervale_private.realm_players;plan jsonb;d jsonb;c jsonb;ids jsonb:='[]';n integer;i integer;rid uuid;
 fx float8;fz float8;fl integer;pile jsonb;expires timestamptz:=t+interval '15 minutes';respawn timestamptz:=t+interval '2.8 seconds';
begin
 select * into s from public.player_saves where user_id=uid for update;
 if s.user_id is null or coalesce(s.game_flags,'{}'::jsonb)?'deathRespawnAt' then return null;end if;
 s.equipment:=coalesce(s.equipment,'{}'::jsonb);
 select * into p from eldervale_private.realm_players where user_id=uid for update;
 fx:=coalesce(p.x,(s.world_position->>'x')::float8,0);fz:=coalesce(p.z,(s.world_position->>'y')::float8,0);fl:=coalesce(p.floor,0);
 plan:=eldervale_private.death_keep_plan(uid,3);
 for d in select value from jsonb_array_elements(plan->'dropped') loop
  begin
   n:=(d->>'amount')::integer;c:=null;
   if d->>'item'<>'gold' then select data into c from eldervale_private.realm_catalog where id='item:'||(d->>'item');end if;
   -- A worn copy that is not kept comes off first, so item_change may remove it.
   if (d->>'equipped')::boolean and c is not null then
    s.equipment:=case c->>'field' when 'armorOwned' then s.equipment-(c->>'key')
     when 'weaponsOwned' then s.equipment||'{"weapon":null}'::jsonb
     when 'shieldsOwned' then s.equipment||'{"shield":null}'::jsonb
     when 'mountsOwned' then s.equipment||'{"mount":null}'::jsonb
     else s.equipment||(case when s.equipment->>'amulet'=c->>'key' then '{"amulet":null}'::jsonb else '{}'::jsonb end)||(case when s.equipment->>'trinket'=c->>'key' then '{"trinket":null}'::jsonb else '{}'::jsonb end) end;
    update public.player_saves set equipment=s.equipment where user_id=uid;
   end if;
   perform eldervale_private.item_change(uid,d->>'item',-n);
   if (d->>'stack')::boolean or n>40 then
    insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,floor,created_at,expires_at)
     values(uid,d->>'item',n,fx+(random()-.5)*1.2,fz+(random()-.5)*1.2,fl,t,expires) returning id into rid;
    ids:=ids||jsonb_build_array(rid::text);
   else
    for i in 1..n loop
     insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,floor,created_at,expires_at)
      values(uid,d->>'item',1,fx+(random()-.5)*1.4,fz+(random()-.5)*1.4,fl,t,expires) returning id into rid;
     ids:=ids||jsonb_build_array(rid::text);
    end loop;
   end if;
  exception when others then raise warning 'Death drop skipped for % (%): %',uid,d->>'item',sqlerrm;
  end;
 end loop;
 pile:=case when jsonb_array_length(ids)>0 then jsonb_build_object('x',fx,'z',fz,'floor',fl,'diedAt',t,'expiresAt',expires,'ids',ids,'kept',plan->'kept') else null end;
 update public.player_saves set health=0,
  game_flags=(coalesce(game_flags,'{}'::jsonb)-'deathPile')||jsonb_build_object('deathRespawnAt',respawn,'deathSpot',jsonb_build_object('x',fx,'z',fz),'deathKept',plan->'kept')||coalesce(jsonb_build_object('deathPile',pile),'{}'::jsonb)
  where user_id=uid;
 update eldervale_private.realm_players set path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
 update eldervale_private.realm_actors set target=null,phase='ready' where target=uid;
 perform eldervale_private.emit(jsonb_build_object('type','player_death','player',uid,'killer',killer,'x',fx,'z',fz,'floor',fl,
  'kept',plan->'kept','dropped',jsonb_array_length(ids),'expiresAt',case when pile is null then null else expires end,'respawnAt',respawn));
 return plan;
end $fn$;
revoke all on function eldervale_private.player_die(uuid,timestamptz,text) from public,anon,authenticated;

-- Called for every connected player each world tick. True while the player is dead (the caller
-- skips their movement and actions); on the tick the death pose ends they respawn at home.
create or replace function eldervale_private.death_tick(uid uuid, t timestamptz)
returns boolean language plpgsql security definer set search_path='' as $fn$
declare s public.player_saves;sx float8;sz float8;
begin
 select * into s from public.player_saves where user_id=uid;
 if s.user_id is null or not(coalesce(s.game_flags,'{}'::jsonb)?'deathRespawnAt') then return false;end if;
 if (s.game_flags->>'deathRespawnAt')::timestamptz>t then
  update eldervale_private.realm_players set x=coalesce((s.game_flags->'deathSpot'->>'x')::float8,x),z=coalesce((s.game_flags->'deathSpot'->>'z')::float8,z),
   path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
  return true;
 end if;
 select spawn_x,spawn_z into sx,sz from eldervale_private.settings where id;sx:=coalesce(sx,0);sz:=coalesce(sz,5);
 update public.player_saves set health=max_health,game_flags=game_flags-'deathRespawnAt'-'deathSpot',
  world_position=coalesce(world_position,'{}'::jsonb)||jsonb_build_object('x',sx,'y',sz,'floor',0,'building',null) where user_id=uid;
 update eldervale_private.realm_players set x=sx,z=sz,floor=0,building=null,path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
 update eldervale_private.realm_actors set target=null,phase='ready' where target=uid;
 perform eldervale_private.emit(jsonb_build_object('type','player_respawn','player',uid,'x',sx,'z',sz,'kept',coalesce(s.game_flags->'deathKept','[]'::jsonb)));
 return true;
end $fn$;
revoke all on function eldervale_private.death_tick(uuid,timestamptz) from public,anon,authenticated;

-- world_tick: the old death (full heal, -10 gold, teleport to 0,5) becomes player_die; dead players
-- skip their turn; monsters neither keep attacking nor newly aggro a dead player.
do $patch$ begin
 if position('eldervale_private.player_die(' in pg_get_functiondef('eldervale_private.world_tick()'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
   $a$p:=eldervale_private.advance_player_motion(p.user_id,t);$a$,
   $a$if eldervale_private.death_tick(p.user_id,t) then continue;end if;p:=eldervale_private.advance_player_motion(p.user_id,t);$a$,
   $a$if victim.health<=damage then update public.player_saves set health=max_health,gold=greatest(0,gold-10),world_position=world_position||'{"x":0,"y":5}' where user_id=a.target;update eldervale_private.realm_players set x=0,z=5,floor=0,building=null,intent=null,path='[]' where user_id=a.target;update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','player_death','player',a.target));end if;$a$,
   $a$if victim.health<=damage then perform eldervale_private.player_die(a.target,t,a.id);end if;$a$,
   $a$if not found or exists(select 1 from eldervale_private.moderation where user_id=a.target and banned_until>t) then$a$,
   $a$if not found or exists(select 1 from eldervale_private.moderation where user_id=a.target and banned_until>t) or exists(select 1 from public.player_saves dp where dp.user_id=a.target and dp.game_flags?'deathRespawnAt') then$a$,
   $a$and last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 order by$a$,
   $a$and last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 and not exists(select 1 from public.player_saves dp where dp.user_id=realm_players.user_id and dp.game_flags?'deathRespawnAt') order by$a$]);
 end if;
end $patch$;

-- Check: expect player_die=true, death_tick=true, old_death=false.
select position('eldervale_private.player_die(' in d)>0 as player_die,position('eldervale_private.death_tick(' in d)>0 as death_tick,
 position('gold=greatest(0,gold-10)' in d)>0 as old_death
from (select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) d) x;
