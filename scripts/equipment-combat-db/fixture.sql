-- Minimal local replica for db/osrs-equipment-combat.sql. patch_function is copied
-- from the live DB (read-only); world_tick and realm_request_base are small stand-ins
-- that contain the live anchor lines verbatim, in the same variable context, so the
-- patched code compiles and runs here.
create schema auth;create schema eldervale_private;create schema if not exists public;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table eldervale_private.realm_catalog(id text primary key,data jsonb not null);
create table eldervale_private.skill_recipes(id text primary key,data jsonb not null);
create table eldervale_private.settings(id boolean primary key default true,revision bigint default 1);insert into eldervale_private.settings values(true,1);
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint,data jsonb,deleted boolean default false);
create table eldervale_private.shop_stock(merchant text,item text,buy integer,sell integer,stock integer,target_stock integer,primary key(merchant,item));
create table eldervale_private.realm_actors(id text primary key,data jsonb,hp integer,target uuid,phase text,turn text,due_at timestamptz,turn_at timestamptz);
create table eldervale_private.realm_players(user_id uuid primary key,attack_style text,session_id uuid);
create table public.player_saves(user_id uuid primary key,skills jsonb default '{}',equipment jsonb default '{}',stats jsonb default '{}',inventory jsonb default '{}',health integer default 100);
create table eldervale_private.test_log(n serial,kind text,damage integer,blocked boolean,period float8);
-- Entity runtime, as live: shop_stock mirrors the entity's shop.
create function eldervale_private.entity_runtime() returns trigger language plpgsql as $$begin
 delete from eldervale_private.shop_stock where merchant=new.id::text;
 if not new.deleted then insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) select new.id::text,key,(value->>'buy')::integer,(value->>'sell')::integer,(value->>'stock')::integer from jsonb_each(coalesce(new.data->'shop','{}'));end if;
 return new;end $$;
create trigger runtime_entity after insert or update on eldervale_private.entities for each row execute function eldervale_private.entity_runtime();
-- OSRS experience table (combat-level.js).
create function eldervale_private.xp_level(xp numeric) returns integer language sql immutable as $$
 with recursive l(lvl,pts) as (select 1,0::numeric union all select lvl+1,pts+floor(lvl+300*power(2,lvl/7.0)) from l where lvl<99)
 select greatest(1,(select max(lvl) from l where floor(pts/4)<=greatest(0,coalesce(xp,0))))
$$;
create function eldervale_private.monster_damage_scale(level integer) returns double precision language sql immutable as $$ select greatest(1.0,1+(coalesce(level,1)-20)/80.0)::float8 $$;
CREATE OR REPLACE FUNCTION eldervale_private.patch_function(target regprocedure, edits text[], probe boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $function$
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
end $function$;
-- Stand-in world tick: one player turn and one enemy turn for every test actor.
create function eldervale_private.world_tick() returns void language plpgsql security definer set search_path to '' as $function$
declare a eldervale_private.realm_actors;victim public.player_saves;target_player eldervale_private.realm_players;w jsonb;damage integer;defence integer;absorb integer;blocked boolean;atk integer;str integer;def integer;style text;chance float8;period float8;shooting boolean;
begin
 for a in select * from eldervale_private.realm_actors order by id loop
  select * into target_player from eldervale_private.realm_players where user_id=a.target;
  select * into victim from public.player_saves where user_id=a.target;
  select data into w from eldervale_private.realm_catalog where id='weapon:'||coalesce(victim.equipment->>'weapon','unarmed');w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
  shooting:=coalesce((w->>'ranged')::boolean,false) and (coalesce((w->>'magic')::boolean,false) or coalesce((victim.stats->>'arrows')::integer,0)>0);
  period:=case when a.turn='player' then (w->>'speed')::float8 else (a.data->>'attackSpeed')::float8 end;
  if a.turn='player' and coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) and coalesce((victim.stats->>'arrows')::integer,0)<1 then
   insert into eldervale_private.test_log(kind) values('out of arrows');continue;
  end if;
  if a.turn='player' then
     atk:=eldervale_private.xp_level((victim.skills->>'attackXP')::numeric);str:=eldervale_private.xp_level((victim.skills->>'strengthXP')::numeric);style:=target_player.attack_style;
     chance:=greatest(.2,least(.98,.85+(atk-coalesce((a.data->>'defenceLevel')::integer,(a.data->>'level')::integer))*.003+coalesce((w->>'attack')::integer,0)*.002));blocked:=random()>chance;
     damage:=case when blocked then 0 else greatest(1,1+floor(random()*(4+(w->>'damage')::integer+floor(str*.35)))::integer-floor((a.data->>'level')::integer/15)) end;
     if coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) then update public.player_saves set stats=stats||jsonb_build_object('arrows',greatest(0,coalesce((stats->>'arrows')::integer,0)-1)) where user_id=a.target;end if;
     insert into eldervale_private.test_log(kind,damage,blocked,period) values('player',damage,blocked,period);
  else
     select coalesce(sum((data->>'defence')::integer),0),coalesce(sum((data->>'reduction')::integer),0) into defence,absorb from eldervale_private.realm_catalog c where c.id like 'armor:%' and coalesce((victim.equipment->>substring(c.id from 7))::boolean,false);
     def:=eldervale_private.xp_level((victim.skills->>'defenceXP')::numeric);
     chance:=greatest(.1,least(.95,.85+coalesce((a.data->>'level')::integer,1)*.002-(def+defence)*.004));blocked:=random()>chance;

     damage:=case when blocked then 0 else greatest(1,round((4+(a.data->>'damage')::integer+floor(random()*5)::integer)*eldervale_private.monster_damage_scale((a.data->>'level')::integer))::integer-case when a.data->>'attackType' in ('fire','magic','venom') then 0 else absorb end) end;
     insert into eldervale_private.test_log(kind,damage,blocked,period) values('enemy',damage,blocked,period);
  end if;
 end loop;
end $function$;
-- Stand-in equip command (the live equip branch's first lines).
create function eldervale_private.realm_request_base(session_id uuid,command text,payload jsonb,request_id uuid,event_cursor bigint) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.player_saves;c jsonb;slot text;key text;item text;field text;
begin
 select * into s from public.player_saves where user_id=auth.uid();
 if command='equip' then
  slot:=payload->>'slot';key:=payload->>'key';item:=case when slot='weapon' then 'weapon:' when slot='shield' then 'shield:' when slot='mount' then 'mount:' when slot in ('amulet','trinket') then 'jewelry:' else 'armor:' end||key;
  select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown equipment';end if;field:=c->>'field';if not(coalesce(s.inventory->field,'[]')?key) then raise exception 'You do not carry this item';end if;
  if field='armorOwned' then s.equipment:=s.equipment||jsonb_build_object(key,not coalesce((s.equipment->>key)::boolean,false));
  else s.equipment:=s.equipment||jsonb_build_object(slot,case when s.equipment->>slot=key then null else key end);end if;
  update public.player_saves set equipment=s.equipment where user_id=auth.uid();
 end if;
 return jsonb_build_object('equipment',s.equipment);
end $function$;
