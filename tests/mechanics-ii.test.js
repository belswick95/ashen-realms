import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runDrain,runRegen,stepRunEnergy,itemWeight,hitDelay,attackTicks,weaponTicks,flinchTicks,styleXp,styleDefence,specRegen,useSpecial,prayerDrain,protectedDamage,restorePrayer,
 PRAYERS,togglePrayer,prayerMultipliers,drainTotal,protectionOf,SPECIALS,poisonDamage,poisonSchedule,venomDamage,hpRegen,consume,singleLocked,inMulti,aggroMode,isAggressive,
 stepTolerance,tolerant,leashStep,migrateLoot,pickRow,rollDrops,effectiveRates,SHARED_TABLES,parseChance,mergeConfig,DEFAULTS,POTIONS} from '../mechanics.js';
import {STYLE_BONUS,styleLabels,WEAPON_TEMPLATES,playerDefenceRoll,bonuses} from '../gear-tiers.js';
import {combatXp} from '../combat-level.js';
import {stepEnergy} from '../run-energy.js';
import {adminMechanicsRows,mechanicsSettingsPatch,validateDropTable,ruleDraft} from '../admin-mechanics.js';

test('run energy: drain and regeneration per tick match the spec vectors',()=>{
 for(const [kg,ag,eff,want] of [[0,1,{},59],[0,99,{},40],[64,1,{},126],[100,1,{},126],[32,50,{},77],[20,40,{},70],[0,1,{stamina:true},17]])assert.equal(runDrain(kg,ag,eff),want,`${kg} kg agility ${ag}`);
 assert.deepEqual([1,50,99].map(a=>runRegen(a)),[15,20,24]);assert.equal(runRegen(1,{light:true}),19);
 let e=10000,ticks=0;while(e>0){e=stepRunEnergy(e,{running:true,moved:true}).energy;ticks++}assert.equal(ticks,170,'100% to 0 in about 170 ticks');
 assert.equal(stepRunEnergy(10,{running:true,moved:true}).running,false,'the last tick takes what is left and run turns off');
 assert.equal(stepRunEnergy(0,{running:false}).energy,15);
 assert.ok(Math.abs(stepEnergy(100,true,true,.6).energy-99.41)<1e-9,'HUD percent drains 0.59 per tick at 0 kg');
});

test('item weights: catalog weight wins, defaults by kind and category',()=>{
 assert.equal(itemWeight('gold',{}),0);assert.equal(itemWeight('arrows',{stackable:true}),0);assert.equal(itemWeight('weapon:eldersteelDagger',{}),.5);assert.equal(itemWeight('weapon:twohand',{}),3.6);
 assert.equal(itemWeight('armor:steelBreastplate',{slot:'body'}),9);assert.equal(itemWeight('shrimp',{category:'Food'}),.4);assert.equal(itemWeight('x',{weight:-4.5}),-4.5);
});

test('attack speed corrections, Rapid and flinch',()=>{
 assert.equal(WEAPON_TEMPLATES.spear.ticks,4);assert.equal(WEAPON_TEMPLATES.hammer.ticks,4);
 assert.equal(weaponTicks('ironSpear',{ticks:5}),4);assert.equal(weaponTicks('warhammer',{ticks:7}),6);assert.equal(weaponTicks('bronzeHammer',{ticks:5}),4);assert.equal(weaponTicks('dagger',{ticks:4}),4);
 assert.equal(attackTicks('longbow',{ticks:6,ranged:true},'slash'),5);assert.equal(flinchTicks(4),2);assert.equal(flinchTicks(7),3);
});

test('hit delay (ticks) by style and distance; +1 against NPCs',()=>{
 for(const [kind,d,base,npc] of [['ranged',1,1,2],['ranged',3,2,3],['ranged',9,3,4],['magic',1,1,2],['magic',2,2,3],['magic',5,3,4],['magic',8,4,5],['melee',1,0,1]]){
  assert.equal(hitDelay(kind,d,false),base,`${kind} ${d}`);assert.equal(hitDelay(kind,d,true),npc,`${kind} ${d} vs NPC`)}
});

