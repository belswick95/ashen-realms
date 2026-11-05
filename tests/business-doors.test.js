import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {heldOpen,heldOpenExamine,SERVICE_ROLES,SERVICE_STATIONS} from '../business-doors.js';

test('business, service and castle doors are held open; plain houses keep their doors',()=>{
 assert.equal(heldOpen({kind:'castleGate'}),true);assert.equal(heldOpen({template:'bank'}),true);
 assert.equal(heldOpen({template:'forge'},{roles:['smith']}),true);assert.equal(heldOpen({template:'inn'},{roles:['innkeeper']}),true);
 assert.equal(heldOpen({template:'cottage'},{roles:['healer'],stations:['altar']}),true,'chapels');
 assert.equal(heldOpen({template:'cottage'},{roles:['resident'],stations:['workbench']}),true,'castle keep with crafting stations');
 assert.equal(heldOpen({template:'cottage'},{roles:['resident','guard']}),false,'an ordinary house');assert.equal(heldOpen({template:'cottage'}),false);
 assert.match(heldOpenExamine('castleGate'),/castle gates stand open/);assert.match(heldOpenExamine('door'),/held open for business/);
});

test('the server rule in db/business-doors.sql uses the same roles and stations as the client',()=>{
 const sql=fs.readFileSync(new URL('../db/business-doors.sql',import.meta.url),'utf8');
 const list=re=>sql.match(re)[1].split(',').map(s=>s.trim().replace(/'/g,''));
 assert.deepEqual(list(/a\.data->>'role' in \(([^)]*)\)/),SERVICE_ROLES);assert.deepEqual(list(/o\.data->>'template' in \(([^)]*)\)/),SERVICE_STATIONS);
 assert.match(sql,/set open=true where id=sid and not open/,'held-open doors only ever open');assert.match(sql,/update eldervale_private\.realm_objects o set open=true/,'opens them now');
});
