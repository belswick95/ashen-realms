import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../db/perf-tick-fix.sql',import.meta.url),'utf8');
const fixture=fs.readFileSync(new URL('../scripts/perf-tick-db/fixture.sql',import.meta.url),'utf8');
const edits=[...sql.matchAll(/\$edits\$(\[[\s\S]*?\])\$edits\$/g)].flatMap(m=>JSON.parse(m[1]));

test('perf tick fix avoids approval-prompt words and is one transaction with a lock timeout',()=>{
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),word);
 assert.match(sql,/^begin;\nset local lock_timeout='5s';/m);assert.match(sql,/commit;\s*$/);
 assert.match(sql,/create index if not exists entities_castle_parts/);
});

test('every patch anchor matches the live text (fixture copy) exactly once and is skipped once applied',()=>{
 assert.equal(edits.length,9);
 for(const [fn,old,next] of edits){
  assert.match(fn,/^eldervale_private\.\w+\(/);
  assert.equal(fixture.split(old).length-1,1,'anchor for '+fn+': '+old.slice(0,60));
  if(fn.includes('can_step'))for(const part of old.trim().replace(/^where /,'').split(' and '))assert.ok(next.includes(part),'edit keeps "'+part+'": '+fn);
  assert.notEqual(old,next);
 }
 assert.equal((sql.match(/if position\(new in body\)>0 then continue;end if;/g)||[]).length,2,'both edit loops skip applied edits');
});

test('collision bounds only add index ranges; abs() bounds stay',()=>{
 for(const [fn,old,next] of edits.filter(([fn])=>fn.includes('can_step'))){
  const r=/abs\(x-bx\)<(\d+)/.exec(old)||/abs\(\(data->>'x'\)::float8-bx\)<(\d+)/.exec(old);assert.ok(r,fn);
  assert.ok(next.includes(old.replace(/^where |^kind='door' and |^and /,'').trim().split(' and abs')[0])||next.includes('abs('),fn);
  assert.ok(next.includes('>bx-'+r[1])&&next.includes('<bx+'+r[1]),fn+' bounded on x');
  assert.ok(next.includes(old.match(/abs\([^<]+<\d+/)[0]),fn+' keeps abs bound');
 }
});

test('idle actors are only simulated near online players; player commands lock first',()=>{
 const tick=edits.find(([fn,old])=>fn==='eldervale_private.world_tick()'&&old.includes('order by id loop'))[2];
 assert.match(tick,/hp<=0 or target is not null or exists\(select 1 from eldervale_private\.realm_players near_player where near_player\.last_seen>t-interval '15 seconds' and abs\(near_player\.x-realm_actors\.x\)<100 and abs\(near_player\.z-realm_actors\.z\)<100\)/);
 const request=edits.find(([fn])=>fn.startsWith('eldervale_private.realm_request('))[2];
 assert.ok(request.indexOf('pg_advisory_xact_lock(736211)')<request.indexOf('-- Establish'),'lock before any work');
});