test('Defensive and Longrange styles: +3 Defence and the XP splits',()=>{
 assert.deepEqual(STYLE_BONUS.block,{att:0,str:0,def:3});assert.equal(styleDefence('block'),3);assert.equal(styleDefence('lunge',{ranged:true}),3);assert.equal(styleDefence('lunge',{}),1);
 assert.match(styleLabels({styles:{lunge:'stab'}}).block[0],/^Defensive/);assert.equal(styleLabels({ranged:true}).lunge[0],'Longrange');
 const lv={defence:40,magic:75},b=bonuses();
 assert.ok(playerDefenceRoll({levels:lv,bonuses:b,style:'lunge',type:'stab',weapon:{ranged:true}})>playerDefenceRoll({levels:lv,bonuses:b,style:'lunge',type:'stab',weapon:{}}),'Longrange +3 beats Controlled +1');
 assert.equal(playerDefenceRoll({levels:lv,bonuses:b,style:'slash',type:'magic'}),72*64,'magic defence floor(52.5+12)+8 = 72');
 assert.equal(playerDefenceRoll({levels:lv,bonuses:b,style:'block',type:'magic'}),75*64,'magic defence gets the style bonus');
 assert.deepEqual(styleXp({damage:10,style:'slash'}),{strengthXP:40,hitpointsXP:13.3});
 assert.deepEqual(styleXp({damage:10,style:'lunge'}),{attackXP:13.3,strengthXP:13.3,defenceXP:13.3,hitpointsXP:13.3});
 assert.deepEqual(styleXp({damage:10,style:'lunge',ranged:true}),{rangedXP:20,defenceXP:20,hitpointsXP:13.3});
 assert.deepEqual(styleXp({damage:0,magic:true}),{magicXP:5.5});
 assert.deepEqual(combatXp({damage:10,style:'block'}),{defenceXP:40,hitpointsXP:13.3});assert.deepEqual(combatXp({damage:10,style:'lunge',ranged:true}),{rangedXP:20,defenceXP:20,hitpointsXP:13.3});
});

test('special attack energy: spend, refuse, regenerate 10% per 50 ticks',()=>{
 const used=useSpecial(1000,55);assert.deepEqual(used,{ok:true,energy:450});
 assert.equal(specRegen(450,50),550);assert.equal(specRegen(550,250),1000);
 assert.deepEqual(useSpecial(450,50),{ok:false,energy:450});
 for(const s of Object.values(SPECIALS)){assert.ok(s.cost>=1&&s.cost<=100);assert.ok(s.name&&s.text)}
});

test('prayer: drain counter, resistance from the prayer bonus, protection 100% NPC / 40% PvP',()=>{
 let st={points:60,counter:0};for(let t=0;t<300;t++)st=prayerDrain({...st,drain:12,ticks:1});assert.equal(st.points,0,'D12 at R60 lasts 300 ticks');
 assert.deepEqual(prayerDrain({points:60,counter:0,drain:12,bonus:10,ticks:20}),{points:57,counter:0,lost:3,off:false});
 assert.equal(prayerDrain({points:60,counter:0,drain:36,ticks:5}).lost,3);assert.equal(prayerDrain({points:60,counter:0,drain:1,ticks:59}).lost,0);assert.equal(prayerDrain({points:60,counter:0,drain:1,ticks:60}).lost,1);
 assert.equal(protectedDamage(250,{protectedStyle:'melee',style:'melee'}),0);assert.equal(protectedDamage(250,{protectedStyle:'ranged',style:'melee'}),250);assert.equal(protectedDamage(30,{protectedStyle:'melee',style:'melee',pvp:true}),18);
 assert.equal(protectedDamage(250,{protectedStyle:'melee',style:'melee',pierce:true}),250);assert.equal(restorePrayer(60),22);
});

