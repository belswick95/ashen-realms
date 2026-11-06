// Combat & mechanics II (docs/mechanics-spec.md §3–§8): the pure rules behind run energy and
// weight, prayer drain and protection, special attack energy, poison and venom, NPC aggression and
// tolerance, single/multi combat, eat/drink tick delays, arrow recovery and drop tables v2.
// The server (db/mechanics-ii-*.sql) is authoritative; these mirror it for prediction, the HUD,
// the Game console and the tests. Every timer is in 600 ms game ticks; mechanics match OSRS, all
// names (prayers, specials, potions) are original to Eldervale.
export const TICK=.6;
export const DEFAULTS={
 enabled:true,
 run:{drain_base:60,weight_factor:67,weight_cap:64,agility_drain_div:300,regen_base:15,agility_regen_div:10,stamina_mult:.3,light_mult:1.3,min_to_run:5},
 combat:{independent:true,flinch:true,auto_retaliate:true,single_lock_ticks:8,interest_ticks:16},
 prayer:{protect_npc_pct:100,protect_pvp_pct:40,resist_base:60,resist_per_bonus:2},
 spec:{max:1000,regen_amount:100,regen_ticks:50},
 poison:{interval:30,melee_chance:.25,ranged_chance:.125,venom_start:6,venom_step:2,venom_cap:20},
 regen:{hp_ticks:10,hp_amount:1},
 food:{eat_delay:3,combo_delay:3,drink_delay:3,eat_attack_add:3,combo_attack_add:2},
 ammo:{recover_chance:.8},
 aggro:{level_factor:2,always_level:63,hunt_range:4,boss_hunt_range:8,max_range:7,tolerance_ticks:1000,tolerance_square:21,retreat_extra:11},
 drops:{denom:128,rare_level:40,rare_weight:1}
};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const num=(v,fb=0)=>Number.isFinite(Number(v))?Number(v):fb;
export function mergeConfig(stored={}){const out={};for(const [k,v] of Object.entries(DEFAULTS))out[k]=v&&typeof v==='object'?{...v,...(stored?.[k]||{})}:(k in (stored||{})?stored[k]:v);return out}

// ---- §3 Run energy and weight (energy 0..10 000; the HUD shows floor(energy/100) %) ----
export function runDrain(weightKg=0,agility=1,{stamina=false,endurance=false}={},c=DEFAULTS.run){
 const w=clamp(num(weightKg),0,c.weight_cap);let d=Math.floor((c.drain_base+c.weight_factor*w/c.weight_cap)*(1-clamp(num(agility,1),1,99)/c.agility_drain_div));
 if(stamina)d=Math.floor(c.stamina_mult*d);if(endurance)d=Math.floor(.85*d);return d;
}
export function runRegen(agility=1,{light=false}={},c=DEFAULTS.run){const r=Math.floor(clamp(num(agility,1),1,99)/c.agility_regen_div)+c.regen_base;return light?Math.floor(c.light_mult*r):r}
// One tick: running drains (the last tick takes what is left, then run switches off); walking and
// standing regenerate.
export function stepRunEnergy(energy,{running=false,moved=false,weight=0,agility=1,stamina=false,light=false}={},c=DEFAULTS.run){
 const e=clamp(Math.floor(num(energy,10000)),0,10000);
 if(running&&moved){const next=Math.max(0,e-runDrain(weight,agility,{stamina},c));return {energy:next,running:next>0,exhausted:next===0&&e>0}}
 return {energy:Math.min(10000,e+runRegen(agility,{light},c)),running,exhausted:false};
}
// Item weights in kg: explicit catalog `weight` wins, else a default by kind and category.
export const WEAPON_WEIGHT={dagger:.5,scimitar:1.8,longsword:1.8,hammer:1.8,battleaxe:3,twohand:3.6,spear:2.2,warhammer:3.6,scythe:3.2,claymore:3.6,shortsword:1.4,bow:1.2,staff:2.2,axe:1.4,pickaxe:2.3};
export const ARMOUR_WEIGHT={helmet:1.5,head:1.5,body:9,chest:9,legs:7,feet:1,boots:1,hands:.5,gloves:.5,shield:5,cape:.4,shoulders:2,amulet:.01,trinket:.01};
const CATEGORY_WEIGHT={Food:.4,Potions:.03,Bars:1.8,Ores:2.2,Timber:2,Tools:1,Herbs:.03,Seeds:.01,Runes:0,Prayer:.5,Ingredients:.3,Materials:.2,'Trade goods':.5};
export function itemWeight(id,d={}){
 if(Number.isFinite(Number(d.weight)))return Number(d.weight);
 const key=String(id||'').replace(/^item:/,'');
 if(/^(gold|coins?)$/.test(key)||/arrows?$|Arrows$|Rune$|rune$|arrowtips$|Arrowtips$/.test(key)||d.stackable)return 0;
 if(/^weapon:|^weapons?Owned/.test(key)||d.field==='weaponsOwned'){const k=key.split(':').pop().toLowerCase();for(const [t,w] of Object.entries(WEAPON_WEIGHT))if(k.endsWith(t.toLowerCase()))return w;return /bow/.test(k)?1.2:/staff/.test(k)?2.2:1.8}
 if(/^shield:/.test(key)||d.field==='shieldsOwned')return 5;
 if(/^jewelry:/.test(key)||d.field==='jewelryOwned')return .01;
 if(/^mount:/.test(key)||d.field==='mountsOwned')return 0;
 if(/^armor:/.test(key)||d.field==='armorOwned'){const s=String(d.slot||key).toLowerCase();for(const [t,w] of Object.entries(ARMOUR_WEIGHT))if(s.includes(t))return w;return 2}
 return CATEGORY_WEIGHT[d.category]??.5;
}
export const formatWeight=kg=>(Math.round(num(kg)*10)/10).toFixed(1)+' kg';

