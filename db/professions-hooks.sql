-- Surgical replacements: abort if any deployed function changed.
do $patch$declare p jsonb;body text;begin
select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) into body;
if md5(body)<>'6d8d77664280939730f8322c816658f3' then raise exception 'Profession baseline changed: world_tick';end if;
execute replace(body,$before$perform eldervale_private.gathering_tick(t);$before$,$after$perform eldervale_private.gathering_tick(t);perform eldervale_private.skill_tick(t);$after$);
select pg_get_functiondef('eldervale_private.admin_owner_base(text,jsonb)'::regprocedure) into body;
if md5(body)<>'123bef71f8eebcb88ddd3e558f0845ff' then raise exception 'Profession baseline changed: admin_owner_base';end if;
execute replace(body,$before$not in ('plaza','white_knight'$before$,$after$not in ('furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','farming_patch','hunting_ground','agility_log','thieving_stall','practice_chest','herb_patch','flax_patch','wheat_patch','berry_bush','essence_rock','plaza','white_knight'$after$);
select pg_get_functiondef('eldervale_private.item_change(uuid,text,integer,boolean)'::regprocedure) into body;
if md5(body)<>'5760af6815a8ded9c540b269aa91680c' then raise exception 'Profession baseline changed: item_change';end if;
execute replace(body,$before$if f is not null then n:=least(1,n);end if;$before$,$after$n:=least(1000000000,n);$after$);
select pg_get_functiondef('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure) into body;
if md5(body)<>'a93592ecffc0f4967956924a184e4e11' then raise exception 'Profession baseline changed: realm_request_base';end if;
execute replace(body,$before$if payload->>'direction'='deposit' and field is not null and coalesce((s.inventory->'bank'->>item)::integer,0)>0 then raise exception 'Already in bank';end if;$before$,$after$-- Bank equipment copies share an unlimited quantity stack.$after$);
select pg_get_functiondef('eldervale_private.gathering_tick(timestamptz)'::regprocedure) into body;
if md5(body)<>'cbee1b4be62477c3b15fef7dd195808a' then raise exception 'Profession baseline changed: gathering_tick';end if;
execute replace(body,$before$item_change(a.user_id,'wood',n)$before$,$after$item_change(a.user_id,eldervale_private.tree_log_item(o.data),n)$after$);
select pg_get_functiondef('eldervale_private.gathering_tick(timestamptz)'::regprocedure) into body;

execute replace(body,$before$+25*n)$before$,$after$+eldervale_private.tree_log_xp(o.data)*n)$after$);
end $patch$;
