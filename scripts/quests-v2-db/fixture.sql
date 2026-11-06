-- Extra stand-ins for the quest v2 check (on top of scripts/castle-tutorial-db/fixture.sql).
-- patch_function and fc_check_dialogue are the live bodies; the rest are small stand-ins.
CREATE OR REPLACE FUNCTION eldervale_private.patch_function(target regprocedure, edits text[], probe boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
CREATE OR REPLACE FUNCTION eldervale_private.fc_check_dialogue(lines jsonb, what text)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare line jsonb;
begin
 if lines is null or jsonb_typeof(lines)='null' then return;end if;
 if jsonb_typeof(lines)<>'array' or jsonb_array_length(lines)>20 then raise exception '% dialogue needs up to 20 lines',what;end if;
 for line in select value from jsonb_array_elements(lines) loop
  if jsonb_typeof(line)<>'object' or coalesce(line->>'who','') not in ('npc','player') or length(trim(coalesce(line->>'text',''))) not between 1 and 400 then raise exception '% dialogue lines need a speaker (npc/player) and 1–400 characters',what;end if;
 end loop;
end $function$;
-- Reduced fc_quest_check: the parts v2 relies on (classic fields, objective types and targets).
create or replace function eldervale_private.fc_quest_check(d jsonb, qid uuid) returns void language plpgsql stable set search_path='' as $$
declare o jsonb;i integer:=0;t text;
begin
 if length(trim(coalesce(d->>'name',''))) not between 2 and 80 then raise exception 'Quest name must be 2–80 characters';end if;
 if length(trim(coalesce(d->>'description',''))) not between 1 and 2000 then raise exception 'Quest description must be 1–2000 characters';end if;
 if not exists(select 1 from eldervale_private.realm_actors where id=d->>'giver' and not deleted and data->>'kind'='npc') then raise exception 'Choose an existing NPC as quest giver';end if;
 if coalesce(jsonb_typeof(d->'objectives'),'null')<>'array' or jsonb_array_length(d->'objectives') not between 1 and 12 then raise exception 'Choose 1–12 objectives';end if;
 for o in select value from jsonb_array_elements(d->'objectives') loop
  i:=i+1;t:=coalesce(o->>'type','');
  if not(t=any(array['talk','kill','collect','event','xp','have','equip','bank','visit'])) then raise exception 'Objective %: unknown type %',i,t;end if;
  if t='talk' and not exists(select 1 from eldervale_private.realm_actors where id=o->>'target' and not deleted and data->>'kind'='npc') then raise exception 'Objective %: choose an NPC to talk to',i;end if;
  if t in ('collect','have') and not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(o->>'target')) then raise exception 'Objective %: choose an original item',i;end if;
  if t='talk' then perform eldervale_private.fc_check_dialogue(o->'dialogue','Objective '||i);end if;
 end loop;
end $$;
create or replace function eldervale_private.xp_level(xp numeric) returns integer language sql immutable set search_path='' as $$
 select greatest(1,(select count(*)::integer from generate_series(1,98) l where floor((select sum(floor(n+300*power(2,n/7.0))) from generate_series(1,l) n)/4)<=coalesce(xp,0))+1)
$$;
create or replace function eldervale_private.combat_level(skills jsonb) returns integer language sql immutable set search_path='' as $$select 3$$;
create or replace function eldervale_private.admin_full_control(command text, payload jsonb) returns jsonb language sql as $$select jsonb_build_object('fc',command)$$;
create or replace function eldervale_private.admin_building_signs(command text, payload jsonb) returns jsonb language sql as $$select null::jsonb$$;
create or replace function eldervale_private.story_contains(parent jsonb, x double precision, z double precision, story integer) returns boolean language sql as $$select true$$;
create table if not exists eldervale_private.trades(id uuid primary key default gen_random_uuid(), a uuid, b uuid, stage text);
create table if not exists eldervale_private.tile_walkers(user_id uuid primary key, route jsonb default '[]'::jsonb, goal jsonb, step_tiles integer default 0, updated_at timestamptz default now());
create table if not exists eldervale_private.tile_flags(floor smallint, i integer, j integer, flags smallint, door_bits smallint default 0, door text, primary key(floor,i,j));
create or replace function eldervale_private.tile_of(v double precision) returns integer language sql immutable set search_path='' as $$select floor(v/1.58+.5)::integer$$;
insert into eldervale_private.realm_catalog values('item:leather','{"name":"Leather"}'),('item:fur','{"name":"Fur"}') on conflict do nothing;
-- The three Birchford NPCs the sample quest uses, and a hostile wolf.
insert into eldervale_private.realm_actors(id,data,x,z,hp) values
 ('96d6414a-90ce-4080-8515-adc6b4db298b','{"kind":"npc","name":"Sister Maud"}',-185,121.6,10),
 ('8e1013ae-c555-4aff-a4ba-8425fb7a290a','{"kind":"npc","name":"Corin the Lamplighter"}',-246.5,160,10),
 ('d1b26173-cd94-4a4f-be5f-7a4d4afa7ad8','{"kind":"npc","name":"Jory the Errand Boy"}',-222.6,90.2,10),
 ('wolf-1','{"kind":"monster","name":"Wolf","attackable":true}',-180,125,10)
on conflict(id) do nothing;