// ---- §4.1/§4.3 Attack speed and hit delay ----
// Corrected weapon speeds (OSRS ticks): spear 4, warhammer 6, hammer 4 (mace-like bonuses).
export const SPEED_FIX={spear:4,warhammer:6,hammer:4};
export function weaponTicks(key='',w={}){const k=String(key).toLowerCase();for(const [t,n] of Object.entries(SPEED_FIX))if(k===t||k.endsWith(t))return t==='hammer'&&k.endsWith('warhammer')?SPEED_FIX.warhammer:n;return Math.max(1,Math.round(num(w.ticks,num(w.speed,1.8)/.45)))}
export function attackTicks(key,w={},style='slash'){return Math.max(1,weaponTicks(key,w)-(w.ranged&&!w.magic&&style==='slash'?1:0))}
export const chebyshev=(ax,az,bx,bz)=>Math.max(Math.abs(ax-bx),Math.abs(az-bz));
export function hitDelay(kind,d,vsNpc=true){
 d=Math.max(0,Math.floor(num(d)));
 const base=kind==='ranged'?1+Math.floor((3+d)/6):kind==='thrown'?1+Math.floor(d/6):kind==='magic'?1+Math.floor((1+d)/3):0;
 return base+(vsNpc?1:0);
}
// Flinch: idle with auto-retaliate and a ready weapon → the next swing waits half the weapon speed.
export const flinchTicks=speed=>Math.floor(num(speed,4)/2);

// ---- §4.4 Combat XP (OSRS units of damage) with the Defensive and Longrange splits ----
const xp2=n=>Math.round(n*100)/100;
export function styleXp({damage=0,style='slash',ranged=false,magic=false,spellXp=5.5}={}){
 const d=Math.max(0,num(damage)),share=xp2(1.33*d),out={};const add=(k,n)=>{if(n>0)out[k]=xp2((out[k]||0)+n)};
 if(magic)add('magicXP',2*d+spellXp);else if(ranged){if(style==='lunge'||style==='block'){add('rangedXP',2*d);add('defenceXP',2*d)}else add('rangedXP',4*d)}
 else if(style==='stab')add('attackXP',4*d);else if(style==='block')add('defenceXP',4*d);else if(style==='lunge'){add('attackXP',share);add('strengthXP',share);add('defenceXP',share)}else add('strengthXP',4*d);
 add('hitpointsXP',share);return out;
}
// Defence style bonus: Defensive +3, Controlled +1, Longrange (bow lunge) +3, defensive casting +3.
export function styleDefence(style,w={}){if(style==='block')return 3;if(style==='lunge')return w?.ranged&&!w?.magic?3:w?.magic?0:1;return 0}

