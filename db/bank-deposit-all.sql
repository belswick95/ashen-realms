-- OSRS-style "Deposit inventory" (client: bank-ui.js, economy.js depositInventory).
-- One server command moves every backpack item into the bank in a single transaction:
--   world_command(session, 'bank', '{"direction":"deposit_all"}', request_id, cursor)
-- It rides the existing 'bank' command in eldervale_private.realm_request_before_quests, so it
-- gets the same session check, bank/banker proximity check, advisory lock, request-id replay
-- protection, skilling stop and final inventory check as a single-item deposit.
--
-- Rules (the same as one "Deposit all" per item, applied to every item at once):
--  * Worn gear stays worn: equipment_reserved() keeps the equipped copy, spare copies go.
--  * Bank notes deposit as the original item (item_change(..., bank=true) un-notes them),
--    stacking into the existing bank stack.
--  * Bank capacity: storage is unlimited by item type, but each bank stack is capped at
--    1,000,000,000 (item_change). An item deposits only what fits in its stack; the rest
--    stays in the backpack, is returned under "kept", and a chat notice names it.
--  * Nothing is created or lost: every move is item_change(-n) on the backpack followed by
--    item_change(+n, bank) for the same n, and any error rolls the whole command back.
--  * game_flags.inventoryOrder (inventory-order.js) keeps only the slots of items that are
--    still carried; with everything deposited it becomes 28 empty slots.
--
-- Idempotent: the helper is create-or-replace, and the realm_request_before_quests hook is
-- patched only while its marker (bank_deposit_all) is absent from the function body.
--
-- Dry run (compiles realm_request_before_quests_probe; nothing the game calls changes):
--   select eldervale_private.patch_function('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure,
--    <the same two old/new pairs as below>, true);
-- or run this whole file inside  begin; ... rollback;  and inspect the result of the check below.
-- Check after applying (expect true):
--   select position('bank_deposit_all' in pg_get_functiondef('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure))>0;

create or replace function eldervale_private.bank_deposit_all(uid uuid)
returns jsonb language plpgsql set search_path='' as $fn$
declare s public.player_saves;r record;c jsonb;base text;available integer;banked integer;n integer;moved integer:=0;
 deposited jsonb:='{}'::jsonb;kept jsonb:='{}'::jsonb;ord jsonb;names text;
begin
 select * into s from public.player_saves where user_id=uid for update;
 if s.user_id is null then raise exception 'Character not found';end if;
 -- Every item the backpack holds: stackable/plain items in stats, gear copies in the owned arrays.
 for r in
  select substring(cat.id from 6) item from jsonb_each_text(coalesce(s.stats,'{}'::jsonb)) st
   join eldervale_private.realm_catalog cat on cat.id='item:'||st.key
   where not(cat.data?'field') and cat.id<>'item:gold' and st.value ~ '^[0-9]+$' and st.value::numeric>0
  union
  select substring(cat.id from 6) from jsonb_each(coalesce(s.inventory,'{}'::jsonb)) f
   cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.value)='array' then f.value else '[]'::jsonb end) v
   join eldervale_private.realm_catalog cat on cat.data->>'field'=f.key and cat.data->>'key'=v.value
   where f.key in ('armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned')
  order by 1
 loop
  select data into c from eldervale_private.realm_catalog where id='item:'||r.item;
  available:=greatest(0,coalesce(eldervale_private.item_quantity(uid,r.item),0)-coalesce(eldervale_private.equipment_reserved(uid,c),0));
  if available<1 then continue;end if;
  base:=coalesce(c->>'noteOf',r.item);
  if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||base) then
   kept:=kept||jsonb_build_object(r.item,available);continue;
  end if;
  select coalesce((inventory->'bank'->>base)::integer,0) into banked from public.player_saves where user_id=uid;
  n:=least(available,greatest(0,1000000000-banked));
  if n>0 then
   perform eldervale_private.item_change(uid,r.item,-n);
   perform eldervale_private.item_change(uid,base,n,true);
   deposited:=deposited||jsonb_build_object(r.item,n);moved:=moved+n;
  end if;
  if n<available then kept:=kept||jsonb_build_object(r.item,available-n);end if;
 end loop;
 if moved=0 then
  if kept='{}'::jsonb then raise exception 'Your backpack has nothing to deposit';end if;
  raise exception 'Your bank cannot hold any more of those items';
 end if;
 -- Backpack slot order: slots of deposited items become empty, items still carried keep theirs.
 select game_flags->'inventoryOrder' into ord from public.player_saves where user_id=uid;
 if jsonb_typeof(ord)='array' or kept='{}'::jsonb then
  update public.player_saves set game_flags=coalesce(game_flags,'{}'::jsonb)||jsonb_build_object('inventoryOrder',
   case when jsonb_typeof(ord)='array' then
    (select coalesce(jsonb_agg(case when jsonb_typeof(e)='string' and kept?(e#>>'{}') then e else 'null'::jsonb end order by i),'[]'::jsonb) from jsonb_array_elements(ord) with ordinality x(e,i))
   else (select jsonb_agg('null'::jsonb) from generate_series(1,eldervale_private.inventory_capacity())) end)
  where user_id=uid;
 end if;
 if kept<>'{}'::jsonb then
  select string_agg(coalesce(cat.data->>'name',k.key)||' ×'||k.value,', ' order by k.key) into names
   from jsonb_each_text(kept) k left join eldervale_private.realm_catalog cat on cat.id='item:'||k.key;
  perform eldervale_private.emit(jsonb_build_object('type','skill_notice','player',uid,'text','Your bank could not hold everything. Still carried: '||names||'.'));
 end if;
 return jsonb_build_object('deposited',deposited,'kept',kept,'moved',moved);
end $fn$;
revoke all on function eldervale_private.bank_deposit_all(uuid) from public,anon,authenticated;

-- Hook: direction 'deposit_all' skips the single-item lookup; every other bank request is unchanged.
do $do$
begin
 if position('bank_deposit_all' in pg_get_functiondef('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   $o$ item:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown bank item';end if;$o$,
   E' if payload->>\'direction\'=\'deposit_all\' then perform eldervale_private.bank_deposit_all(auth.uid());\n'
   || E' else\n'
   || $n$ item:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown bank item';end if;$n$,
   $o$ else raise exception 'Choose deposit or withdraw';end if;$o$,
   $n$ else raise exception 'Choose deposit or withdraw';end if;$n$
   || E'\n end if;']);
 end if;
end $do$;

-- Check (expect true).
select position('bank_deposit_all' in pg_get_functiondef('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure))>0 as bank_deposit_all_installed;
