-- OSRS-style backpack order (client: inventory-order.js).
-- Adds an 'inventory_order' world command that stores where each backpack item sits
-- in public.player_saves.game_flags.inventoryOrder: a JSON array of at most
-- inventory_capacity() (28) entries, each null or an item id such as 'wood',
-- 'note:wood' or 'armor:bronzeHelm'. The server only stores the order; it never
-- reads it to grant, move or count items, so a stale or edited order cannot add,
-- remove or duplicate anything. The client places the real items from the save into
-- the remembered slots (new items fill the first empty slot, used-up items leave a gap).
-- Every other server function that writes game_flags merges into it (||), so the key survives.
--
-- Idempotent: the command function is create-or-replace, and the realm_request hook is
-- applied only while its marker (inventory_order_command) is absent.
--
-- Dry run (compiles a realm_request_probe copy and changes nothing the game calls):
--   select eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
--    $o$ if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$o$,
--    $n$ if command='inventory_order' then return eldervale_private.inventory_order_command($1,$2,$3,$4,$5);end if;
--  if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$n$],true);
-- (afterwards the realm_request_probe function can be left or removed by hand.)
-- Check after applying:
--   select position('inventory_order_command' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))>0;

create or replace function eldervale_private.inventory_order_command(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint)
 returns jsonb language plpgsql security definer set search_path='' as $f$
declare ord jsonb;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>4000 or request_id is null then raise exception 'Invalid request';end if;
 ord:=payload->'order';
 if ord is null or jsonb_typeof(ord)<>'array' or jsonb_array_length(ord)>eldervale_private.inventory_capacity() then raise exception 'Invalid inventory order';end if;
 if exists(select 1 from jsonb_array_elements(ord) e(v)
   where not (jsonb_typeof(v)='null' or jsonb_typeof(v)='string' and (v#>>'{}') ~ '^[A-Za-z0-9][A-Za-z0-9_:.-]{0,63}$')) then
  raise exception 'Invalid inventory order';
 end if;
 -- Same lock order as every other command (advisory lock before row locks).
 perform pg_advisory_xact_lock(736211);
 if not exists(select 1 from eldervale_private.realm_players p where p.user_id=auth.uid() and p.session_id=$1) then raise exception 'Session expired';end if;
 if not exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then
  update public.player_saves set game_flags=coalesce(game_flags,'{}'::jsonb)||jsonb_build_object('inventoryOrder',ord) where user_id=auth.uid();
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}'::jsonb);
 end if;
 -- The normal sync checks the session, maintenance and moderation; if it refuses, the
 -- whole command (including the update above) rolls back.
 return eldervale_private.realm_request($1,'sync','{}'::jsonb,null,$5);
end $f$;
revoke all on function eldervale_private.inventory_order_command(uuid,text,jsonb,uuid,bigint) from public;

do $do$
begin
 if position('inventory_order_command' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   $o$ if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$o$,
   $n$ if command='inventory_order' then return eldervale_private.inventory_order_command($1,$2,$3,$4,$5);end if;
 if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$n$]);
 end if;
end $do$;
