-- Building signs (building-signs.js): owner overrides for the in-world signs.
-- Every building with a trade gets a default sign on the client (hanging board, wall plaque for
-- civic buildings) and every town entrance a default signpost; this table only stores what the
-- owner changed in the Game console (Build > Signs): text, icon, style, paint and enabled, plus a
-- position and arms for signposts. Rows are keyed by the building's world entity id, or
-- "post:<key>" for signposts. An emptied row ({}) means "back to the default".
--
-- Reads: public.building_signs() for every signed-in player (one call when the world loads).
-- Writes: sign_list / sign_save / sign_reset through public.world_admin -> admin_action, owner
-- checked and audited like every other console command.
-- Idempotent and non-destructive: safe to re-run. Apply after db/admin-full-control.sql.

create table if not exists eldervale_private.building_signs(
 id text primary key check (id ~ '^[A-Za-z0-9:_.@-]{1,80}$'),
 data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object'),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
revoke all on table eldervale_private.building_signs from public,anon,authenticated;

-- Validates one sign override and returns it with only the known keys.
create or replace function eldervale_private.sign_clean(d jsonb) returns jsonb
language plpgsql immutable set search_path='' as $fn$
declare res jsonb:='{}'::jsonb;k text;a jsonb;arms jsonb:='[]'::jsonb;
 icons constant text[]:=array['none','anvil','loaf','potion','sword','shield','bow','staff','coin','mug','bed','fish','needle','pickaxe','bell','crown','hammer'];
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>4000 then raise exception 'Sign data must be an object under 4 KB';end if;
 for k in select jsonb_object_keys(d) loop
  if not k=any(array['text','icon','style','paint','enabled','x','z','yaw','arms','name']) then raise exception 'Unknown sign field %',k;end if;
 end loop;
 if d?'text' then
  if jsonb_typeof(d->'text')<>'string' or length(d->>'text')>40 then raise exception 'Sign text is limited to 40 characters';end if;
  res:=res||jsonb_build_object('text',regexp_replace(trim(d->>'text'),'\s+',' ','g'));
 end if;
 if d?'name' then
  if jsonb_typeof(d->'name')<>'string' or length(d->>'name')>60 then raise exception 'Sign name is limited to 60 characters';end if;
  res:=res||jsonb_build_object('name',trim(d->>'name'));
 end if;
 if d?'icon' then
  if not coalesce(d->>'icon','')=any(icons) then raise exception 'Unknown sign icon %',d->>'icon';end if;
  res:=res||jsonb_build_object('icon',d->>'icon');
 end if;
 if d?'style' then
  if coalesce(d->>'style','') not in ('hanging','plaque','post') then raise exception 'Sign style must be hanging, plaque or post';end if;
  res:=res||jsonb_build_object('style',d->>'style');
 end if;
 if d?'paint' then
  if coalesce(d->>'paint','') not in ('oak','green','red','blue','black') then raise exception 'Sign paint must be oak, green, red, blue or black';end if;
  res:=res||jsonb_build_object('paint',d->>'paint');
 end if;
 if d?'enabled' then
  if jsonb_typeof(d->'enabled')<>'boolean' then raise exception 'Enabled must be true or false';end if;
  res:=res||jsonb_build_object('enabled',d->'enabled');
 end if;
 foreach k in array array['x','z','yaw'] loop
  if d?k then
   if jsonb_typeof(d->k)<>'number' or abs((d->>k)::numeric)>5000 then raise exception 'Sign % must be a number',k;end if;
   res:=res||jsonb_build_object(k,round((d->>k)::numeric,2));
  end if;
 end loop;
 if d?'arms' then
  if jsonb_typeof(d->'arms')<>'array' or jsonb_array_length(d->'arms')>3 then raise exception 'A signpost has up to 3 arms';end if;
  for a in select value from jsonb_array_elements(d->'arms') loop
   if jsonb_typeof(a)<>'object' or jsonb_typeof(a->'text')<>'string' or length(a->>'text') not between 1 and 28 then raise exception 'Each arm needs 1-28 characters of text';end if;
   if a?'icon' and not coalesce(a->>'icon','')=any(icons) then raise exception 'Unknown arm icon %',a->>'icon';end if;
   if jsonb_typeof(a->'toX')<>'number' or jsonb_typeof(a->'toZ')<>'number' then raise exception 'Each arm needs a toX/toZ destination';end if;
   arms:=arms||jsonb_build_array(jsonb_build_object('text',trim(a->>'text'),'icon',coalesce(a->>'icon','none'),'toX',round((a->>'toX')::numeric,2),'toZ',round((a->>'toZ')::numeric,2)));
  end loop;
  res:=res||jsonb_build_object('arms',arms);
 end if;
 return res;
end $fn$;

-- Every override, for the game client. Empty rows (reset to default) are left out.
create or replace function public.building_signs() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select coalesce(jsonb_object_agg(s.id,s.data),'{}'::jsonb) from eldervale_private.building_signs s where s.data<>'{}'::jsonb
$fn$;
revoke all on function public.building_signs() from public,anon;
grant execute on function public.building_signs() to authenticated;

-- Owner console commands: sign_list, sign_save {id,data}, sign_reset {id}.
create or replace function eldervale_private.admin_building_signs(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare sid text;before jsonb;after jsonb;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>8000 then raise exception 'Invalid sign payload';end if;
 if command='sign_list' then
  return coalesce((select jsonb_object_agg(s.id,jsonb_build_object('data',s.data,'updatedAt',s.updated_at)) from eldervale_private.building_signs s),'{}'::jsonb);
 end if;
 sid:=payload->>'id';
 if sid is null or sid!~'^[A-Za-z0-9:_.@-]{1,80}$' then raise exception 'Choose a sign';end if;
 select s.data into before from eldervale_private.building_signs s where s.id=sid;
 if command='sign_save' then
  after:=eldervale_private.sign_clean(payload->'data');
 elsif command='sign_reset' then
  after:='{}'::jsonb;
 else
  raise exception 'Unknown sign command %',command;
 end if;
 insert into eldervale_private.building_signs(id,data,updated_at,updated_by) values(sid,after,now(),auth.uid())
  on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,sid,before,after);
 return jsonb_build_object('id',sid,'data',after);
end $fn$;
revoke all on function eldervale_private.sign_clean(jsonb),eldervale_private.admin_building_signs(text,jsonb) from public,anon,authenticated;

-- sign_* commands reach their handler ahead of the other console handlers (soft patch: skips with
-- a NOTICE if admin_action was reshaped by a later migration; re-run this file afterwards).
select eldervale_private.soft_patch('eldervale_private.admin_action(text,jsonb)','admin_building_signs',array[
 'if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;',
 'if command like ''sign\_%'' then return eldervale_private.admin_building_signs(command,payload);end if;
 if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;']);
