// Behavioural check of db/admin-full-control.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/admin-full-control-db/check.mjs
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const repo=process.argv[2]||new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const notices=[];
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d',P='22222222-2222-4222-8222-222222222222';
const as=uid=>db.exec(`select set_config('test.uid','${uid}',false)`);
const fc=async(command,payload={})=>(await one(`select eldervale_private.admin_action($1,$2) r`,[command,payload])).r;
const fails=async(command,payload,re)=>assert.rejects(()=>fc(command,payload),e=>{assert.match(e.message,re);return true});
const migration=readFileSync(repo+'/db/admin-full-control.sql','utf8');
assert.doesNotMatch(migration,/\b(delete|alter|drop)\b/i,'migration avoids destructive keywords');

await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
const first=await run(migration,'migration pass 1');
const patched=first.flatMap(r=>r.rows||[]).map(r=>Object.values(r)[0]).filter(v=>typeof v==='string'&&/: /.test(v));
assert.deepEqual(patched.filter(v=>!v.endsWith(': patched')),['eldervale_private.gathering_tick(timestamp with time zone): already patched'],'every soft patch applied (the legacy woodcutting form is skipped): '+patched.join(' | '));
const second=await run(migration,'migration pass 2');
const again=second.flatMap(r=>r.rows||[]).map(r=>Object.values(r)[0]).filter(v=>typeof v==='string'&&/: /.test(v));
assert.ok(again.length>=6&&again.every(v=>v.endsWith('already patched')),'second pass is a no-op: '+again.join(' | '));
assert.match((await one(`select pg_get_functiondef('eldervale_private.skill_xp_unscaled(uuid,text,numeric)'::regprocedure) d`)).d,/skill\|\|'XP'/,'original numeric skill_xp body kept');
assert.match((await one(`select pg_get_functiondef('eldervale_private.skill_xp(uuid,text,integer)'::regprocedure) d`)).d,/amount::numeric/,'integer overload untouched (forwards once)');
console.log('ok migration applies twice; soft patches idempotent');

// owner gate
await as(P);await fails('fc_settings_get',{},/Owner access required/);
await as(OWNER);
let r=await fc('fc_settings_get');assert.equal(r.multipliers.xp,1);assert.ok(r.skills.includes('woodcutting'));
console.log('ok fc_* commands are owner-only and dispatched through admin_action');

