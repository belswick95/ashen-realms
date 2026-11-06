import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {catalogForm,buildCatalogData,validateCatalogDraft,catalogKind,duplicateId,catalogMatches,examineKey,CATALOG_FIELDS,normalizeMultipliers,effectiveXp,validateTimeOverride,
 validateQuestDraft,questPreview,objectiveText,OBJECTIVE_TYPES,scatterPositions,applyOverrides,parseLootLines,formatLootLines,backupStats,levelForXp,XP_TABLE,xpKey,XP_KEYS} from '../admin-full-data.js';
import {normalizeLoot,lootSummary} from '../bestiary.js';

const sql=fs.readFileSync(new URL('../db/admin-full-control.sql',import.meta.url),'utf8');
const client=['admin-full.js','admin-console.js','admin-panel.js'].map(f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n');

test('catalog form round-trips OSRS gear fields and keeps unknown keys as advanced JSON',()=>{
 const data={name:'Rune scimitar',desc:'A vicious curved sword.',buy:25600,sell:7680,tier:'rune',attackSpeed:4,requirements:{attack:40,mining:5},bonuses:{attack:{stab:7,slash:45,crush:-2,ranged:0,magic:0},defence:{stab:0,slash:1},strength:44,rangedStrength:0,prayer:0,special:{x:1}},futureFlag:'yes',ownerEdited:true};
 const f=catalogForm('weapon:runeScimitar',data);
 assert.equal(f.examineKey,'desc');assert.equal(f.values['requirements.attack'],40);assert.equal(f.values['bonuses.attack.slash'],45);assert.equal(f.values.tradeable,true,'tradeable defaults on');
 assert.deepEqual(f.extra,{requirements:{mining:5},bonuses:{special:{x:1}},futureFlag:'yes'},'unknown nested keys stay in advanced JSON');
 const back=buildCatalogData('weapon:runeScimitar',f.values,f.extra,f.examineKey);
 const {ownerEdited,...expected}=data;assert.deepEqual(back,expected,'round trip is lossless');
 f.values['bonuses.attack.slash']='';f.values.tradeable=false;f.values.stackable=true;
 const edited=buildCatalogData('weapon:runeScimitar',f.values,f.extra,f.examineKey);
 assert.equal(edited.bonuses.attack.slash,undefined);assert.equal(edited.tradeable,false);assert.equal(edited.stackable,true);
 assert.throws(()=>buildCatalogData('item:x',{...f.values,buy:'abc'},{}),/must be a number/);
 assert.equal(examineKey('item:bread',{}),'description');assert.equal(examineKey('armor:helm',{}),'desc');
 assert.ok(CATALOG_FIELDS.some(x=>x.path.join('.')==='bonuses.defence.magic'));
});

test('catalog validation, kinds, search and duplicate IDs',()=>{
 const existing=new Set(['item:wood','weapon:bronzeSword','item:note:wood']);
 assert.deepEqual(validateCatalogDraft('item:wood',{name:'Logs',buy:6},{existing}),[]);
 assert.match(validateCatalogDraft('item:note:wood',{name:'x'},{existing}).join(),/notes follow/);
 assert.match(validateCatalogDraft('potion:x',{name:'x'},{create:true,existing}).join(),/Unknown prefix/);
 assert.match(validateCatalogDraft('item:wood',{name:'x'},{create:true,existing}).join(),/already exists/);
 assert.match(validateCatalogDraft('item:wood',{name:'x',requirements:{attack:0}},{existing}).join(),/level 1–99/);
 assert.match(validateCatalogDraft('item:wood',{name:'',buy:-1},{existing}).join(),/Name.*Value/s);
 assert.equal(catalogKind('item:weapon:axe',{field:'weaponsOwned'}),'Equipment');assert.equal(catalogKind('armor:helm',{}),'Armour');assert.equal(catalogKind('item:note:wood',{noteOf:'wood'}),'Notes');
 assert.equal(duplicateId('item:custom_bread',new Set(['item:custom_bread_copy'])),'item:custom_bread_copy2');
 const row={id:'weapon:runeScimitar',data:{name:'Rune scimitar',tier:'rune',ownerEdited:true}};
 assert.ok(catalogMatches(row,'rune scim','Weapons'));assert.ok(catalogMatches(row,'','Edited'));assert.ok(!catalogMatches(row,'','Custom'));assert.ok(!catalogMatches(row,'bronze',''));
});

test('multipliers and world clock validation',()=>{
 const m=normalizeMultipliers({xp:2,skills:{attack:3,cooking:1},dropRate:.5});
 assert.deepEqual(m,{xp:2,dropRate:.5,respawn:1,shopPrice:1,skills:{attack:3}});assert.equal(effectiveXp(m,'attack'),6);assert.equal(effectiveXp(m,'fishing'),2);
 assert.throws(()=>normalizeMultipliers({respawn:0}),/respawn/);assert.throws(()=>normalizeMultipliers({skills:{sailing:2}}),/Unknown skill/);
 assert.equal(validateTimeOverride(''),null);assert.equal(validateTimeOverride('12.5'),12.5);assert.throws(()=>validateTimeOverride(30),/0–24/);
});

test('quest draft validation covers every objective type and mirrors the server',()=>{
 const ctx={npcs:new Set(['npc1']),actors:new Set(['npc1','rat']),items:new Set(['wood','bread']),keys:new Set(['intro'])};
 const q={name:'Logs for Bob',description:'Bring logs.',giver:'npc1',key:'logs',requires:'intro',questPoints:2,icon:'wood',
  objectives:[{type:'talk',target:'npc1',amount:1},{type:'kill',target:'rat',amount:3},{type:'collect',target:'wood',amount:5},{type:'have',target:'bread',amount:1},{type:'bank',target:'*',amount:1},{type:'equip',target:'weapon',amount:1},{type:'xp',skill:'woodcutting',amount:6.25*4},{type:'event',event:'eat',amount:1},{type:'visit',x:3,z:4,radius:3,amount:1}],
  gold:10,items:{bread:1},xp:{woodcutting:6.25},startItems:{wood:1},dialogue:{offer:[{who:'npc',text:'Hi'}],complete:[{who:'player',text:'Done'}]}};
 assert.deepEqual(validateQuestDraft(q,ctx),[]);
 assert.equal(Object.keys(OBJECTIVE_TYPES).length,9);
 const bad=validateQuestDraft({...q,key:'intro',requires:'missing',giver:'x',icon:'nope',objectives:[{type:'fly',amount:1},{type:'collect',target:'wood',amount:1},{type:'collect',target:'wood',amount:2}],dialogue:{offer:[{who:'king',text:'hi'}]}},ctx).join('\n');
 for(const re of [/already uses key/,/does not exist/,/quest giver/,/icon/,/unknown type/,/duplicate/,/speaker/])assert.match(bad,re);
 assert.match(validateQuestDraft({...q,objectives:[{type:'visit',x:1,amount:1}]},ctx).join(),/visit needs/);
 const text=questPreview(q,{npc1:'Bob',wood:'Logs',bread:'Bread',rat:'Rat'});
 assert.match(text,/Giver: Bob · requires intro/);assert.match(text,/Defeat 3 × Rat/);assert.match(text,/Rewards: 2 quest points, 6.25 Woodcutting XP, 1 × Bread, 10 coins/);assert.match(text,/You: Done/);
 assert.equal(objectiveText({type:'bank',target:'*',amount:2}),'Bank 2 items');assert.equal(objectiveText({type:'talk',target:'npc1',label:'Custom'}),'Custom');
});

test('spawn helpers: scatter, overrides and text loot',()=>{
 let seed=1;const rand=()=>(seed=seed*16807%2147483647)/2147483647;
 const pts=scatterPositions(30,10,-5,8,rand);assert.equal(pts.length,30);assert.ok(pts.every(p=>Math.hypot(p.x-10,p.z+5)<=8.1));
 assert.equal(scatterPositions(500,0,0,5).length,80,'bundles hold at most 80');
 const e=applyOverrides({hp:10,damage:2,hostile:false},{hp:'250',damage:'',hostile:'yes',xpReward:'40'});assert.deepEqual(e,{hp:250,damage:2,hostile:true,xpReward:40});
 assert.throws(()=>applyOverrides({},{respawn:-1}),/respawn/);
 const loot=parseLootLines('bones,1,1,100,always\nrune,1,3,2.5,rare\ncoins,5,10,50');
 assert.deepEqual(loot[0],{item:'bones',min:1,max:1,chance:1,always:true});assert.equal(loot[1].rare,true);assert.equal(loot[1].chance,.025);
 assert.equal(formatLootLines(loot),'bones,1,1,100,always\nrune,1,3,2.5,rare\ncoins,5,10,50');
 assert.throws(()=>parseLootLines('x,1,1,0'),/Chance/);assert.throws(()=>parseLootLines('x,1,1,5',k=>k!=='x'),/Unknown/);
 assert.deepEqual(normalizeLoot(loot).map(r=>[r.always,r.rare]),[[true,undefined],[undefined,true],[undefined,undefined]],'console loot keeps always/rare');
 assert.match(lootSummary(loot),/always.*\(rare\)/);
});

test('XP table, keys and backup summaries',()=>{
 assert.equal(XP_TABLE[98],13034431);assert.equal(levelForXp(1154),10);assert.equal(levelForXp(6.25),1);
 assert.equal(xpKey('woodcutting'),'woodXP');assert.ok(XP_KEYS.includes('miningXP'));
 assert.deepEqual(backupStats({format:'eldervale-backup-v1',entities:[{deleted:true},{}],actors:[1],catalog:[],quests:[1,2]}),{entities:2,deleted:1,actors:1,catalog:0,quests:2});
 assert.throws(()=>backupStats({format:'x'}),/backup/);
});

test('admin-full-control.sql is idempotent, non-destructive, owner-checked and audited',()=>{
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i,'no destructive keywords anywhere');
 assert.doesNotMatch(sql,/^\s*create\s+(function|table|trigger)\b(?!.*if not exists)/im,'creates are create or replace / if not exists');
 assert.match(sql,/admin_full_control[\s\S]*is_owner\(\)/);
 const body=sql.slice(sql.indexOf('create or replace function eldervale_private.admin_full_control'),sql.indexOf('-- fc_* commands reach'));
 const commands=[...body.matchAll(/command='(fc_[a-z_]+)'/g)].map(m=>m[1]);
 const reads=new Set(['fc_settings_get','fc_catalog_list','fc_player_get','fc_audit','fc_backup_list']);
 for(const c of commands){if(reads.has(c))continue;const start=body.indexOf("command='"+c+"'"),next=body.indexOf("elsif command=",start+5),chunk=body.slice(start,next<0?undefined:next);
  assert.ok(/insert into eldervale_private\.audit/.test(chunk)||/admin_action\('update'/.test(chunk),c+' writes an audit row')}
 for(const c of new Set([...client.matchAll(/'(fc_[a-z_]+)'/g)].map(m=>m[1])))assert.ok(commands.includes(c),'client command '+c+' exists on the server');
 for(const f of ['skill_xp','combat_xp','gathering_tick','actor_loot','merchant_quote','validate_offer','snapshot','admin_action'])assert.match(sql,new RegExp('eldervale_private\\.'+f+'\\('),f+' wired');
 // CASE inside IF conditions is parenthesised.
 for(const m of sql.matchAll(/\b(?:if|elsif)\b([^;]*?)\bthen\b/gi))if(/\bcase\b/i.test(m[1]))assert.match(m[1],/\(\s*case\b/i,'parenthesised CASE: '+m[0].slice(0,90));
});

test('recipe editor accepts decimal XP (numeric XP since osrs-skill-parity)',()=>{
 const panel=fs.readFileSync(new URL('../admin-panel.js',import.meta.url),'utf8');
 assert.match(panel,/xp\.step='0\.01'/);
});
