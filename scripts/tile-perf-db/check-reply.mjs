// Behavioural check of db/tile-perf-3.sql (heavy reply sections skipped where they are produced) on PGlite.
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node --import ./tests/helpers/preload.js scripts/tile-perf-db/check-reply.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// Live functions are stand-ins carrying the live anchor text; the client side is the real sync-diet.js.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createSyncDiet} from '../../sync-diet.js';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,p=[])=>(await db.query(sql,p)).rows[0];
const perf3=readFileSync(repo+'db/tile-perf-3.sql','utf8');
for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(perf3),'tile-perf-3.sql avoids '+w);
const fixture=readFileSync(repo+'scripts/perf-tick-db/fixture.sql','utf8');
const U='77777777-7777-4777-8777-777777777777',S='88888888-8888-4888-8888-888888888888';
await run(`create schema eldervale_private;create schema auth;
 do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end $r$;
 create function auth.uid() returns uuid language sql stable as $$select '${U}'::uuid$$;
 ${fixture.slice(fixture.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.patch_function'),fixture.indexOf('-- Live collision chain'))}
 create table eldervale_private.quests_t(id int primary key,data jsonb);
 create table eldervale_private.shops_t(id int primary key,data jsonb);
 create table eldervale_private.sync_diet(user_id uuid primary key,states jsonb,updated_at timestamptz);
 create table eldervale_private.calls(n serial,fn text);
 create function eldervale_private.quest_state(uid uuid) returns jsonb language sql stable as $$select '{"active":1}'::jsonb$$;
 create function eldervale_private.quest_snapshot(uid uuid) returns jsonb language sql stable as $$select coalesce(jsonb_agg(data order by id),'[]') from eldervale_private.quests_t$$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_castle(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare result jsonb;shop_data jsonb;
begin
 result:=jsonb_build_object('time',1,'actors',jsonb_build_array(jsonb_build_object('id','a1','x',command)),'objects','[1,2]'::jsonb,'motion','{"x":1}'::jsonb);
 shop_data:=(select data from eldervale_private.shops_t where id=1);
 return result||jsonb_build_object('stateTime',(select 1),'shops',shop_data);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_stories(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare result jsonb;uid uuid:=auth.uid();
begin
 if command='quest_advance' then return eldervale_private.quest_v2_request($1,$2,$3,$4,$5);end if;
 result:=eldervale_private.realm_request_before_castle($1,$2,$3,$4,$5);
 return result||jsonb_build_object('questState',eldervale_private.quest_state(uid),'quests',eldervale_private.quest_snapshot(uid),'tutorial',(select '{"done":false}'::jsonb));
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.quest_v2_request(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare result jsonb;uid uuid:=auth.uid();
begin
 result:=eldervale_private.realm_request_before_castle($1,'sync','{}',null,$5);
 return result||jsonb_build_object('questState',eldervale_private.quest_state(uid),'quests',eldervale_private.quest_snapshot(uid),'tutorial',(select '{"done":false}'::jsonb));
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
 if command='reset' then return '{"reset":true}';end if;
 return eldervale_private.realm_request_before_stories($1,$2,$3,$4,$5)||jsonb_build_object('interior',jsonb_build_object('floor',0));
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.diet_actors(uid uuid, full_reply jsonb, have jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare r jsonb:=full_reply;cur jsonb;base jsonb;known jsonb;changed jsonb;gone jsonb;token text;base_token text;
begin
 if uid is null or r is null or jsonb_typeof(r->'actors') is distinct from 'array' then return r;end if;
 select coalesce(jsonb_object_agg(e->>'id',left(md5(e::text),12)),'{}'::jsonb) into cur from jsonb_array_elements(r->'actors') e;
 select d.states into known from eldervale_private.sync_diet d where d.user_id=uid for update;
 known:=coalesce(known,'{}'::jsonb);
 base_token:=have->>'actorsToken';
 if base_token is not null and known ? base_token then base:=known->base_token;end if;
 token:=md5(random()::text||clock_timestamp()::text);token:=left(token,16);
 if base is not null then
  select coalesce(jsonb_agg(e),'[]'::jsonb) into changed from jsonb_array_elements(r->'actors') e where base->>(e->>'id') is distinct from cur->>(e->>'id');
  select coalesce(jsonb_agg(k),'[]'::jsonb) into gone from jsonb_object_keys(base) k where k<>'_at' and not cur ? k;
  r:=r||jsonb_build_object('actors',changed,'actorsGone',gone,'actorsBase',base_token);
 end if;
 known:=(select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb) from (select key,value from jsonb_each(known) order by (value->>'_at') desc nulls last limit 2) s)
  ||jsonb_build_object(token,cur||jsonb_build_object('_at',to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS')));
 insert into eldervale_private.sync_diet(user_id,states,updated_at) values(uid,known,now())
  on conflict (user_id) do update set states=excluded.states,updated_at=excluded.updated_at;
 return r||jsonb_build_object('actorsToken',token);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.diet_reply(full_reply jsonb, have jsonb, keys text[])
 RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $function$
declare r jsonb:=full_reply;digests jsonb:='{}'::jsonb;k text;digest text;unchanged text[]:='{}';
begin
 if r is null or jsonb_typeof(r)<>'object' then return r;end if;
 if have is null or jsonb_typeof(have)<>'object' then have:='{}'::jsonb;end if;
 foreach k in array keys loop
  if r ? k then
   digest:=md5((r->k)::text);digests:=digests||jsonb_build_object(k,digest);
   if have->>k=digest then unchanged:=unchanged||k;end if;
  end if;
 end loop;
 return (r-unchanged)||jsonb_build_object('digests',digests);
end $function$;
CREATE OR REPLACE FUNCTION public.world_command_lean(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0, have jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 r:=eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor);
 if r is null or r ? 'reset' then return r;end if;
 if have is null or jsonb_typeof(have)<>'object' or pg_column_size(have)>4000 then have:='{}'::jsonb;end if;
 r:=eldervale_private.diet_actors(auth.uid(),r,have);
 return eldervale_private.diet_reply(r,have,array['shops','quests','tutorial','objects','removedActors','gates','playerFloors','skillCrops','skillFires','npcDuels','gathering','professionJobs','trade']);
end $function$;
 insert into eldervale_private.quests_t values(1,'{"name":"Q1","text":"${'x'.repeat(3000)}"}'),(2,'{"name":"Q2"}');
 insert into eldervale_private.shops_t values(1,'{"m1":{"bread":{"buy":3}}}');`,'stand-ins');