// identity multipliers leave awards untouched
await db.query(`select eldervale_private.skill_xp($1,'fishing',10)`,[P]);
await db.query(`select eldervale_private.combat_xp($1,3,'stab','{}'::jsonb)`,[P]);
let s=await one(`select skills,stats from public.player_saves where user_id=$1`,[P]);
assert.equal(s.skills.fishingXP,10);assert.equal(s.skills.attackXP,12);assert.equal(s.skills.hitpointsXP,1157.99);
// multipliers
await fails('fc_settings_save',{key:'multipliers',value:{xp:500}},/0–100/);
await fails('fc_settings_save',{key:'multipliers',value:{skills:{sailing:2}}},/Skill multiplier/);
await fc('fc_settings_save',{key:'multipliers',value:{xp:2,skills:{attack:3},dropRate:1,respawn:0.5,shopPrice:2}});
await db.query(`select eldervale_private.skill_xp($1,'fishing',10)`,[P]);
await db.query(`select eldervale_private.combat_xp($1,5,'stab','{}'::jsonb)`,[P]);
s=await one(`select skills,stats from public.player_saves where user_id=$1`,[P]);
assert.equal(s.skills.fishingXP,30,'fishing 10 x2');assert.equal(s.skills.attackXP,12+120,'attack 20 x2 x3');assert.equal(s.skills.hitpointsXP,1157.99+13.3,'hitpoints 6.65 x2');
await db.query(`select eldervale_private.skill_xp($1,'cooking',6.25::numeric)`,[P]);assert.equal((await one(`select skills->'cookingXP' c from public.player_saves where user_id=$1`,[P])).c,12.5,'decimal XP x2');
await db.query(`select eldervale_private.skill_xp($1,'cooking',1)`,[P]);assert.equal((await one(`select skills->'cookingXP' c from public.player_saves where user_id=$1`,[P])).c,14.5,'integer overload scaled once');
await db.query(`insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values($1,'tree1','woodcut',now()-interval '1 second')`,[P]);
await db.query(`select eldervale_private.gathering_tick(now())`);
s=await one(`select stats from public.player_saves where user_id=$1`,[P]);assert.equal(s.stats.woodXP,50,'woodcutting 25 x2');
console.log('ok XP multipliers: skill_xp, combat_xp (per skill) and woodcutting scale; 1x is exact');
// shop price
assert.equal((await one(`select eldervale_private.merchant_quote(100,50,-1,null,true,1) q`)).q,200);
assert.equal((await one(`select provolatile v from pg_proc where proname='merchant_quote'`)).v,'s');
// respawn
await db.query(`update eldervale_private.realm_actors set respawn_at=clock_timestamp()+interval '100 seconds' where id='base:rat'`);
let delay=(await one(`select extract(epoch from respawn_at-clock_timestamp()) d from eldervale_private.realm_actors where id='base:rat'`)).d;
assert.ok(delay>45&&delay<55,'respawn halved: '+delay);
// drops
await fc('fc_settings_save',{key:'multipliers',value:{xp:1,dropRate:0}});
await db.query(`update eldervale_private.realm_actors set data=data||'{"loot":[{"item":"rawMeat","min":1,"max":1,"chance":1},{"item":"bread","min":2,"max":2,"chance":0.01,"always":true}]}' where id='base:rat'`);
for(let i=0;i<5;i++)await db.query(`select eldervale_private.actor_loot('base:rat',$1)`,[P]);
const drops=(await db.query(`select item,count(*)::int n from eldervale_private.ground_drops where owner_id=$1 group by item`,[P])).rows;
assert.deepEqual(drops,[{item:'bread',n:5}],'dropRate 0 suppresses rolled loot; always rows still drop');
console.log('ok shop price, respawn and drop-rate multipliers');

// catalog
r=await fc('fc_catalog_list');assert.ok(r.some(x=>x.id==='weapon:bronzeSword'));
await fails('fc_catalog_save',{id:'item:note:wood',data:{name:'x'}},/notes follow/);
await fails('fc_catalog_save',{id:'potion:x',data:{name:'x'},create:true},/Unknown catalog prefix/);
await fails('fc_catalog_save',{id:'item:wood',data:{name:'Logs',buy:'cheap'}},/buy must be a number/);
await fails('fc_catalog_save',{id:'item:wood',data:{name:'Logs',requirements:{attack:120}}},/Requirement attack/);
await fails('fc_catalog_save',{id:'item:wood',data:{name:'Logs'},create:true},/already exists/);
r=await fc('fc_catalog_save',{id:'weapon:bronzeSword',data:{name:'Bronze sword',kind:'weapon',attack:12,damage:8,speed:2.4,reach:2.4,tier:'bronze',attackSpeed:4,requirements:{attack:1},bonuses:{attack:{stab:4,slash:5,crush:-2,ranged:0,magic:0},defence:{stab:0,slash:1},strength:6,rangedStrength:0,prayer:0},futureField:{x:1}}});
assert.equal(r.data.ownerEdited,true);assert.equal(r.data.futureField.x,1);
r=await fc('fc_catalog_save',{id:'item:custom_royal_bread',create:true,data:{name:'Royal bread',buy:12,sell:4,heal:10,icon:'bread',tradeable:false}});
assert.equal(r.data.custom,true);assert.equal(r.created,true);
await fc('fc_catalog_disable',{id:'item:custom_royal_bread',disabled:true});
assert.equal((await one(`select data->>'disabled' d from eldervale_private.realm_catalog where id='item:custom_royal_bread'`)).d,'true');
const snap=(await one(`select eldervale_private.snapshot(-1) s`)).s;
assert.ok(snap.catalogOverrides['weapon:bronzeSword']);assert.equal(snap.gameConfig.multipliers.dropRate,0);assert.ok(snap.professions,'snapshot keeps professions');
// tradeable=false blocks trades
await db.query(`select eldervale_private.item_change($1,'custom_royal_bread',1)`,[P]);
await assert.rejects(()=>db.query(`select eldervale_private.validate_offer($1,'{"gold":0,"items":{"custom_royal_bread":1}}')`,[P]),/cannot be traded/);
await db.query(`select eldervale_private.validate_offer($1,'{"gold":0,"items":{"wood":1}}')`,[P]);
console.log('ok catalog editor: generic fields, future keys, soft disable, untradeable items, snapshot overrides');

