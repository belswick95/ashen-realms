-- Eldervale tile-mode performance, part 3: unchanged heavy reply sections are not carried at all.
-- APPLY AFTER tile-perf-2.sql. Idempotent. NOT APPLIED YET (review first).
-- Every world command (about 3 per second per player) built a ~390 KB reply: quests 202 KB, shops
-- 82 KB, actors 89 KB. world_command_lean already omits a section whose md5 matches the client's
-- `have` digest (db/sync-diet.sql + sync-diet.js), but only at the very end: the full sections were
-- still copied through every request layer (jsonb `||` re-serialises the whole reply each time).
-- Now the section is dropped where it is produced:
--  * world_command_lean puts the client's `have` in a transaction setting before running the command;
--  * reply_section(key,value) returns JSON null (a 4-byte placeholder) when the client's digest
--    matches, and remembers that digest;
--  * reply_unskip() removes the placeholders after diet_reply and reports the remembered digests.
-- The reply is byte-for-byte what the lean RPC returned before: the same keys present/absent and the
-- same digests. No client change is needed: sync-diet.js already restores a section that is absent
-- with an unchanged digest. world_command (old clients) never sets `have`, so it is unchanged too.
begin;
set local lock_timeout='2s';

create or replace function eldervale_private.reply_section(k text, v jsonb) returns jsonb
language plpgsql volatile set search_path to '' as $fn$
declare have jsonb;d text;
begin
 have:=nullif(current_setting('eldervale.reply_have',true),'')::jsonb;
 if v is null or have is null or have->>k is null then return v;end if;
 d:=md5(v::text);
 if have->>k is distinct from d then return v;end if;
 perform set_config('eldervale.reply_skipped',(coalesce(nullif(current_setting('eldervale.reply_skipped',true),''),'{}')::jsonb||jsonb_build_object(k,d))::text,true);
 return 'null'::jsonb;
end $fn$;

create or replace function eldervale_private.reply_unskip(r jsonb) returns jsonb
language plpgsql volatile set search_path to '' as $fn$
declare skipped jsonb:=nullif(current_setting('eldervale.reply_skipped',true),'')::jsonb;k text;d text;gone text[]:='{}';dg jsonb:='{}'::jsonb;
begin
 if r is null or jsonb_typeof(r)<>'object' or skipped is null or skipped='{}'::jsonb then return r;end if;
 for k,d in select key,value#>>'{}' from jsonb_each(skipped) loop
  if r ? k and jsonb_typeof(r->k)='null' then gone:=gone||k;dg:=dg||jsonb_build_object(k,d);end if;
 end loop;
 if cardinality(gone)=0 then return r;end if;
 return (r-gone)||jsonb_build_object('digests',coalesce(r->'digests','{}'::jsonb)||dg);
end $fn$;
revoke all on function eldervale_private.reply_section(text,jsonb) from public,anon,authenticated;
revoke all on function eldervale_private.reply_unskip(jsonb) from public,anon,authenticated;

do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["public.world_command_lean(uuid,text,jsonb,uuid,bigint,jsonb)",
   "begin\n r:=eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor);",
   "begin\n perform set_config('eldervale.reply_have',(case when have is not null and jsonb_typeof(have)='object' and pg_column_size(have)<=4000 then have else '{}'::jsonb end)::text,true);perform set_config('eldervale.reply_skipped','',true);\n r:=eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor);"],
  ["public.world_command_lean(uuid,text,jsonb,uuid,bigint,jsonb)",
   " return eldervale_private.diet_reply(r,have,array['shops','quests','tutorial','objects','removedActors','gates','playerFloors','skillCrops','skillFires','npcDuels','gathering','professionJobs','trade']);",
   " r:=eldervale_private.reply_unskip(eldervale_private.diet_reply(r,have,array['shops','quests','tutorial','objects','removedActors','gates','playerFloors','skillCrops','skillFires','npcDuels','gathering','professionJobs','trade']));perform set_config('eldervale.reply_have','',true);return r;"],
  ["eldervale_private.realm_request_before_stories(uuid,text,jsonb,uuid,bigint)",
   "'questState',eldervale_private.quest_state(uid),'quests',eldervale_private.quest_snapshot(uid),'tutorial'",
   "'questState',eldervale_private.quest_state(uid),'quests',eldervale_private.reply_section('quests',eldervale_private.quest_snapshot(uid)),'tutorial'"],
  ["eldervale_private.quest_v2_request(uuid,text,jsonb,uuid,bigint)",
   "'questState',eldervale_private.quest_state(uid),'quests',eldervale_private.quest_snapshot(uid),'tutorial'",
   "'questState',eldervale_private.quest_state(uid),'quests',eldervale_private.reply_section('quests',eldervale_private.quest_snapshot(uid)),'tutorial'"],
  ["eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)",
   "'shops',shop_data);",
   "'shops',eldervale_private.reply_section('shops',shop_data));"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