// A scripted session: the same command list against the unpatched and the patched server.
// Raw replies must match exactly (actor tokens aside); the client's expanded data must too.
const lean=async(cmd,have)=>(await one(`select public.world_command_lean($1,$2,'{}',null,0,$3::jsonb) r`,[S,cmd,JSON.stringify(have)])).r;
const script=[['sync'],['sync'],['change-quests'],['sync'],['change-shops'],['sync'],['quest_advance'],['sync'],['reset'],['sync'],['stale-have'],['sync']];
async function play(){
 await run(`truncate eldervale_private.sync_diet;update eldervale_private.quests_t set data=jsonb_set(data,'{name}','"Q2"') where id=2;update eldervale_private.shops_t set data='{"m1":{"bread":{"buy":3}}}' where id=1`,'reset data');
 const diet=createSyncDiet(),raws=[],views=[];
 for(const [step] of script){
  if(step==='change-quests'){await run(`update eldervale_private.quests_t set data=jsonb_set(data,'{name}','"Q2b"') where id=2`,'q');continue}
  if(step==='change-shops'){await run(`update eldervale_private.shops_t set data='{"m1":{"bread":{"buy":4}}}' where id=1`,'s');continue}
  const have=step==='stale-have'?{...diet.have(),quests:'0000',shops:'1111'}:diet.have();
  const r=await lean(step==='stale-have'?'sync':step,have);
  const raw=structuredClone(r);if(raw&&raw.actorsToken){raw.actorsToken='T';if(raw.actorsBase)raw.actorsBase='B'}
  raws.push(raw);
  if(r&&!r.reset){const {data}=diet.expand(r);views.push({quests:data.quests,shops:data.shops,tutorial:data.tutorial,questState:data.questState})}
 }
 return {raws,views};
}
const before=await play();
for(let pass=1;pass<=2;pass++)await run(perf3,'tile-perf-3 pass '+pass);
const def=async fn=>(await one(`select pg_get_functiondef($1::regprocedure) d`,[fn])).d;
for(const [fn,,nw] of JSON.parse(perf3.match(/\$edits\$([\s\S]*?)\$edits\$/)[1]))assert.equal((await def(fn)).split(nw).length-1,1,fn+' patched once');
console.log('ok tile-perf-3 applies twice; every patch lands once; no DELETE/ALTER/DROP');
const after=await play();
assert.deepEqual(after.raws,before.raws,'lean replies are identical before and after');
assert.deepEqual(after.views,before.views,'the client sees identical data');
assert.equal(before.views[1].quests[1].name,'Q2');assert.equal(before.views[2].quests[1].name,'Q2b','a quest change reaches the client');
assert.equal(before.views[3].shops.m1.bread.buy,4,'a shop change reaches the client');
assert.ok(!('quests' in before.raws[1])&&!('shops' in before.raws[1])&&before.raws[1].digests.quests,'an unchanged section is absent with its digest');
console.log('ok lean replies identical (sections absent with their digests when unchanged; changes, quest commands, reset and a stale have all handled)');

// Where the saving comes from: the placeholder travels through the layers instead of the section.
await run(`select set_config('eldervale.reply_have',$1,false)`.replace('$1',`'${JSON.stringify({quests:'x'})}'`),'have');
const md5=(await one(`select md5(eldervale_private.quest_snapshot(null)::text) d`)).d;
await run(`select set_config('eldervale.reply_have','{"quests":"${md5}"}',false);select set_config('eldervale.reply_skipped','',false)`,'have');
assert.equal((await one(`select eldervale_private.realm_request_before_stories(null,'sync') r`)).r.quests,null,'the matching section is a null placeholder inside the layers');
await run(`select set_config('eldervale.reply_have','',false)`,'clear');
assert.equal((await one(`select eldervale_private.realm_request_before_stories(null,'sync') r`)).r.quests.length,2,'without a have (world_command, old clients) the section is always built');
console.log('ok inside the layers the unchanged section is a 4-byte placeholder; old clients always get it');