// players
r=await fc('fc_player_get',{userId:P});assert.equal(r.save.character_name,'Player');assert.equal(r.position.x,10);assert.equal(r.role,'player');
await fails('fc_player_set_xp',{userId:P,skill:'sailingXP',xp:5},/Choose a player and skill/);
r=await fc('fc_player_set_xp',{userId:P,skill:'attackXP',xp:5000});assert.equal(r.level,8);
r=await fc('fc_player_set_xp',{userId:P,skill:'woodXP',xp:77.25});await fails('fc_player_set_xp',{userId:P,skill:'woodXP',xp:1.234},/2 decimals/);
assert.equal((await one(`select stats->>'woodXP' w from public.player_saves where user_id=$1`,[P])).w,'77.25');
r=await fc('fc_player_item',{userId:P,item:'wood',amount:-3});assert.equal(r.stats.wood,0,'2 starting logs + 1 chopped');
await fails('fc_player_item',{userId:P,item:'wood',amount:-1},/Not enough items/);
r=await fc('fc_player_item',{userId:P,item:'bread',amount:5,bank:true});assert.equal(r.inventory.bank.bread,5);
r=await fc('fc_player_set_gold',{userId:P,gold:777});assert.equal(r.gold,777);
r=await fc('fc_player_unequip',{userId:P,slot:'helm'});assert.equal(r.equipment.helm,undefined);
await fails('fc_moderate',{userId:OWNER,op:'ban',reason:'test',permanent:true},/owner/);
r=await fc('fc_moderate',{userId:P,op:'ban',reason:'griefing',permanent:true});assert.ok(new Date(r.banned_until).getFullYear()>2100);
r=await fc('fc_moderate',{userId:P,op:'mute',reason:'spam',minutes:30});assert.ok(Date.parse(r.muted_until)>Date.now());
r=await fc('fc_password_reset',{userId:P});assert.equal(r.email,'player@example.com');
r=await fc('fc_player_get',{userId:P});assert.ok(r.audit.length>=8,'player audit trail');
console.log('ok player inspector: XP, items, bank, gold, unequip, permanent ban, mute, reset email, audit trail');

// world spawns & actors
r=await fc('fc_ground_drop',{item:'wood',amount:3,x:5,z:6});assert.equal(r.owner_id,OWNER);assert.equal(r.amount,3);
await fails('fc_ground_drop',{item:'note:wood',amount:3,x:5,z:6},/original item/);
await fails('fc_actor_patch',{id:'base:rat',patch:{level:500}},/Invalid actor level/);
await fails('fc_actor_patch',{id:'base:rat',patch:{teleport:true}},/Unsupported actor field/);
r=await fc('fc_actor_patch',{id:'base:rat',patch:{xpReward:40,goldReward:9,level:5,hp:4,loot:[{item:'rawMeat',min:1,max:2,chance:0.25,rare:true}]}});
assert.equal(r.data.xpReward,40);assert.equal(r.data.attackLevel,5);assert.equal(r.hp,4);
console.log('ok ground drops and base-actor loot/reward patches');

// quests
const Q={name:'Rat problem',description:'Clear the cellar.',giver:'base:bob',key:'rat-problem',chain:'cellar',order:1,questPoints:2,icon:'bread',published:true,
 objectives:[{type:'kill',target:'base:rat',amount:2,label:'Kill rats'},{type:'talk',target:'base:bob',amount:1},{type:'collect',target:'rawMeat',amount:2},{type:'event',event:'eat',match:{item:'bread'},amount:1},
  {type:'xp',skill:'cooking',amount:50},{type:'have',target:'wood',amount:1},{type:'equip',target:'weapon',amount:1},{type:'bank',target:'*',amount:1},{type:'visit',x:3,z:4,radius:3,amount:1}],
 gold:50,items:{bread:2},xp:{cooking:100,hitpoints:20},startItems:{wood:1},dialogue:{offer:[{who:'npc',text:'Rats!'}],progress:[{who:'npc',text:'Still rats?'}],complete:[{who:'player',text:'Done.'}]}};
