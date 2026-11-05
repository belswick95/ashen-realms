import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pickKeptItems,carriedEntries,keptOnDeath,unitValue,formatCountdown,pileStatus,pileLooted,keptMessage,createDeathFlow,KEEP_ON_DEATH,DEATH_PILE_MS} from '../death.js';
import {composeJingle} from '../jingles.js';
import {SKULL_PATHS,SKULL_SVG} from '../world-map.js';

const goods={
 'weapon:longsword':{name:'Longsword',buy:45,field:'weaponsOwned',key:'longsword'},
 'weapon:dagger':{name:'Dagger',buy:20,field:'weaponsOwned',key:'dagger'},
 'armor:helm':{name:'Iron helm',buy:60,field:'armorOwned',key:'helm'},
 'armor:gilded':{name:'Gilded helm',buy:132,field:'armorOwned',key:'gilded'},
 'jewelry:amulet':{name:'Woodland amulet',buy:75,field:'jewelryOwned',key:'amulet'},
 arrows:{name:'Iron arrows',buy:7,stackable:true},
 rawFish:{name:'Raw fish',buy:12},
 'note:rawFish':{name:'Raw fish (noted)',buy:0,noteOf:'rawFish',stackable:true},
 letter:{name:'Sealed letter',buy:0,untradeable:true}
};

test('keeps the 3 most valuable single units; a stack counts per unit',()=>{
 const {kept,dropped}=pickKeptItems([{item:'arrows',amount:300,value:7},{item:'rune',amount:1,value:50},{item:'gold',amount:900,value:1}]);
 assert.deepEqual(kept.map(k=>[k.item,k.amount]),[['rune',1],['arrows',2]]);
 assert.deepEqual(dropped.map(d=>[d.item,d.amount]),[['arrows',298],['gold',900]]);
 // A single valuable stack fills all three places.
 const all=pickKeptItems([{item:'gem',amount:10,value:500},{item:'sword',amount:1,value:45}]);
 assert.deepEqual(all.kept,[{item:'gem',amount:3,value:500,protected:false}]);assert.deepEqual(all.dropped.map(d=>[d.item,d.amount]),[['gem',7],['sword',1]]);
 // Coins count at 1 gold each and are kept only when nothing is worth more.
 assert.deepEqual(pickKeptItems([{item:'gold',amount:50,value:1}]).kept,[{item:'gold',amount:3,value:1,protected:false}]);
 assert.equal(KEEP_ON_DEATH,3);
});

test('ties: worn first, then item id; untradeable items are always kept and use no place',()=>{
 const r=pickKeptItems([{item:'b',amount:1,value:60},{item:'a',amount:1,value:60},{item:'c',amount:1,value:60,equipped:true},{item:'d',amount:1,value:60},{item:'quest',amount:1,value:0,protected:true}]);
 assert.deepEqual(r.kept.map(k=>k.item),['quest','c','a','b']);assert.deepEqual(r.dropped.map(d=>d.item),['d']);
 // A worn item that is not kept is marked so the server unequips it first.
 const worn=pickKeptItems([{item:'x',amount:1,value:1,equipped:true},{item:'y',amount:3,value:9}]);assert.equal(worn.dropped[0].item,'x');assert.equal(worn.dropped[0].equipped,true);
 assert.deepEqual(pickKeptItems([]),{kept:[],dropped:[]});
 assert.deepEqual(pickKeptItems([{item:'z',amount:0,value:5},null]),{kept:[],dropped:[]});
});

test('client preview reads the backpack, worn gear and coins like the server',()=>{
 const state={weaponsOwned:['longsword','dagger'],armorOwned:['helm','gilded'],jewelryOwned:['amulet'],shieldsOwned:[],mountsOwned:[],equipped:{helm:true},equippedWeapon:'longsword',amulet:'amulet',arrows:300,rawFish:5,'note:rawFish':40,letter:1,gold:500};
 const entries=carriedEntries(state,goods);
 assert.equal(entries.find(e=>e.item==='armor:helm').equipped,true);assert.equal(entries.find(e=>e.item==='armor:gilded').equipped,false);
 assert.equal(unitValue('note:rawFish',goods),12,'a note is worth its item');assert.equal(unitValue('gold',goods),1);
 const {kept,dropped}=keptOnDeath(state,goods);
 // Same answer as the live-schema replica run of db/osrs-death.sql for this loadout.
 assert.deepEqual(kept.map(k=>[k.item,k.amount]),[['letter',1],['armor:gilded',1],['jewelry:amulet',1],['armor:helm',1]]);
 assert.deepEqual(dropped.map(d=>d.item),['weapon:longsword','weapon:dagger','note:rawFish','rawFish','arrows','gold']);
 assert.match(keptMessage(kept,goods),/^You kept: Sealed letter, Gilded helm, Woodland amulet, Iron helm\.$/);
 assert.equal(keptMessage([],goods),'You kept nothing.');
 assert.equal(keptMessage([{item:'arrows',amount:3}],goods),'You kept: 3 × Iron arrows.');
});

