-- Classic look default (classic-look.js): the owner can make the low-poly retro
-- renderer the default for players who have not chosen in Settings › Graphics.
-- Stored in game_settings key 'world' next to timeOverride and published in the
-- snapshot's gameConfig. Idempotent.
begin;

create or replace function eldervale_private.public_game_config() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object(
  'timeOverride',(select g.value->'timeOverride' from eldervale_private.game_settings g where g.key='world'),
  'classicLook',coalesce((select (g.value->>'classicLook')::boolean from eldervale_private.game_settings g where g.key='world' and jsonb_typeof(g.value->'classicLook')='boolean'),false),
  'multipliers',coalesce((select g.value from eldervale_private.game_settings g where g.key='multipliers'),'{}'::jsonb))
$fn$;

do $classic$
begin
 if position('classicLook' in pg_get_functiondef('eldervale_private.admin_full_control(text,jsonb)'::regprocedure))>0 then return;end if;
 perform eldervale_private.patch_function('eldervale_private.admin_full_control(text,jsonb)'::regprocedure,array[
  $o$    if t='timeOverride' then$o$,
  $n$    if t='classicLook' then
     if jsonb_typeof(d) not in ('null','boolean') then raise exception 'Classic look default must be on or off';end if;
    elsif t='timeOverride' then$n$]);
end $classic$;

commit;
