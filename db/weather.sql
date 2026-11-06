-- Shared weather (weather.js, weather-effects.js, admin-weather.js).
--
-- Five weather regions (heartlands, birchford, fens, winterwatch, emberspire) change on a fixed
-- schedule: every slot (default 20 minutes) each region picks a kind from its weights with an
-- integer hash of (seed, region, slot). Nothing is stored per slot, so the weather is the same for
-- every player and costs a few hashes per snapshot. Clients fade between slots (fadeSeconds) and
-- blend regions at their borders. weather.js mirrors these functions exactly (scripts/weather-db).
--
-- Settings: game_settings key 'weather' = {enabled, seed, slotMinutes, fadeSeconds,
--   weights:{region:{kind:0-100}}, force:{region:{kind,intensity,until,by}}}
-- Published: gameConfig.weather = weather_public() (about 0.5 kB; it only changes at a slot
--   boundary or when the owner edits it, so the lean snapshot digest resends it rarely).
-- Console: weather_get / weather_save / weather_force / weather_clear through
--   public.world_admin -> admin_action (owner only, audited).
--
-- Soft patches: public_game_config() gains 'weather'; admin_action routes weather_* commands.
-- Re-run this file after any migration that recreates either function. Idempotent.
-- Apply after db/admin-full-control.sql (game_settings, soft_patch) and db/classic-look.sql.
begin;

insert into eldervale_private.game_settings(key,value) values
 ('weather','{"enabled":true,"seed":7331,"slotMinutes":20,"fadeSeconds":120,"weights":{},"force":{}}'::jsonb)
on conflict(key) do nothing;

create or replace function eldervale_private.weather_regions() returns text[]
language sql immutable parallel safe set search_path='' as $fn$
 select array['heartlands','birchford','fens','winterwatch','emberspire']
$fn$;

create or replace function eldervale_private.weather_kinds() returns text[]
language sql immutable parallel safe set search_path='' as $fn$
 select array['clear','cloudy','rain','storm','fog','snow','ash','haze']
$fn$;

-- Snow mostly in the north, ash and haze only near Emberspire, rain and fog most in the fens.
create or replace function eldervale_private.weather_default_weights() returns jsonb
language sql immutable parallel safe set search_path='' as $fn$
 select '{"heartlands":{"clear":40,"cloudy":24,"rain":16,"storm":5,"fog":12,"snow":3,"ash":0,"haze":0},
  "birchford":{"clear":38,"cloudy":24,"rain":20,"storm":6,"fog":12,"snow":0,"ash":0,"haze":0},
  "fens":{"clear":16,"cloudy":22,"rain":28,"storm":8,"fog":26,"snow":0,"ash":0,"haze":0},
  "winterwatch":{"clear":24,"cloudy":24,"rain":3,"storm":4,"fog":10,"snow":35,"ash":0,"haze":0},
  "emberspire":{"clear":44,"cloudy":16,"rain":2,"storm":6,"fog":0,"snow":0,"ash":16,"haze":16}}'::jsonb
$fn$;