// ---- §4.5 Special attack energy (0..1000) ----
export function specRegen(energy,ticks,c=DEFAULTS.spec){const periods=Math.floor(Math.max(0,num(ticks))/c.regen_ticks);return Math.min(c.max,num(energy,c.max)+periods*c.regen_amount)}
export function useSpecial(energy,costPct){const cost=Math.round(num(costPct)*10);return energy>=cost?{ok:true,energy:energy-cost}:{ok:false,energy}}

// ---- §4.6 Prayer ----
export const prayerResistance=(bonus=0,c=DEFAULTS.prayer)=>c.resist_base+c.resist_per_bonus*num(bonus);
// n ticks of drain: counter += Σdrain each tick; every R points of counter cost one prayer point.
export function prayerDrain({points,counter=0,drain=0,bonus=0,ticks=1},c=DEFAULTS.prayer){
 const R=prayerResistance(bonus,c);let k=counter+drain*Math.max(0,ticks),lost=Math.floor(k/R);k-=lost*R;const left=Math.max(0,points-lost);
 return {points:left,counter:left>0?k:0,lost:Math.min(points,lost),off:left===0};
}
export function protectedDamage(damage,{protectedStyle=null,style='melee',pvp=false,pierce=false},c=DEFAULTS.prayer){
 if(!protectedStyle||protectedStyle!==style||pierce)return damage;
 return pvp?Math.floor(damage*(100-c.protect_pvp_pct)/100):Math.floor(damage*(100-c.protect_npc_pct)/100);
}
export const restorePrayer=prayerLevel=>Math.floor(7+.25*prayerLevel);
// Original Eldervale prayer book. effect: multipliers on the base level inside the effective level;
// protect: the style blocked; groups: activating one turns off any active prayer sharing a group.
export const PRAYERS=[
 {id:'oakskin',name:'Oakskin',level:1,drain:1,groups:['defence'],effect:{def:1.05},icon:'🌳',text:'+5% Defence.'},
 {id:'bearMight',name:"Bear's Might",level:4,drain:1,groups:['strength'],effect:{str:1.05},icon:'🐻',text:'+5% Strength.'},
 {id:'keenEye',name:'Keen Eye',level:7,drain:1,groups:['attack'],effect:{att:1.05},icon:'👁',text:'+5% Attack.'},
 {id:'archerBreath',name:"Archer's Breath",level:8,drain:1,groups:['attack','strength','ranged','magic'],effect:{ranged:1.05},icon:'🏹',text:'+5% Ranged.'},
 {id:'sparkInsight',name:'Spark of Insight',level:9,drain:1,groups:['attack','strength','ranged','magic'],effect:{magic:1.05},icon:'✨',text:'+5% Magic.'},
 {id:'ironbarkSkin',name:'Ironbark Skin',level:10,drain:6,groups:['defence'],effect:{def:1.1},icon:'🪵',text:'+10% Defence.'},
 {id:'oxStrength',name:'Ox Strength',level:13,drain:6,groups:['strength'],effect:{str:1.1},icon:'🐂',text:'+10% Strength.'},
 {id:'hawkFocus',name:'Hawk Focus',level:16,drain:6,groups:['attack'],effect:{att:1.1},icon:'🦅',text:'+10% Attack.'},
 {id:'swiftMending',name:'Swift Mending',level:22,drain:2,groups:['heal'],effect:{heal:2},icon:'💗',text:'Hitpoints regenerate twice as fast.'},
 {id:'fletcherCalm',name:"Fletcher's Calm",level:26,drain:6,groups:['attack','strength','ranged','magic'],effect:{ranged:1.1},icon:'🎯',text:'+10% Ranged.'},
 {id:'runewardMind',name:'Runeward Mind',level:27,drain:6,groups:['attack','strength','ranged','magic'],effect:{magic:1.1},icon:'🔮',text:'+10% Magic.'},
 {id:'stoneheart',name:'Stoneheart',level:28,drain:12,groups:['defence'],effect:{def:1.15},icon:'🪨',text:'+15% Defence.'},
 {id:'titanGrip',name:"Titan's Grip",level:31,drain:12,groups:['strength'],effect:{str:1.15},icon:'💪',text:'+15% Strength.'},
 {id:'eagleClarity',name:'Eagle Clarity',level:34,drain:12,groups:['attack'],effect:{att:1.15},icon:'🦉',text:'+15% Attack.'},
 {id:'wardSorcery',name:'Ward of Sorcery',level:37,drain:12,groups:['protect'],protect:'magic',icon:'🌀',text:'Blocks magic attacks from creatures (40% from players).'},
 {id:'wardArrows',name:'Ward of Arrows',level:40,drain:12,groups:['protect'],protect:'ranged',icon:'🛡',text:'Blocks ranged attacks from creatures (40% from players).'},
 {id:'wardBlades',name:'Ward of Blades',level:43,drain:12,groups:['protect'],protect:'melee',icon:'⚔',text:'Blocks melee attacks from creatures (40% from players).'},
 {id:'windreader',name:'Windreader',level:44,drain:12,groups:['attack','strength','ranged','magic'],effect:{ranged:1.15},icon:'🍃',text:'+15% Ranged.'},
 {id:'starlitMind',name:'Starlit Mind',level:45,drain:12,groups:['attack','strength','ranged','magic'],effect:{magic:1.15},icon:'🌟',text:'+15% Magic.'},
 {id:'lastLight',name:'Last Light',level:49,drain:6,groups:['protect'],redeem:true,icon:'🕯',text:'Below 10% health: heals you by a quarter of your Prayer level and spends all prayer.'},
 {id:'paragonOath',name:"Paragon's Oath",level:60,drain:24,groups:['attack','strength','defence','ranged','magic'],effect:{att:1.15,str:1.18,def:1.2},icon:'👑',text:'+15% Attack, +18% Strength, +20% Defence.'}
];
export const prayerById=list=>Object.fromEntries((list||PRAYERS).map(p=>[p.id,p]));
// Turn one prayer on/off: level gate, points gate, exclusive groups.
export function togglePrayer(active=[],id,{level=1,points=1,list=PRAYERS}={}){
 const book=prayerById(list),p=book[id];if(!p)return {active,error:'Unknown prayer'};
 if(active.includes(id))return {active:active.filter(x=>x!==id)};
 if(level<p.level)return {active,error:'You need Prayer level '+p.level+' for '+p.name+'.'};
 if(points<=0)return {active,error:'You have run out of prayer points. Recharge at an altar.'};
 const groups=new Set(p.groups||[]);return {active:[...active.filter(x=>!(book[x]?.groups||[]).some(g=>groups.has(g))),id]};
}
export function prayerMultipliers(active=[],list=PRAYERS){const book=prayerById(list),m={att:1,str:1,def:1,ranged:1,magic:1};for(const id of active)for(const [k,v] of Object.entries(book[id]?.effect||{}))if(k in m)m[k]=Math.max(m[k],v);return m}
export const drainTotal=(active=[],list=PRAYERS)=>{const book=prayerById(list);return active.reduce((s,id)=>s+(book[id]?.drain||0),0)};
export const protectionOf=(active=[],list=PRAYERS)=>{const book=prayerById(list);for(const id of active)if(book[id]?.protect)return book[id].protect;return null};

