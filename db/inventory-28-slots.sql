-- RuneScape-sized backpack: 16 -> 28 inventory slots.
-- The client mirrors this as INVENTORY_SLOTS in economy.js. Every server limit now reads
-- eldervale_private.inventory_capacity(), so a later change is one line.
-- Found by scanning every live eldervale_private function for the literal 16 next to
-- inventory_used(...) / the trade offer key count / carried-equipment amount (Nov 2026):
-- gathering (tick + error), skill_finish (cooking/crafting results), ground pickup, shop buy
-- (base + merchant stock), bank withdraw (items + notes), farm harvest, mount unequip,
-- quest/story rewards, player trade (offer validation + completion), admin grants, item_change.
-- Existing saves are untouched: a larger cap never removes items.
-- Each edit goes through eldervale_private.patch_function, which refuses any anchor that does
-- not match exactly once, so re-running after success fails loudly instead of double-patching.

create or replace function eldervale_private.inventory_capacity()
returns integer language sql immutable parallel safe set search_path='' as $fn$ select 28 $fn$;
revoke all on function eldervale_private.inventory_capacity() from public,anon,authenticated;

-- Admin "add to inventory" grant.
select eldervale_private.patch_function('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure,array[
 $a$eldervale_private.inventory_used(uid)>16 then raise exception 'Inventory full. Free slots$a$,
 $a$eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Inventory full. Free slots$a$]);

-- Gathering start check (woodcutting, mining, fishing; bait-only rod catches still allowed).
select eldervale_private.patch_function('eldervale_private.gathering_error_before_professions(uuid,text,text)'::regprocedure,array[
 $a$eldervale_private.inventory_used(uid)>=16 and not(method='rod'$a$,
 $a$eldervale_private.inventory_used(uid)>=eldervale_private.inventory_capacity() and not(method='rod'$a$]);

-- Gathering tick: how many more resources fit.
select eldervale_private.patch_function('eldervale_private.gathering_tick(timestamp with time zone)'::regprocedure,array[
 $a$capacity:=greatest(0,16-eldervale_private.inventory_used(a.user_id))$a$,
 $a$capacity:=greatest(0,eldervale_private.inventory_capacity()-eldervale_private.inventory_used(a.user_id))$a$]);

-- Carried equipment uses one slot per copy, so no single grant can exceed the backpack.
select eldervale_private.patch_function('eldervale_private.item_change(uuid,text,integer,boolean)'::regprocedure,array[
 $a$if amount>16 then raise exception 'Carried equipment uses one slot per copy'$a$,
 $a$if amount>eldervale_private.inventory_capacity() then raise exception 'Carried equipment uses one slot per copy'$a$]);

-- Ground item pickup.
select eldervale_private.patch_function('eldervale_private.pickup(uuid)'::regprocedure,array[
 $a$eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Inventory full. Free space before collecting this item'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>eldervale_private.inventory_capacity() then raise exception 'Inventory full. Free space before collecting this item'$a$]);

-- Base realm requests: mount unequip, bank withdraw room, base shop buy.
select eldervale_private.patch_function('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$eldervale_private.inventory_used(auth.uid())>=16 then raise exception 'Free an inventory slot before removing the mount'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>=eldervale_private.inventory_capacity() then raise exception 'Free an inventory slot before removing the mount'$a$,
 $a$eldervale_private.inventory_used(auth.uid())<16) then amount else greatest(0,16-coalesce(eldervale_private.inventory_used(auth.uid()),0))$a$,
 $a$eldervale_private.inventory_used(auth.uid())<eldervale_private.inventory_capacity()) then amount else greatest(0,eldervale_private.inventory_capacity()-coalesce(eldervale_private.inventory_used(auth.uid()),0))$a$,
 $a$coalesce(eldervale_private.inventory_used(auth.uid()),0)>=16 then raise exception 'Inventory full'$a$,
 $a$coalesce(eldervale_private.inventory_used(auth.uid()),0)>=eldervale_private.inventory_capacity() then raise exception 'Inventory full'$a$]);

-- Farm harvest.
select eldervale_private.patch_function('eldervale_private.realm_request_before_bank_notes(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$n:=least(crop.amount,greatest(0,16-eldervale_private.inventory_used(auth.uid())))$a$,
 $a$n:=least(crop.amount,greatest(0,eldervale_private.inventory_capacity()-eldervale_private.inventory_used(auth.uid())))$a$]);

-- Fishing with multiple bait, merchant shop buy (stocked shops).
select eldervale_private.patch_function('eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$eldervale_private.inventory_used(auth.uid())>=16 and (s.stats->>'bait')::integer>1$a$,
 $a$eldervale_private.inventory_used(auth.uid())>=eldervale_private.inventory_capacity() and (s.stats->>'bait')::integer>1$a$,
 $a$if used>=16 and not($a$,
 $a$if used>=eldervale_private.inventory_capacity() and not($a$]);

-- Player trade completion and the post-action full check.
select eldervale_private.patch_function('eldervale_private.realm_request_before_controls(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$eldervale_private.inventory_used(who)>16 then raise exception 'A player needs more inventory space'$a$,
 $a$eldervale_private.inventory_used(who)>eldervale_private.inventory_capacity() then raise exception 'A player needs more inventory space'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Your inventory is full'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>eldervale_private.inventory_capacity() then raise exception 'Your inventory is full'$a$]);

-- Bank withdraw (items and notes) and its final check.
select eldervale_private.patch_function('eldervale_private.realm_request_before_quests(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$eldervale_private.inventory_used(auth.uid())<16 then 1000000000$a$,
 $a$eldervale_private.inventory_used(auth.uid())<eldervale_private.inventory_capacity() then 1000000000$a$,
 $a$room:=greatest(0,16-eldervale_private.inventory_used(auth.uid()))$a$,
 $a$room:=greatest(0,eldervale_private.inventory_capacity()-eldervale_private.inventory_used(auth.uid()))$a$,
 $a$eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Inventory full'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>eldervale_private.inventory_capacity() then raise exception 'Inventory full'$a$]);

-- Quest / story rewards.
select eldervale_private.patch_function('eldervale_private.realm_request_before_stories(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $a$eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Make inventory space for the rewards'$a$,
 $a$eldervale_private.inventory_used(auth.uid())>eldervale_private.inventory_capacity() then raise exception 'Make inventory space for the rewards'$a$]);

-- Profession results (cooking, smithing, crafting...).
select eldervale_private.patch_function('eldervale_private.skill_finish(uuid,jsonb,text,uuid,timestamp with time zone)'::regprocedure,array[
 $a$eldervale_private.inventory_used(uid)>16 then raise exception 'Inventory full. Free space before continuing.'$a$,
 $a$eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Inventory full. Free space before continuing.'$a$]);

-- Trade offers may list as many item types as a full backpack holds.
select eldervale_private.patch_function('eldervale_private.validate_offer(uuid,jsonb)'::regprocedure,array[
 $a$from jsonb_object_keys(offer->'items'))>16 then raise exception 'Invalid trade offer'$a$,
 $a$from jsonb_object_keys(offer->'items'))>eldervale_private.inventory_capacity() then raise exception 'Invalid trade offer'$a$]);

-- Check: no live inventory limit still hard-codes 16 (expect zero rows).
select p.oid::regprocedure as leftover_16_limit from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='eldervale_private' and p.prokind='f'
  and pg_get_functiondef(p.oid) ~ '(inventory_used\([^)]*\)\)?(,0\))?\s*[<>]=?\s*16\M|\m16-(coalesce\()?eldervale_private\.inventory_used|jsonb_object_keys\(offer->''items''\)\)>16|amount>16 then)';