r=await fc('fc_quest_save',{data:Q});assert.equal(r.version,1);assert.equal(r.data.questPoints,2);
const qid=r.id;r=await fc('fc_quest_save',{id:qid,data:{...Q,name:'Rat problem II'}});assert.equal(r.version,2);
await fails('fc_quest_save',{data:{...Q,key:'other',objectives:[{type:'fly',amount:1}]}},/unknown type/);
await fails('fc_quest_save',{data:{...Q,key:'other',giver:'nobody'}},/existing NPC/);
await fails('fc_quest_save',{data:{...Q}},/already uses key/);
await fails('fc_quest_save',{data:{...Q,key:'next',requires:'missing'}},/does not exist/);
r=await fc('fc_quest_save',{data:{...Q,key:'next',requires:'rat-problem'}});assert.equal(r.data.requires,'rat-problem');
await fails('fc_quest_save',{data:{...Q,key:'x2',dialogue:{offer:[{who:'king',text:'hi'}]}}},/speaker/);
console.log('ok quest editor validation: all objective types, keys, prerequisites, dialogue');

// backups
r=await fc('fc_backup_save',{name:'before test'});assert.equal(r.name,'before test');
const e1=(await one(`insert into eldervale_private.entities(revision,data) values(1,'{"kind":"monster","template":"wolf","name":"Wolf","x":1,"z":2,"hp":30}') returning id`)).id;
r=await fc('fc_backup_list');assert.ok(r.some(b=>b.name==='before test'));
r=await fc('fc_backup_restore',{name:'before test',mode:'mirror'});assert.equal(r.markedDeleted,1);assert.match(r.undo,/auto-before-restore/);
assert.equal((await one(`select deleted from eldervale_private.entities where id=$1`,[e1])).deleted,true,'mirror soft-deletes newer entities');
assert.equal((await one(`select deleted from eldervale_private.realm_actors where id=$1`,[e1])).deleted,true);
const doc=await fc('fc_backup_export');assert.equal(doc.format,'eldervale-backup-v1');
doc.entities.find(x=>x.id===e1).deleted=false;r=await fc('fc_backup_restore',{backup:doc,mode:'merge',parts:['entities','catalog','quests']});
assert.equal((await one(`select deleted from eldervale_private.entities where id=$1`,[e1])).deleted,false,'uploaded backup restores');
await fails('fc_backup_restore',{backup:{format:'nope'}},/eldervale-backup-v1/);
console.log('ok backups: save, list, export, mirror/merge restore with automatic undo archive');

// audit search
r=await fc('fc_audit',{query:'griefing'});assert.equal(r.rows[0].action,'fc_moderate');assert.ok(r.actions.includes('fc_catalog_save'));
r=await fc('fc_audit',{action:'fc_catalog_save',limit:1});assert.equal(r.rows.length,1);
const writes=(await one(`select count(*)::int n from eldervale_private.audit where action like 'fc\\_%'`)).n;assert.ok(writes>=20,'every write audited: '+writes);
console.log('ok audit search');

// another migration re-creates skill_xp later: re-running this file wraps the new body
await db.exec(`create or replace function eldervale_private.skill_xp(uid uuid, skill text, amount numeric) returns void language plpgsql set search_path='' as $$begin update public.player_saves set skills=skills||jsonb_build_object(skill||'XP',coalesce((skills->>(skill||'XP'))::numeric,0)+amount+1) where user_id=uid;end $$`);
await run(migration,'migration pass 3');
await fc('fc_settings_save',{key:'multipliers',value:{xp:3}});
const before=(await one(`select (skills->>'cookingXP')::numeric c from public.player_saves where user_id=$1`,[P])).c||0;
await db.query(`select eldervale_private.skill_xp($1,'cooking',10)`,[P]);
assert.equal(Number((await one(`select (skills->>'cookingXP')::numeric c from public.player_saves where user_id=$1`,[P])).c)-Number(before),31,'new body (+1) wrapped with 3x');
console.log('ok re-running after a later skill_xp rewrite re-wraps the new body');
console.log('ALL OK');
