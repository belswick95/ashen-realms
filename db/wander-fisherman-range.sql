-- A cooking fire beside Old Tam's Fisherman's Hut on The Wander, so players can cook their catch
-- without walking to a town hearth. Apply AFTER db/general-store-and-fisherman.sql.
-- Station: the 'campfire' template. Cooking recipes use "station":"cooking", which the server
-- (skill_error: hearth / campfire / cooking_tripod, within 4 m) and the client (game.js maps the
-- same three templates to station 'cooking') both accept. Collision is the shared campfire box
-- (0.65 x 0.65 half-extents + 0.2 player radius) in both eldervale_private.can_step and
-- navigation-obstacles.js campObstacleSizes, so client routes and the server walker agree.
-- Placement, in the hut's own frame (hut yaw 30 deg, door faces the river along +forward):
-- 5 m to the right (away from the water) and 4 m forward, i.e. beside the front-right corner.
-- That leaves the door and the straight path to the shoal (9 m ahead) clear and keeps a gap of
-- more than a metre to the wall. Checked on the live map: can_step is true on a 2.5 m ring
-- around the site, and nothing but the hut and the shoal lies within 8 m.
-- Idempotent: keyed by blueprint 'osrs-shops-v1' + blueprintKey 'wander-fisherman-range'.
do $seed$
declare rev bigint;hut record;q float8;fx float8;fz float8;f float8;
begin
 if exists(select 1 from eldervale_private.entities where not deleted and data->>'blueprint'='osrs-shops-v1' and data->>'blueprintKey'='wander-fisherman-range') then
  raise notice 'wander-fisherman-range already present';return;
 end if;
 select (data->>'x')::float8 x,(data->>'z')::float8 z,coalesce((data->>'yaw')::float8,0) yaw into hut from eldervale_private.entities
  where not deleted and data->>'blueprint'='osrs-shops-v1' and data->>'blueprintKey'='wander-fisherman' limit 1;
 if hut.x is null then raise exception 'Fisherman''s Hut (osrs-shops-v1 / wander-fisherman) not found: apply db/general-store-and-fisherman.sql first';end if;
 q:=radians(hut.yaw);
 -- forward = (sin q, cos q), right = (cos q, -sin q)
 fx:=round((hut.x+4*sin(q)+5*cos(q))::numeric,2)::float8;
 fz:=round((hut.z+4*cos(q)-5*sin(q))::numeric,2)::float8;
 if not eldervale_private.can_step(fx,fz,fx,fz) then raise exception 'Cooking fire site %, % is not walkable',fx,fz;end if;
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 insert into eldervale_private.entities(id,revision,data) values(gen_random_uuid(),rev,jsonb_build_object('kind','object','template','campfire','name','Old Tam''s cooking fire',
  'x',fx,'z',fz,'yaw',hut.yaw,'scale',1,'hp',1,'level',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,
  'blueprint','osrs-shops-v1','blueprintKey','wander-fisherman-range'));
 -- The door and the walk from it to the water stay open (rolls everything back otherwise).
 f:=3.2;
 while f<=8 loop
  if not eldervale_private.can_step(hut.x+f*sin(q),hut.z+f*cos(q),hut.x+f*sin(q),hut.z+f*cos(q)) then raise exception 'Cooking fire would block the hut door path at % m',f;end if;
  f:=f+.4;
 end loop;
 raise notice 'Old Tam''s cooking fire placed at %, %',fx,fz;
end $seed$;

-- Sanity report: the fire is a cooking station 4 m reach from the hut's front-right corner.
select e.data->>'name' as name,o.kind,round(o.x::numeric,2) as x,round(o.z::numeric,2) as z,o.data->>'template' as template
from eldervale_private.entities e join eldervale_private.realm_objects o on o.id=e.id::text
where e.data->>'blueprint'='osrs-shops-v1' and e.data->>'blueprintKey'='wander-fisherman-range' and not e.deleted;