test('prayer book: original names, OSRS roles, exclusive groups, level gates',()=>{
 const roles=PRAYERS.map(p=>p.protect||Object.keys(p.effect||{}).join('+')||(p.redeem&&'redeem'));
 for(const r of ['melee','ranged','magic','def','str','att','heal','redeem'])assert.ok(roles.some(x=>String(x).includes(r)),'covers '+r);
 assert.ok(PRAYERS.every(p=>p.name&&!/protect from|piety|chivalry|smite|redemption|rapid heal/i.test(p.name)),'original names');
 let a=togglePrayer([],'wardBlades',{level:43}).active;a=togglePrayer(a,'wardArrows',{level:43}).active;assert.deepEqual(a,['wardArrows']);
 a=togglePrayer(['oakskin','keenEye'],'paragonOath',{level:70}).active;assert.deepEqual(a,['paragonOath']);
 assert.match(togglePrayer([],'paragonOath',{level:59}).error,/level 60/);assert.match(togglePrayer([],'oakskin',{level:5,points:0}).error,/run out/);
 assert.deepEqual(prayerMultipliers(['paragonOath']),{att:1.15,str:1.18,def:1.2,ranged:1,magic:1});assert.equal(drainTotal(['stoneheart','wardBlades']),24);assert.equal(protectionOf(['oakskin','wardSorcery']),'magic');
 // The SQL seed carries the same book.
 const seed=readFileSync(new URL('../db/mechanics-ii-1-core.sql',import.meta.url),'utf8');for(const p of PRAYERS)assert.ok(seed.includes(`('prayer','${p.id}'`),p.id);
 for(const k of Object.keys(SPECIALS))assert.ok(seed.includes(`('special','${k}'`),k);
});

test('poison, venom and hitpoint regeneration',()=>{
 const s=poisonSchedule(30);assert.deepEqual(s.slice(0,6),[6,6,6,6,6,5]);assert.equal(s.length,30);assert.equal(s.reduce((a,b)=>a+b,0),105);assert.equal(poisonDamage(25),5);assert.equal(poisonDamage(4),1);
 assert.deepEqual([0,1,2,3,4,5,6,7,8].map(h=>venomDamage(h)),[6,8,10,12,14,16,18,20,20]);
 assert.equal(hpRegen(50,100,100),60);assert.equal(hpRegen(50,100,100,{rapid:true}),70);assert.equal(hpRegen(99,100,1000),100);
});

test('eating, combo food and potions in ticks',()=>{
 let r=consume({attack:12},'normal',10);assert.equal(r.state.attack,15);assert.equal(r.state.eat,13);
 r=consume({attack:10},'normal',10);assert.equal(r.state.attack,10,'weapon ready: no delay added');
 r=consume({attack:11},'normal',10);r=consume(r.state,'combo',10);assert.ok(r.ok);assert.equal(r.state.attack,16,'1 + 3 + 2');
 assert.equal(consume(consume({},'normal',10).state,'normal',11).ok,false,'second normal food waits 3 ticks');assert.equal(consume(consume({},'normal',10).state,'normal',13).ok,true);
 r=consume(consume({attack:12},'normal',10).state,'potion',10);assert.ok(r.ok);assert.equal(r.state.attack,15,'potion adds no attack delay');
 for(const p of Object.values(POTIONS))assert.ok(p.name&&p.text);
});

test('aggression, single-way lock, multi zones, tolerance and leash',()=>{
 assert.equal(isAggressive(56,28),true);assert.equal(isAggressive(57,28),false);assert.equal(isAggressive(126,63),true);assert.equal(isAggressive(126,2,'always'),true);assert.equal(isAggressive(3,99,'never'),false);
 assert.equal(aggroMode({hostile:true}),'level');assert.equal(aggroMode({boss:true}),'always');assert.equal(aggroMode({}),'never');
 assert.equal(singleLocked(100,105),true);assert.equal(singleLocked(100,108),false);
 assert.equal(inMulti([{x1:0,z1:0,x2:10,z2:10,multi:true}],5,5),true);assert.equal(inMulti([{x1:0,z1:0,x2:10,z2:10,multi:true}],15,5),false);
 let t=stepTolerance(null,100,100,0);for(let k=1;k<=1000;k++)t=stepTolerance(t,100,100,k);assert.equal(tolerant(t,1000),true);assert.equal(tolerant(t,999),false);
 t=stepTolerance(stepTolerance(null,100,100,0),112,100,600);assert.equal(t.since,600);assert.equal(tolerant(t,1599),false);assert.equal(tolerant(t,1600),true);
 assert.equal(leashStep({x:0,z:0},{x:7,z:0},7),true);assert.equal(leashStep({x:0,z:0},{x:8,z:0},7),false);
});

