// Behavioural check of db/skilling-world.sql on PGlite (real Postgres in WASM): first run places
// every node through entities (the runtime trigger makes the realm objects), a blocked spot is
// nudged, the trail's old ore names take their Eldervale names, and a re-run keeps owner edits.
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/skilling-world-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {skillingNodes} from '../../skilling-areas.js';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
await db.exec(`create schema eldervale_private;
create table eldervale_private.settings(id boolean primary key,revision bigint not null);insert into eldervale_private.settings values(true,1);
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint not null,data jsonb not null,deleted boolean not null default false,created_at timestamptz not null default now());
create table eldervale_private.realm_objects(id text primary key,kind text not null,x float8 not null,z float8 not null,data jsonb not null,available_at timestamptz,open boolean not null default false);
-- Stand-in walk check: a fenced square at the first node's spot blocks it.
create table eldervale_private.blocked(x0 float8,z0 float8,x1 float8,z1 float8);
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language sql stable as $$select not exists(select 1 from eldervale_private.blocked where bx between x0 and x1 and bz between z0 and z1)$$;
-- entity_runtime as on the live database (objects only).
create function eldervale_private.entity_runtime() returns trigger language plpgsql as $f$declare d jsonb:=new.data;begin
 if new.deleted then delete from eldervale_private.realm_objects where id=new.id::text;
 else insert into eldervale_private.realm_objects(id,kind,x,z,data) values(new.id::text,case when d->>'template' in ('tree','pine') then 'tree' when d->>'template'='rock' then 'rock' else d->>'kind' end,(d->>'x')::float8,(d->>'z')::float8,d||jsonb_build_object('type',d->>'template')) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z;end if;return new;end$f$;
create trigger runtime_entity after insert or update on eldervale_private.entities for each row execute function eldervale_private.entity_runtime();`);
const first=skillingNodes[0],moved=skillingNodes[1],gone=skillingNodes[2];
await db.query(`insert into eldervale_private.blocked values($1-0.5,$2-0.5,$1+0.5,$2+0.5)`,[first.x,first.z]);
await db.query(`insert into eldervale_private.entities(revision,data) values(1,'{"kind":"object","template":"rock","resource":"mithrilOre","name":"Mithril rocks","blueprint":"professions-v1","x":-245,"z":-290}'),(1,'{"kind":"object","template":"rock","resource":"runiteOre","name":"Owner rune rock","blueprint":"professions-v1","x":-235,"z":-290}')`);
const sql=readFileSync(repo+'db/skilling-world.sql','utf8');
for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),'avoids '+word);
await db.exec(sql);
const n=await one(`select count(*)::int n,count(*) filter(where data->>'template'='rock')::int rocks from eldervale_private.entities where data->>'blueprint'='skilling-world-v1'`);
assert.equal(n.n,skillingNodes.length);assert.equal(n.rocks,skillingNodes.filter(r=>r.template==='rock').length);
assert.equal((await one(`select count(*)::int n from eldervale_private.realm_objects where data->>'blueprint'='skilling-world-v1' and kind in('rock','tree','object')`)).n,skillingNodes.length,'realm objects made by the trigger');
const f=await one(`select data from eldervale_private.entities where id=$1`,[first.id]);assert.ok(Math.hypot(f.data.x-first.x,f.data.z-first.z)>0.4&&Math.hypot(f.data.x-first.x,f.data.z-first.z)<7,'blocked spot nudged');
const w=await one(`select data from eldervale_private.entities where data->>'skillingKey'='riverbank-willows-1'`);assert.equal(w.data.logItem,'willowLogs');assert.equal(w.data.site,'Riverbank willows');assert.equal(w.data.resourceRespawn,30);
assert.equal((await one(`select count(*)::int n from eldervale_private.entities where data->>'name'='Moonsilver rocks' and data->>'blueprint'='professions-v1'`)).n,1,'trail rock renamed');
assert.equal((await one(`select count(*)::int n from eldervale_private.entities where data->>'name'='Owner rune rock'`)).n,1,'owner name kept');
console.log('ok first run places',n.n,'nodes');
// Owner edits: move one node, remove another; a re-run changes nothing.
await db.query(`update eldervale_private.entities set data=data||'{"x":1,"z":2,"name":"Owner name"}' where id=$1`,[moved.id]);
await db.query(`update eldervale_private.entities set deleted=true where id=$1`,[gone.id]);
const rev=(await one(`select revision from eldervale_private.settings`)).revision;
await db.exec(sql);
assert.equal((await one(`select revision from eldervale_private.settings`)).revision,rev,'re-run is a no-op');
const m=await one(`select data from eldervale_private.entities where id=$1`,[moved.id]);assert.equal(m.data.name,'Owner name');assert.equal(m.data.x,1);
assert.equal((await one(`select deleted from eldervale_private.entities where id=$1`,[gone.id])).deleted,true);
assert.equal((await one(`select count(*)::int n from eldervale_private.entities where data->>'blueprint'='skilling-world-v1'`)).n,skillingNodes.length);
console.log('ok re-run keeps owner edits and removals');