// ---- Special attacks (original designs; energy economy as OSRS) ----
export const SPECIALS={
 eldersteelDagger:{name:'Twin Fangs',cost:25,hits:2,accMult:1.15,dmgMult:1.15,text:'Two quick stabs, each more accurate and harder.'},
 embersteelLongsword:{name:'Cinder Cleave',cost:25,dmgMult:1.25,text:'A searing cut for 25% more damage.'},
 eldersteelSpear:{name:'Pinning Thrust',cost:25,accMult:1.5,effect:'bind',bindTicks:5,text:'A sure thrust that pins the target in place for 5 ticks.'},
 goldenSword:{name:'Gilded Flourish',cost:50,accMult:2,dmgMult:1.1,text:'A showy, near-certain strike.'},
 warhammer:{name:'Bone Breaker',cost:50,effect:'drainDefence',drainPct:30,text:'On a hit, lowers the target\'s Defence by 30%.'},
 scythe:{name:'Harvest Moon',cost:50,effect:'heal',healPct:50,text:'Heals you for half the damage dealt.'},
 claymore:{name:'Mountainfall',cost:60,accMult:1.25,dmgMult:1.375,text:'A crushing overhead blow.'},
 bloodthornBow:{name:'Thorn Volley',cost:55,hits:2,accMult:1.1,text:'Looses two arrows at once.'},
 emberStaff:{name:'Pyre Burst',cost:50,accMult:1.5,dmgMult:1.5,text:'A roaring blast of flame.'}
};

