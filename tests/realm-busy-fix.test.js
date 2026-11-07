import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../db/realm-busy-fix.sql',import.meta.url),'utf8');

test('realm busy fix SQL: no destructive words, idempotent markers, live edits through patch_function',()=>{
 assert.doesNotMatch(sql,/delete|alter|drop/i);
 assert.match(sql,/position\('realm-busy-fix' in pg_get_functiondef\('eldervale_private\.realm_request\(uuid,text,jsonb,uuid,bigint\)'::regprocedure\)\)=0/);
 assert.match(sql,/position\('tick_no\(t\)%20' in pg_get_functiondef\('eldervale_private\.guard_tick\(double precision\)'::regprocedure\)\)=0/);
 assert.equal((sql.match(/eldervale_private\.patch_function\(/g)||[]).length,4,'two edits, each in the apply block and the dry run');
 // Adjacent E'' literals are joined with || (SQL would otherwise need them on separate lines only).
 assert.doesNotMatch(sql,/'\s*\n\s*E'/,'every continued E\'\' literal is joined with ||');
});
test('realm busy fix SQL: logout skips the world lock, sync waits at most 4 s, guard sweep every 20 ticks',()=>{
 assert.match(sql,/if command=''logout'' then perform set_config\(''lock_timeout'',''3s'',true\);return eldervale_private\.logout_command\(\$1\);end if;/);
 assert.match(sql,/if command=''sync'' then perform set_config\(''lock_timeout'',''4s'',true\);end if;/);
 const apply=sql.slice(0,sql.indexOf('DRY RUN (changes nothing'));
 assert.ok(apply.indexOf("logout_command($1);end if;\\n'")<apply.indexOf("perform pg_advisory_xact_lock(736211); -- Lock order']"),'logout before the lock');
 assert.match(sql,/if eldervale_private\.tick_no\(t\)%20=0 then update eldervale_private\.realm_actors guard_row set/);
 assert.match(sql,/is distinct from ''longsword''\);end if;/);
});
test('realm busy fix SQL: the dry run rolls itself back by raising',()=>{
 const dry=sql.slice(sql.indexOf('DRY RUN (changes nothing'));
 assert.match(dry,/do \$dry\$/);assert.match(dry,/raise exception 'DRY RUN OK, rolled back/);
 assert.doesNotMatch(dry,/\bcommit\b/i);
});
