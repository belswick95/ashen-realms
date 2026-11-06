-- Extra stand-ins for scripts/explore-db/check.mjs, applied after scripts/underground-db/fixture.sql.
-- mech_drop is the live text (2026-11-06) so the clue-loot patch anchor is exercised.
create or replace function eldervale_private.item_change(uid uuid,item text,amount integer,bank boolean default false) returns void language plpgsql as $$
begin
 if item='gold' then update public.player_saves set gold=gold+amount where user_id=uid;return;end if;
 if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||item) and item not in ('spade') then raise exception 'Unknown item';end if;
 if bank then update public.player_saves set inventory=jsonb_set(inventory,'{bank}',coalesce(inventory->'bank','{}')||jsonb_build_object(item,coalesce((inventory->'bank'->>item)::integer,0)+amount)) where user_id=uid;return;end if;
 if coalesce((select (stats->>item)::integer from public.player_saves where user_id=uid),0)+amount<0 then raise exception 'Not enough items';end if;
 update public.player_saves set stats=stats||jsonb_build_object(item,coalesce((stats->>item)::integer,0)+amount) where user_id=uid;
end $$;
create table eldervale_private.ground_loot(id bigserial primary key,owner uuid,item text,n integer);
create or replace function eldervale_private.game_multiplier(k text) returns double precision language sql stable as $$ select 1::float8 $$;
create or replace function eldervale_private.mech_monster_drops(actor_id text,d jsonb) returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create or replace function eldervale_private.mech_qty(rw jsonb) returns integer language sql immutable as $$ select coalesce((rw->>'min')::integer,1) $$;
create or replace function eldervale_private.mech_chance(c jsonb) returns double precision language sql immutable as $$ select 0::float8 $$;
create or replace function eldervale_private.mech_pick(t jsonb,mult double precision) returns jsonb language sql stable as $$ select null::jsonb $$;
create or replace function eldervale_private.mech_ground_drop(killer uuid,item text,n integer,x double precision,z double precision,fl integer) returns void language sql as $$ insert into eldervale_private.ground_loot(owner,item,n) values(killer,item,n) $$;
CREATE OR REPLACE FUNCTION eldervale_private.mech_drop(actor_id text, killer uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a eldervale_private.realm_actors;d jsonb;rw jsonb;mult float8:=greatest(0,coalesce(eldervale_private.game_multiplier('dropRate'),1));got jsonb:='[]';replaced boolean:=false;fl integer;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or killer is null then return got;end if;
 d:=eldervale_private.mech_monster_drops(actor_id,a.data);fl:=coalesce((a.data->>'floor')::integer,0);
 for rw in select value from jsonb_array_elements(coalesce(d->'always','[]')) loop got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end loop;
 for rw in select value from jsonb_array_elements(coalesce(d->'preroll','[]')) loop
  if random()<eldervale_private.mech_chance(rw->'chance')*mult then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));if coalesce((rw->>'replacesMain')::boolean,false) then replaced:=true;end if;end if;
 end loop;
 if not replaced and d ? 'main' then rw:=eldervale_private.mech_pick(d->'main',mult);if rw is not null and rw ? 'item' then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end if;end if;
 for rw in select value from jsonb_array_elements(coalesce(d->'tertiary','[]')) loop
  if random()<eldervale_private.mech_chance(rw->'chance')*mult then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end if;
 end loop;
 for rw in select value from jsonb_array_elements(got) loop
  begin perform eldervale_private.mech_ground_drop(killer,rw->>'item',(rw->>'n')::integer,a.x,a.z,fl);
  exception when others then raise warning 'Loot skipped for %: %',actor_id,sqlerrm;end;
 end loop;
 return got;
end $function$;
-- Catalog rows for the reward items (live has them all).
insert into eldervale_private.realm_catalog(id,data) select 'item:'||k,jsonb_build_object('name',k) from unnest(array['shrimp','trout','bread','bronzeArrows','steelArrows','ironBar','uncutGem','airRune','fireRune','oakLogs','feathers','healingPotion',
 'lobster','salmon','steelBar','mithrilBar','goldBar','moonsilverArrows','cutGem','yewLogs','shrineDraught','briskTonic','swordfish','stoneBass','runiteBar','adamantBar','tidesteelArrows','windstepBrew','serpentbaneTonic','deepglowAngler','spade','runiteBar']) k on conflict do nothing;