// ---- §4.7 Poison, venom; §4.10 HP regeneration ----
export const poisonDamage=severity=>Math.floor(num(severity)/5+.8);
export function poisonSchedule(severity){const out=[];for(let s=severity;s>0;s--)out.push(poisonDamage(s));return out}
export const venomDamage=(hit,c=DEFAULTS.poison)=>Math.min(c.venom_cap,c.venom_start+c.venom_step*Math.max(0,hit));
export function hpRegen(hp,max,ticks,{rapid=false}={},c=DEFAULTS.regen){const periods=Math.floor(Math.max(0,ticks)/c.hp_ticks)*(rapid?2:1);return hp>=max?hp:Math.min(max,hp+periods*c.hp_amount)}

// ---- §4.8 Eating, combo food, potions ----
// state: {attack, eat, combo, drink} = the tick each timer is free again (attack: next swing).
export function consume(state,kind,now,c=DEFAULTS.food){
 const s={attack:0,eat:0,combo:0,drink:0,...state};
 if(kind==='potion'){if(s.drink>now)return {ok:false,state:s};return {ok:true,state:{...s,drink:now+c.drink_delay}}}
 const combo=kind==='combo',gate=combo?s.combo:s.eat;if(gate>now)return {ok:false,state:s};
 const add=combo?c.combo_attack_add:c.eat_attack_add,attack=s.attack>now?s.attack+add:s.attack;
 return {ok:true,state:{...s,attack,[combo?'combo':'eat']:now+(combo?c.combo_delay:c.eat_delay)}};
}
export const FOOD_CLASS={sundae:'combo'};

// ---- §5/§6 Single/multi combat, aggression, tolerance, leash ----
export function inMulti(zones=[],x,z,floor=0){return zones.some(q=>q.multi&&(q.floor??0)===floor&&x>=Math.min(q.x1,q.x2)&&x<=Math.max(q.x1,q.x2)&&z>=Math.min(q.z1,q.z2)&&z<=Math.max(q.z1,q.z2))}
export const singleLocked=(lastHitTick,now,c=DEFAULTS.combat)=>lastHitTick!=null&&now-lastHitTick<c.single_lock_ticks;
export function aggroMode(m={}){if(m.aggroMode)return m.aggroMode;if(m.boss)return 'always';return m.hostile?'level':'never'}
export function isAggressive(playerCombat,npcLevel,mode='level',c=DEFAULTS.aggro){if(mode==='never')return false;if(mode==='always')return true;return npcLevel>=c.always_level||playerCombat<=c.level_factor*npcLevel}
// Tolerance: two 21×21 squares (A where you arrived, B where you met the aggressive area); leaving
// both rebuilds A at the exit tile and resets the clock.
export function stepTolerance(t,ti,tj,now,c=DEFAULTS.aggro){
 const h=Math.floor(c.tolerance_square/2),inside=(x,z)=>x!=null&&Math.abs(ti-x)<=h&&Math.abs(tj-z)<=h;
 if(!t||t.since==null)return {ax:ti,az:tj,bx:ti,bz:tj,since:now};
 if(inside(t.ax,t.az)||inside(t.bx,t.bz))return t;
 return {ax:ti,az:tj,bx:ti,bz:tj,since:now};
}
export const tolerant=(t,now,ticks=DEFAULTS.aggro.tolerance_ticks)=>ticks!=null&&t?.since!=null&&now-t.since>=ticks;
// Leash: an NPC never steps beyond maxRange tiles of its spawn while chasing.
export function leashStep(spawn,next,maxRange=7){return chebyshev(spawn.x,spawn.z,next.x,next.z)<=maxRange}