test('death pile: live countdown, gone after exactly 15 minutes or once looted',()=>{
 const died=Date.parse('2026-11-05T12:00:00Z'),pile={x:10,z:-4,floor:0,diedAt:'2026-11-05T12:00:00Z',expiresAt:new Date(died+DEATH_PILE_MS).toISOString(),ids:['a','b']};
 assert.equal(DEATH_PILE_MS,900000);
 assert.equal(pileStatus(pile,died).label,'Your items · 15:00');
 assert.equal(pileStatus(pile,died+28*1000).label,'Your items · 14:32');
 assert.equal(pileStatus(pile,died+DEATH_PILE_MS-1).label,'Your items · 0:01');
 assert.equal(pileStatus(pile,died+DEATH_PILE_MS),null);assert.equal(pileStatus(null,died),null);assert.equal(pileStatus(pile,died,{gone:true}),null);
 assert.equal(formatCountdown(61000),'1:01');assert.equal(formatCountdown(-5),'0:00');
 // Looted only when we are close enough to see the drops and none of the pile's are left.
 assert.equal(pileLooted(pile,[{id:'b'}],{x:12,z:0}),false);
 assert.equal(pileLooted(pile,[{id:'zz'}],{x:12,z:0}),true);
 assert.equal(pileLooted(pile,[],{x:900,z:0}),false,'too far away to know');
});

test('death flow: locks during the pose, says the RuneScape line and the kept items, tracks the pile',()=>{
 let t=1000;const said=[],jingles=[];
 const flow=createDeathFlow({doc:null,say:s=>said.push(s),jingle:k=>jingles.push(k),now:()=>t,goods});
 flow.event({type:'player_death',player:'me',x:5,z:6,floor:0,kept:[{item:'armor:gilded',amount:1,name:'Gilded helm'}],expiresAt:new Date(t+DEATH_PILE_MS).toISOString(),respawnAt:new Date(t+2800).toISOString()},true);
 assert.equal(flow.locked,true);assert.deepEqual(jingles,['death']);
 flow.event({type:'player_death',player:'other'},false);assert.equal(flow.remoteDying('other'),true);
 t+=2800;flow.event({type:'player_respawn',player:'me',kept:[{item:'armor:gilded',amount:1,name:'Gilded helm'}]},true);
 assert.equal(flow.locked,false);assert.equal(said[0],'Oh dear, you are dead!');assert.equal(said[1],'You kept: Gilded helm.');
 assert.equal(flow.pile().label,'Your items · 14:58');
 flow.sync({game_flags:{deathPile:{x:5,z:6,floor:0,diedAt:'d1',expiresAt:new Date(t+60000).toISOString(),ids:['q']}}},[{id:'q'}],{x:5,z:6});assert.equal(flow.pile().label,'Your items · 1:00');
 flow.sync({game_flags:{deathPile:{x:5,z:6,floor:0,diedAt:'d1',expiresAt:new Date(t+60000).toISOString(),ids:['q']}}},[],{x:5,z:6});assert.equal(flow.pile(),null,'looted empty');
 t+=10*60000;assert.equal(flow.remoteDying('other'),false);
});

test('death jingle: an original ~5 s somber cue in a minor key',()=>{
 const s=composeJingle('death');assert.ok(s.duration>=4.5&&s.duration<=5.6,String(s.duration));assert.ok(s.notes.length>12);
 assert.ok(s.notes.some(n=>n.inst==='pad')&&s.notes.some(n=>n.inst==='brass'));
 // D minor: F natural (65), never F sharp (66), unlike the D-major combat fanfare.
 assert.ok(s.notes.some(n=>n.m%12===5)&&!s.notes.some(n=>n.m%12===6));
 assert.notDeepEqual(s.notes.map(n=>n.m),composeJingle('combat').notes.map(n=>n.m));
});

test('world map skull: inline SVG with outline, bone fill and dark sockets',()=>{
 assert.match(SKULL_SVG,/^<svg viewBox="0 0 24 24"/);assert.match(SKULL_SVG,/fill="#efe6cf"/);assert.match(SKULL_SVG,/stroke="#1b1408"/);
 for(const d of Object.values(SKULL_PATHS))assert.match(d,/^M[\d .,\-A-Za-z]+$/);
});

test('server death SQL: OSRS rules, 15-minute public drops, schema-safe edits',()=>{
 const sql=fs.readFileSync(new URL('../db/osrs-death.sql',import.meta.url),'utf8'),code=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(code,/\b(drop|alter|truncate)\s+(table|function|column|schema|index)/i);
 assert.doesNotMatch(code,/\bdelete\s+from\b/i);
 assert.match(code,/death_keep_plan\(uid,3\)/);assert.match(code,/t\+interval '15 minutes'/);assert.match(code,/interval '2\.8 seconds'/);
 // The same tie order as pickKeptItems: protected, value, worn, item id.
 assert.match(code,/order by 6 desc,7 desc,3 desc,1/);
 // Respawn at the configured start point, never the old hard-coded 0,5.
 assert.match(code,/select spawn_x,spawn_z into sx,sz from eldervale_private\.settings/);
 assert.match(code,/patch_function\('eldervale_private\.world_tick\(\)'::regprocedure/);
 assert.match(code,/if position\('eldervale_private\.player_die\(' in pg_get_functiondef/);
});