test('drop tables v2: one weighted main roll, shared tables, tertiary, migration',()=>{
 const main={denom:128,rows:[{weight:64,item:'A'},{weight:32,item:'B'},{weight:16,item:'C'},{weight:2,table:'gems'}]};
 const at=r=>{const row=pickRow(main,r);return row?.item||row?.table||'nothing'};
 assert.deepEqual([0,63,64,95,96,111,112,113,114,127].map(at),['A','A','B','B','C','C','gems','gems','nothing','nothing']);
 const rates=effectiveRates({main:{denom:128,rows:[{weight:2,table:'gems'}]}},{gems:{denom:128,rows:[{weight:32,item:'sapphire'}]}});assert.equal(rates[0].oneIn,256);
 let seed=7;const rng=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const drops={always:[{item:'bones'}],main:{denom:128,rows:[{weight:1,item:'rare'},{weight:63,item:'common'}]},tertiary:[{item:'clue',chance:'1/64'}]};
 const one=rollDrops(drops,{rng:()=>0});assert.deepEqual(one.map(d=>d.item),['bones','rare','clue'],'a kill can give always + main + tertiary');
 let n=0;const N=200000;for(let i=0;i<N;i++)if(rollDrops({main:drops.main},{rng}).some(d=>d.item==='rare'))n++;
 const mean=N/128,sd=Math.sqrt(N*(1/128)*(127/128));assert.ok(Math.abs(n-mean)<3*sd,`rare count ${n} within 3 sigma of ${mean.toFixed(0)}`);
 const v2=migrateLoot([{item:'bones',always:true},{item:'thread',min:1,max:3,chance:.35},{item:'gem',chance:.06}]);
 assert.deepEqual(v2.always,[{item:'bones',min:1,max:1}]);assert.deepEqual(v2.main.rows.map(r=>[r.item,r.weight]),[['thread',45],['gem',8]]);
 const over=migrateLoot([{item:'a',chance:.9},{item:'b',chance:.7}]);const sum=over.main.rows.reduce((s,r)=>s+r.weight,0);assert.ok(sum<=128&&sum>=126,'re-normalised to the denominator: '+sum);
 assert.equal(parseChance('1/64'),1/64);assert.ok(SHARED_TABLES.rare.rows.reduce((s,r)=>s+r.weight,0)<=128);
});

test('HUD helpers: prayer rows and the special bar',async()=>{
 const {prayerRows,specPercent,createMechanicsHud}=await import('../mechanics-hud.js');
 const rows=prayerRows(PRAYERS,{level:40,active:['wardArrows'],quick:['oakskin']});
 assert.equal(rows.find(r=>r.id==='wardArrows').on,true);assert.equal(rows.find(r=>r.id==='wardBlades').locked,true);assert.equal(rows.find(r=>r.id==='oakskin').quick,true);
 assert.equal(specPercent(755),75);assert.equal(specPercent(1000),100);
 const hud=createMechanicsHud({doc:null});assert.equal(hud.drink('antidote'),false);
});

test('settings merge and the Game console helpers',()=>{
 const c=mergeConfig({run:{drain_base:30},enabled:false});assert.equal(c.run.drain_base,30);assert.equal(c.run.regen_base,15);assert.equal(c.enabled,false);assert.equal(DEFAULTS.aggro.tolerance_ticks,1000);
 assert.deepEqual(mechanicsSettingsPatch({'run.drain_base':'45','combat.flinch':false,enabled:true}),{run:{drain_base:45},combat:{flinch:false},enabled:true});
 assert.throws(()=>mechanicsSettingsPatch({'run.drain_base':'-3'}),/0/);
 assert.deepEqual(validateDropTable({denom:10,rows:[{item:'a',weight:11}]}),['Row weights add up to 11, more than the denominator 10.']);
 assert.deepEqual(validateDropTable({denom:128,rows:[{item:'a',weight:64}]}),[]);
 const rows=adminMechanicsRows([{kind:'prayer',id:'oakskin',data:{name:'Oakskin',level:1},enabled:true},{kind:'zone',id:'z',data:{},enabled:false}],'prayer');assert.equal(rows.length,1);
 assert.deepEqual(ruleDraft('poison','type:sting','{"severity":4,"chance":0.2}'),{kind:'poison',id:'type:sting',data:{severity:4,chance:.2}});assert.throws(()=>ruleDraft('poison','x','{bad'),/JSON/);
});