// ---- §8 Drop tables v2 ----
// Old independent rows → one weighted main table: weight ≈ chance × denom, re-normalised if the
// sum passes denom; always rows stay always.
export function migrateLoot(loot=[],denom=128){
 const always=[],rows=[];for(const l of (loot||[]).slice(0,8)){if(!l?.item)continue;const q={item:l.item,min:Math.max(1,num(l.min,1)),max:Math.max(num(l.min,1),num(l.max,num(l.min,1)))};if(l.always)always.push(q);else rows.push({...q,weight:Math.max(1,Math.round(clamp(num(l.chance,1),0,1)*denom))})}
 const sum=rows.reduce((s,r)=>s+r.weight,0);if(sum>denom){const f=denom/sum;let left=denom;rows.forEach((r,i)=>{r.weight=Math.max(1,Math.floor(r.weight*f));left-=r.weight});if(left<0){const big=rows.reduce((a,b)=>b.weight>a.weight?b:a);big.weight+=left}}
 return {always,main:{denom,rows},tertiary:[]};
}
// One roll on a weighted table: r in [0, denom). Returns the row or null (nothing).
export function pickRow(table,r){let acc=0;for(const row of table?.rows||[]){acc+=num(row.weight);if(r<acc)return row}return null}
export function rollDrops(drops,{rng=Math.random,tables={},rateMult=1}={}){
 const out=[],qty=(row)=>row.min+Math.floor(rng()*(Math.max(row.min,row.max??row.min)-row.min+1));
 for(const a of drops?.always||[])out.push({item:a.item,amount:qty({min:num(a.min,1),max:num(a.max,num(a.min,1))}),source:'always'});
 let replaced=false;for(const p of drops?.preroll||[])if(rng()<parseChance(p.chance)*rateMult){out.push({item:p.item,amount:qty({min:num(p.min,1),max:num(p.max,num(p.min,1))}),source:'preroll'});if(p.replacesMain)replaced=true}
 if(!replaced&&drops?.main){const denom=num(drops.main.denom,128);let row=pickRow(drops.main,Math.floor(rng()*denom/Math.max(.0001,rateMult)));let depth=0;
  while(row?.table&&tables[row.table]&&depth++<3){const t=tables[row.table];row=pickRow(t,Math.floor(rng()*num(t.denom,128)))}
  if(row?.item)out.push({item:row.item,amount:qty({min:num(row.min,1),max:num(row.max,num(row.min,1))}),source:'main'})}
 for(const t of drops?.tertiary||[])if(rng()<parseChance(t.chance)*rateMult)out.push({item:t.item,amount:qty({min:num(t.min,1),max:num(t.max,num(t.min,1))}),source:'tertiary'});
 return out;
}
export function parseChance(c){if(typeof c==='number')return clamp(c,0,1);const m=String(c||'').match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);return m?clamp(Number(m[1])/Number(m[2]),0,1):clamp(num(c),0,1)}
export function effectiveRates(drops,tables={}){
 const denom=num(drops?.main?.denom,128),rows=[];
 for(const r of drops?.main?.rows||[]){const p=num(r.weight)/denom;if(r.table&&tables[r.table]){const t=tables[r.table];for(const s of t.rows||[])if(s.item)rows.push({item:s.item,p:p*num(s.weight)/num(t.denom,128),via:r.table})}else if(r.item)rows.push({item:r.item,p})}
 for(const t of drops?.tertiary||[])rows.push({item:t.item,p:parseChance(t.chance),tertiary:true});
 return rows.map(r=>({...r,oneIn:r.p>0?Math.round(1/r.p*10)/10:Infinity}));
}
export const SHARED_TABLES={
 rare:{denom:128,rows:[{weight:8,item:'uncutGem',min:1,max:2},{weight:4,item:'cutGem',min:1,max:1},{weight:3,item:'runiteBar',min:1,max:1},{weight:2,item:'silverRing',min:1,max:1},{weight:2,item:'embersteelArrows',min:5,max:15},{weight:1,item:'wyrmBones',min:1,max:1},{weight:20,item:'gold',min:200,max:600}]},
 gems:{denom:128,rows:[{weight:32,item:'uncutGem',min:1,max:1},{weight:8,item:'cutGem',min:1,max:1},{weight:1,table:'rare'}]}
};

// ---- Potions (original names) ----
export const POTIONS={
 antidote:{name:'Mosswort antidote',cure:'poison',immunity:150,buy:40,text:'Cures poison and wards it off for 90 seconds.'},
 serpentbaneTonic:{name:'Serpentbane tonic',cure:'venom',immunity:600,buy:180,text:'Cures poison and venom; immunity for 6 minutes.'},
 shrineDraught:{name:'Shrine draught',prayer:true,buy:90,text:'Restores 7 + a quarter of your Prayer level in prayer points.'},
 briskTonic:{name:'Brisk tonic',energy:1000,buy:30,text:'Restores 10% run energy.'},
 windstepBrew:{name:'Windstep brew',stamina:200,energy:2000,buy:120,text:'Restores 20% run energy; running drains 70% less for 2 minutes.'}
};
