import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('qa-perf.sql is one idempotent transaction without approval-prompt words',()=>{
 const sql=read('db/qa-perf.sql');
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp(word,'i').test(sql),word);
 assert.match(sql,/^begin;\nset local lock_timeout='2s';/m);assert.match(sql,/commit;\s*$/);
 const creates=sql.match(/^create index[^\n]*/gm);assert.equal(creates.length,3);
 for(const c of creates)assert.match(c,/^create index if not exists /);
 assert.match(sql,/DRY RUN/);
 // The reply-objects predicate must stay verbatim with realm_request_base for the planner to use it.
 assert.match(sql,/where \(kind='door' or available_at is not null\);/);
});

test('groundFeet helpers exist before the first frame() call',()=>{
 const src=read('game.js'),decl=src.indexOf('function groundHeightAt('),box=src.indexOf('const footBox=new T.Box3()'),first=src.indexOf("say('Welcome to Eldervale!');frame();");
 assert.ok(decl>0&&box>0&&first>0);assert.ok(box<first,'footBox declared before the first frame');
});