-- 32-bit integer hash (identical to weatherHash in weather.js): all maths in bigint mod 2^32.
create or replace function eldervale_private.weather_hash(seed bigint, region integer, slot bigint, salt integer) returns bigint
language plpgsql immutable parallel safe set search_path='' as $fn$
declare h bigint;
begin
 h:=(mod(seed,4294967296)*73856093+region::bigint*19349663+mod(slot,4294967296)*83492791+salt::bigint*2654435)%4294967296;
 if h<0 then h:=h+4294967296;end if;
 h:=((h#(h>>16))*73244475)%4294967296;
 h:=((h#(h>>16))*73244475)%4294967296;
 return h#(h>>16);
end $fn$;

-- Stored settings merged over the defaults, clamped (weatherSettings in weather.js).
create or replace function eldervale_private.weather_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare s jsonb;w jsonb:='{}'::jsonb;d jsonb:=eldervale_private.weather_default_weights();r text;k text;one jsonb;
 on_off boolean:=true;seed numeric:=7331;slot_minutes numeric:=20;fade_seconds numeric:=120;
begin
 select g.value into s from eldervale_private.game_settings g where g.key='weather';
 s:=coalesce(s,'{}'::jsonb);
 foreach r in array eldervale_private.weather_regions() loop
  one:=d->r;
  foreach k in array eldervale_private.weather_kinds() loop
   if jsonb_typeof(s#>array['weights',r,k])='number' then
    one:=one||jsonb_build_object(k,greatest(0,least(100,round((s#>>array['weights',r,k])::numeric)))::integer);
   end if;
  end loop;
  w:=w||jsonb_build_object(r,one);
 end loop;
 if jsonb_typeof(s->'enabled')='boolean' then on_off:=(s->>'enabled')::boolean;end if;
 if jsonb_typeof(s->'seed')='number' then seed:=greatest(0,least(2147483647,round((s->>'seed')::numeric)));end if;
 if jsonb_typeof(s->'slotMinutes')='number' then slot_minutes:=greatest(5,least(240,round((s->>'slotMinutes')::numeric)));end if;
 if jsonb_typeof(s->'fadeSeconds')='number' then fade_seconds:=greatest(10,least(600,round((s->>'fadeSeconds')::numeric)));end if;
 return jsonb_build_object('enabled',on_off,'seed',seed::bigint,'slotMinutes',slot_minutes::integer,'fadeSeconds',fade_seconds::integer,'weights',w,
  'force',coalesce(nullif(s->'force','null'::jsonb),'{}'::jsonb));
end $fn$;

-- One region's scheduled weather in one slot: {k, i} (slotWeather in weather.js).
create or replace function eldervale_private.weather_slot(cfg jsonb, region text, slot bigint) returns jsonb
language plpgsql immutable set search_path='' as $fn$
declare w jsonb:=cfg->'weights'->region;total bigint:=0;r bigint;k text;n bigint;ri integer:=array_position(eldervale_private.weather_regions(),region);seed bigint:=(cfg->>'seed')::bigint;picked text:='clear';
begin
 if w is null or ri is null then return jsonb_build_object('k','clear','i',1);end if;
 foreach k in array eldervale_private.weather_kinds() loop total:=total+coalesce((w->>k)::bigint,0);end loop;
 if total=0 then return jsonb_build_object('k','clear','i',1);end if;
 r:=eldervale_private.weather_hash(seed,ri,slot,0)%total;
 foreach k in array eldervale_private.weather_kinds() loop
  n:=coalesce((w->>k)::bigint,0);
  if r<n then picked:=k;exit;end if;
  r:=r-n;
 end loop;
 return jsonb_build_object('k',picked,'i',round((45+eldervale_private.weather_hash(seed,ri,slot,1)%56)/100.0,2));
end $fn$;

-- The summary published as gameConfig.weather (publicWeather in weather.js).
create or replace function eldervale_private.weather_public(at_time timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare cfg jsonb:=eldervale_private.weather_settings();span bigint;n bigint;r text;c jsonb;p jsonb;x jsonb;f jsonb;until_ms bigint;out jsonb:='{}'::jsonb;one jsonb;now_ms bigint;
begin
 if not (cfg->>'enabled')::boolean then return jsonb_build_object('on',false);end if;
 span:=(cfg->>'slotMinutes')::bigint*60;
 now_ms:=floor(extract(epoch from at_time)*1000)::bigint;
 n:=floor(now_ms/1000.0/span)::bigint;
 foreach r in array eldervale_private.weather_regions() loop
  c:=eldervale_private.weather_slot(cfg,r,n);p:=eldervale_private.weather_slot(cfg,r,n-1);x:=eldervale_private.weather_slot(cfg,r,n+1);
  one:=jsonb_build_object('k',c->'k','i',c->'i','pk',p->'k','pi',p->'i','nk',x->'k','ni',x->'i');
  f:=cfg->'force'->r;
  if jsonb_typeof(f)='object' and f->>'kind'=any(eldervale_private.weather_kinds()) and coalesce(f->>'until','')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' then
   until_ms:=floor(extract(epoch from (f->>'until')::timestamptz)*1000)::bigint;
   if until_ms>now_ms then
    one:=one||jsonb_build_object('fk',f->>'kind','fi',greatest(0.1,least(1,coalesce((f->>'intensity')::numeric,0.8))),'fu',until_ms);
   end if;
  end if;
  out:=out||jsonb_build_object(r,one);
 end loop;
 return jsonb_build_object('on',true,'seed',(cfg->>'seed')::bigint,'slot',span,'fade',(cfg->>'fadeSeconds')::integer,'start',n*span*1000,'regions',out);
end $fn$;

-- Upcoming slots for the console: {region:[{start,k,i}...]}.
create or replace function eldervale_private.weather_forecast(at_time timestamptz default now(), slots integer default 6) returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare cfg jsonb:=eldervale_private.weather_settings();span bigint:=(cfg->>'slotMinutes')::bigint*60;n bigint;r text;list jsonb;out jsonb:='{}'::jsonb;s jsonb;
begin
 n:=floor(extract(epoch from at_time)/span)::bigint;
 foreach r in array eldervale_private.weather_regions() loop
  list:='[]'::jsonb;
  for j in 0..greatest(1,least(slots,24))-1 loop
   s:=eldervale_private.weather_slot(cfg,r,n+j);
   list:=list||jsonb_build_array(s||jsonb_build_object('start',(n+j)*span*1000));
  end loop;
  out:=out||jsonb_build_object(r,list);
 end loop;
 return out;
end $fn$;

-- Owner console commands (owner only, audited).
create or replace function eldervale_private.admin_weather(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare old jsonb;v jsonb;k text;d jsonb;r text;kind text;one jsonb;regions text[];n numeric;mins numeric;intensity numeric;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid weather payload';end if;
 if pg_column_size(payload)>16384 then raise exception 'Weather payload too large';end if;
 select g.value into old from eldervale_private.game_settings g where g.key='weather';
 old:=coalesce(old,'{}'::jsonb);v:=old;
 if command='weather_get' then
  return jsonb_build_object('stored',old,'settings',eldervale_private.weather_settings(),'defaults',eldervale_private.weather_default_weights(),
   'regions',to_jsonb(eldervale_private.weather_regions()),'kinds',to_jsonb(eldervale_private.weather_kinds()),
   'now',eldervale_private.weather_public(now()),'forecast',eldervale_private.weather_forecast(now(),least(24,greatest(1,coalesce((payload->>'slots')::integer,6)))),
   'serverTime',now());
 elsif command='weather_save' then
  for k,d in select key,value from jsonb_each(payload) loop
   if k='enabled' then
    if jsonb_typeof(d)<>'boolean' then raise exception 'Weather on/off must be true or false';end if;
   elsif k='seed' then
    if jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 2147483647 or (d#>>'{}')::numeric<>round((d#>>'{}')::numeric) then raise exception 'Seed must be a whole number 0–2147483647';end if;
   elsif k='slotMinutes' then
    if jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 5 and 240 then raise exception 'Weather changes every 5–240 minutes';end if;
   elsif k='fadeSeconds' then
    if jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 10 and 600 then raise exception 'Fades last 10–600 seconds';end if;
   elsif k='weights' then
    if jsonb_typeof(d)<>'object' then raise exception 'Weights must be an object of regions';end if;
    for r,one in select key,value from jsonb_each(d) loop
     if not (r=any(eldervale_private.weather_regions())) or jsonb_typeof(one)<>'object' then raise exception 'Unknown weather region %',r;end if;
     for kind,n in select key,(value#>>'{}')::numeric from jsonb_each(one) where jsonb_typeof(value)='number' loop
      if not (kind=any(eldervale_private.weather_kinds())) or n not between 0 and 100 then raise exception 'Weight % in % must be 0–100',kind,r;end if;
     end loop;
     if exists(select 1 from jsonb_each(one) where jsonb_typeof(value)<>'number') then raise exception 'Weights in % must be numbers',r;end if;
    end loop;
   else raise exception 'Unknown weather setting %',k;
   end if;
   v:=v||jsonb_build_object(k,d);
  end loop;
 elsif command='weather_force' then
  r:=coalesce(payload->>'region','all');kind:=payload->>'kind';
  if not (kind=any(eldervale_private.weather_kinds())) then raise exception 'Choose a weather kind';end if;
  if r<>'all' and not (r=any(eldervale_private.weather_regions())) then raise exception 'Unknown weather region %',r;end if;
  mins:=coalesce((payload->>'minutes')::numeric,30);intensity:=coalesce((payload->>'intensity')::numeric,0.8);
  if mins not between 1 and 1440 then raise exception 'Force weather for 1–1440 minutes';end if;
  if intensity not between 0.1 and 1 then raise exception 'Intensity must be 0.1–1';end if;
  regions:=(select coalesce(array_agg(x),'{}') from unnest(eldervale_private.weather_regions()) x where r='all' or x=r);
  one:=jsonb_build_object('kind',kind,'intensity',round(intensity,2),'until',to_char((now()+make_interval(secs=>(mins*60)::double precision)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'by',auth.uid());
  d:=coalesce(nullif(v->'force','null'::jsonb),'{}'::jsonb);
  foreach r in array regions loop d:=d||jsonb_build_object(r,one);end loop;
  v:=v||jsonb_build_object('force',d);
 elsif command='weather_clear' then
  r:=coalesce(payload->>'region','all');
  if r<>'all' and not (r=any(eldervale_private.weather_regions())) then raise exception 'Unknown weather region %',r;end if;
  d:=coalesce(nullif(v->'force','null'::jsonb),'{}'::jsonb);
  if r='all' then d:='{}'::jsonb;else d:=d-r;end if;
  v:=v||jsonb_build_object('force',d);
 else
  raise exception 'Unknown weather command %',command;
 end if;
 insert into eldervale_private.game_settings(key,value,updated_at,updated_by) values('weather',v,now(),auth.uid())
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'weather',old,v);
 return jsonb_build_object('stored',v,'settings',eldervale_private.weather_settings(),'now',eldervale_private.weather_public(now()));
end $fn$;

revoke all on function eldervale_private.weather_regions(),eldervale_private.weather_kinds(),eldervale_private.weather_default_weights(),
 eldervale_private.weather_hash(bigint,integer,bigint,integer),eldervale_private.weather_settings(),eldervale_private.weather_slot(jsonb,text,bigint),
 eldervale_private.weather_public(timestamptz),eldervale_private.weather_forecast(timestamptz,integer),eldervale_private.admin_weather(text,jsonb)
from public,anon,authenticated;

-- gameConfig.weather for every client (lean snapshots resend it only when it changes).
select eldervale_private.soft_patch('eldervale_private.public_game_config()','weather_public',array[
 'select jsonb_build_object(',
 'select jsonb_build_object(''weather'',eldervale_private.weather_public())||jsonb_build_object(']);

-- weather_* console commands reach their handler ahead of the other console handlers.
select eldervale_private.soft_patch('eldervale_private.admin_action(text,jsonb)','admin_weather',array[
 'if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;',
 'if command like ''weather\_%'' then return eldervale_private.admin_weather(command,payload);end if;
 if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;']);

commit;
