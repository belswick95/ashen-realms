-- Skills and professions cap at level 99. Combat level is the attack/defence/strength average,
-- capped at 99, and becomes 100 only when attack, strength, defence, ranged and magic are all 99.
-- Level from XP is unchanged: 1+floor(sqrt(xp/50)); level 99 needs 480,200 XP.
create or replace function eldervale_private.combat_level(skills jsonb)
returns integer language sql immutable set search_path='' as $fn$
 with l as (select k,least(99,1+floor(sqrt(greatest(0,coalesce((skills->>k)::numeric,0))/50)))::integer v
  from unnest(array['attackXP','defenceXP','strengthXP','rangedXP','magicXP']) k)
 select case when (select min(v) from l)>=99 then 100
  else least(99,greatest(1,floor(((select v from l where k='attackXP')+(select v from l where k='defenceXP')+(select v from l where k='strengthXP'))/3.0)))::integer end
$fn$;

select eldervale_private.patch_function('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure,array[
$a$n not between 1 and 100 then raise exception 'Choose a skill and a level from 1 to 100'$a$,
$a$n not between 1 and 99 then raise exception 'Choose a skill and a level from 1 to 99'$a$]);

select eldervale_private.patch_function('eldervale_private.admin_console(text,jsonb)'::regprocedure,array[
$a$jsonb_object_agg(x,greatest(490050,coalesce((skills->>x)$a$,$a$jsonb_object_agg(x,greatest(480200,coalesce((skills->>x)$a$,
$a$jsonb_object_agg(x,greatest(490050,coalesce((stats->>x)$a$,$a$jsonb_object_agg(x,greatest(480200,coalesce((stats->>x)$a$]);

update public.player_saves set level=eldervale_private.combat_level(skills) where level is distinct from eldervale_private.combat_level(skills);
