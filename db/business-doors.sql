-- Business and castle doors stay open (RuneScape style): the castle's great gate,
-- banks, and every building where a core service works (a banker, merchant,
-- smith, innkeeper or healer stands inside, or a crafting/prayer station is
-- inside). Players cannot close them; the client offers only Examine.
-- Mirrors business-doors.js. Safe to run more than once.

create or replace function eldervale_private.door_held_open(door_id text)
returns boolean language sql stable set search_path='' as $fn$
 select exists(
  select 1 from eldervale_private.realm_objects d
  cross join lateral (select coalesce((d.data->>'yaw')::float8,0)*(case when d.data ? 'scaleX' then 1 else pi()/180 end) q,
                             coalesce((d.data->>'scaleX')::float8,1.3*coalesce((d.data->>'scale')::float8,1)) sx,
                             coalesce((d.data->>'scaleZ')::float8,1.3*coalesce((d.data->>'scale')::float8,1)) sz) f
  where d.id=door_id and (
   d.kind='castle_gate' or d.data->>'template'='castle_gate' or d.data->>'template'='bank'
   or (d.kind='door' and (
    exists(select 1 from eldervale_private.realm_actors a where not a.deleted and a.data->>'role' in ('banker','merchant','smith','innkeeper','healer')
           and abs(((a.x-d.x)*cos(f.q)-(a.z-d.z)*sin(f.q))/f.sx)<1.65 and abs(((a.x-d.x)*sin(f.q)+(a.z-d.z)*cos(f.q))/f.sz)<1.57)
    or exists(select 1 from eldervale_private.realm_objects o where o.id<>d.id and o.data->>'template' in ('altar','rune_altar','hearth','furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','practice_chest','thieving_stall','essence_rock','cooking_tripod')
           and abs(((o.x-d.x)*cos(f.q)-(o.z-d.z)*sin(f.q))/f.sx)<1.65 and abs(((o.x-d.x)*sin(f.q)+(o.z-d.z)*cos(f.q))/f.sz)<1.57)))))
$fn$;
revoke all on function eldervale_private.door_held_open(text) from public,anon,authenticated;

-- The door toggle in the world tick: held-open doors only ever open.
select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
 $o$if o.kind in ('door','castle_gate') then update eldervale_private.realm_objects set open=not open where id=sid;$o$,
 $n$if o.kind in ('door','castle_gate') and eldervale_private.door_held_open(sid) then update eldervale_private.realm_objects set open=true where id=sid and not open;perform eldervale_private.emit(jsonb_build_object('type','door','target',sid,'player',p.user_id,'open',true));
     elsif o.kind in ('door','castle_gate') then update eldervale_private.realm_objects set open=not open where id=sid;$n$
]);

-- Open every held-open door now (idempotent); lists the doors it changed.
update eldervale_private.realm_objects o set open=true
 where o.kind in ('door','castle_gate') and not o.open and eldervale_private.door_held_open(o.id)
 returning o.id, o.kind, o.data->>'name' as name;
