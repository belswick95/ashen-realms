// Eldervale bosses as data: phased fights, telegraphed attacks, adds, enrage, lairs and the dragon
// rules. Pure data and maths (no Three.js): the client (boss-fx.js), the Game console
// (admin-bosses.js), the tests and scripts/build-bosses-sql.mjs (which seeds
// eldervale_private.boss_defs and the lair areas) all read these numbers. The server twin of the
// helpers below is in db/bosses-1-core.sql (boss_tiles, boss_breath_mult, boss_phase_at).
//
// A boss definition (stored per boss in eldervale_private.boss_defs.data, editable in the console):
//  {id (= rosterKey), name, level, lair:{area,level,room,unlock}, arena:{radius (tiles from spawn)},
//   attackTicks, respawnTicks, resetTicks (idle ticks before the fight resets),
//   attacks:{key:{name, kind, style, maxHit, tell, shape, radius, count, element, add, text, color, sound}},
//   phases:[{at (HP % that starts it), name, pattern:[attack keys, in order], attackTicks?, onEnter?:[keys],
//            immune?, immuneWhileAdds?, text?}],
//   enrage:{afterTicks, attackTicksMinus, damagePct, text},
//   uniques:[{item, chance:'1/n'}]   (also the preroll rows of its loot table)}
// Attack kinds:
//  strike    a normal hit in `style` (melee | ranged | magic): pray to block it. The projectile colour
//            (color) is the tell for prayer switching.
//  telegraph marked tiles (shape around the target or the boss), resolved `tell` ticks later on
//            whoever still stands there: step off. Area damage ignores protection prayers.
//  charge    a charge-up (`tell` ticks) then a hit on the target in `style`: pray the right style.
//  breath    dragonfire / frost breath: a charge-up then a hit reduced by breath protection
//            (anti-breath shield, Breathward tonic, Ward of Sorcery). With a `shape` it is an area.
//  summon    spawns `count` adds of roster monster `add` around the boss (multi-combat arena).
//  flight    takes off for `ticks` (untargetable by melee, no attacks), sweeps `sweep` (a breath
//            attack key) across the arena, then lands on marked tiles around the target.
export const TILE=1.58;
export const ATTACK_KINDS=['strike','telegraph','charge','breath','summon','flight'];
export const STYLES=['melee','ranged','magic'];
export const SHAPES=['target','around','ring','line','cross','behind','scatter'];
export const ELEMENTS={fire:{color:0xff6a1a,label:'fire'},frost:{color:0x8fd8ff,label:'frost'}};

// ---------------------------------------------------------------- dragon breath
// Damage multipliers (owner-tunable: boss settings 'breath'). Shield, tonic and prayer stack
// multiplicatively: 0.15 * 0.30 * 0.40 = 0.018 of the unprotected hit.
export const BREATH_DEFAULTS={enabled:true,shieldPct:15,aegisPct:8,potionPct:30,prayerPct:40,dragonChance:.25,dragonMaxHit:300,potionTicks:500,
 shields:{scalewardShield:'shieldPct',wardensAegis:'aegisPct'}};
export function breathMultiplier({shield=null,potion=false,protectMagic=false}={},s=BREATH_DEFAULTS){
 let m=1;const key=s.shields?.[shield];if(key)m*=(Number(s[key])||100)/100;if(potion)m*=(Number(s.potionPct)||100)/100;if(protectMagic)m*=(Number(s.prayerPct)||100)/100;
 return Math.round(m*10000)/10000;
}
export const breathDamage=(raw,prot,s)=>Math.floor(raw*breathMultiplier(prot,s));

// ---------------------------------------------------------------- telegraph tiles
// Tiles are world tile indices (i,j); a tile is centred on (i*TILE, j*TILE). c = the target tile,
// b = the boss tile. Same order and arithmetic as eldervale_private.boss_tiles (scatter is random
// on the server; here it uses the given rng).
export function telegraphTiles(shape,{c=[0,0],b=[0,0],radius=1,count=6,rng=Math.random}={}){
 const out=[],r=Math.max(0,Math.min(12,radius|0));
 if(shape==='target'){for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++)out.push([c[0]+di,c[1]+dj])}
 else if(shape==='around'){for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++)if(di||dj)out.push([b[0]+di,b[1]+dj])}
 else if(shape==='ring'){for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++)if(Math.max(Math.abs(di),Math.abs(dj))>=Math.max(2,r-1))out.push([b[0]+di,b[1]+dj])}
 else if(shape==='cross'){out.push([c[0],c[1]]);for(let k=1;k<=r;k++)out.push([c[0]+k,c[1]],[c[0]-k,c[1]],[c[0],c[1]+k],[c[0],c[1]-k])}
 else if(shape==='line'||shape==='behind'){
  let dx=c[0]-b[0],dz=c[1]-b[1];if(!dx&&!dz)dz=1;const sx=Math.sign(dx),sz=Math.sign(dz),dir=shape==='behind'?-1:1;
  const major=Math.abs(dx)>=Math.abs(dz),ux=major?sx*dir:0,uz=major?0:sz*dir,px=major?0:1,pz=major?1:0;
  for(let k=1;k<=Math.max(1,r);k++)for(let w=-1;w<=1;w++)out.push([b[0]+ux*k+px*w,b[1]+uz*k+pz*w]);
 }
 else if(shape==='scatter'){const seen=new Set();for(let k=0;k<Math.min(24,count);k++){const t=[c[0]+Math.floor(rng()*(2*r+1))-r,c[1]+Math.floor(rng()*(2*r+1))-r],key=t.join();if(!seen.has(key)){seen.add(key);out.push(t)}}}
 return out;
}
export const tileOf=v=>Math.floor(v/TILE+.5);
export const tileCentre=([i,j])=>({x:i*TILE,z:j*TILE});

// ---------------------------------------------------------------- phases, enrage, pattern
// The phase for an HP percentage: the last phase whose `at` is >= the percentage.
export function phaseAt(def,hpPct){const ph=def?.phases||[];let k=0;for(let i=0;i<ph.length;i++)if(hpPct<=ph[i].at)k=i;return k}
export function nextAttack(def,phase,cursor){const p=def.phases[phase]||def.phases[0],pat=p.pattern||[];return pat.length?pat[((cursor%pat.length)+pat.length)%pat.length]:null}
export function attackTicksFor(def,phase,enraged){const p=def.phases[phase]||{};return Math.max(2,(p.attackTicks||def.attackTicks||5)-(enraged?(def.enrage?.attackTicksMinus||0):0))}
export const enraged=(def,ticks)=>!!def.enrage&&ticks>=def.enrage.afterTicks;
export const parseOneIn=c=>{if(typeof c==='number')return c;const m=/^\s*1\s*\/\s*([\d.]+)\s*$/.exec(String(c||''));return m?1/Number(m[1]):Number(c)||0};
// Personal best text (ticks → m:ss.s).
export function formatTicks(t){if(!(t>0))return '—';const s=t*.6,m=Math.floor(s/60);return m+':'+(s-m*60).toFixed(1).padStart(4,'0')}

// ---------------------------------------------------------------- boss definitions
const A=(name,kind,o={})=>({name,kind,...o});
export const BOSSES=[
 {id:'grimtusk',name:'Grimtusk the Unbroken',level:102,roster:'grimtusk',
  lair:{area:'bloodtusk_warhall',level:1,room:'hall',unlock:'lair:bloodtusk_warhall'},arena:{radius:10},attackTicks:5,respawnTicks:50,resetTicks:20,
  attacks:{
   cleave:A('Cleave','strike',{style:'melee',maxHit:260,color:0xc9c2b8}),
   hurl:A('Hurled axe','strike',{style:'ranged',maxHit:220,color:0xb08a5a,text:'Grimtusk hurls a hand-axe!'}),
   earthsplitter:A('Earthsplitter','telegraph',{shape:'line',radius:8,tell:2,maxHit:380,color:0xff7a2a,sound:'rumble',text:'Grimtusk raises his axe high — the ground cracks toward you!'}),
   warcry:A('Warcry','summon',{add:'bloodtusk_berserker',count:2,text:'Grimtusk bellows a warcry. Berserkers answer!'}),
   slam:A('Ground slam','telegraph',{shape:'around',radius:2,tell:2,maxHit:420,color:0xff4a1a,sound:'slam',text:'Grimtusk plants his feet for a ground slam!'})},
  phases:[
   {at:100,name:'Unbroken',pattern:['cleave','cleave','earthsplitter','cleave','hurl']},
   {at:66,name:'Warcry',onEnter:['warcry'],pattern:['cleave','earthsplitter','cleave','hurl','cleave']},
   {at:33,name:'Last stand',attackTicks:4,pattern:['cleave','slam','cleave','earthsplitter','hurl'],text:'Grimtusk will not kneel. He fights faster!'}],
  enrage:{afterTicks:250,attackTicksMinus:1,damagePct:125,text:'Grimtusk is enraged!'},
  uniques:[{item:'weapon:unbrokenCleaver',chance:'1/256'},{item:'armor:warlordTuskhelm',chance:'1/384'}]},
 {id:'hollow_king',name:'The Hollow King',level:105,roster:'hollow_king',
  lair:{area:'hollowmere_undercroft',level:2,room:'throne',unlock:'lair:hollow_throne'},arena:{radius:10},attackTicks:5,respawnTicks:50,resetTicks:20,
  attacks:{
   soulbolt:A('Soul bolt','strike',{style:'magic',maxHit:250,color:0x7fe8ff,text:''}),
   bonevolley:A('Bone volley','strike',{style:'ranged',maxHit:240,color:0xe8dcc0}),
   gravefrost:A('Grave frost','telegraph',{shape:'target',radius:1,tell:2,maxHit:360,color:0x9fe8ff,sound:'frost',text:'Frost gathers under your feet!'}),
   court:A('Rise, my court','summon',{add:'cairnbound_knight',count:2,text:'"Rise, my court!" Two knights claw out of the floor.'}),
   judgement:A('Court’s judgement','charge',{style:'magic',tell:3,maxHit:450,color:0x5fd0ff,sound:'charge',text:'The Hollow King gathers a judgement — guard against magic!'})},
  phases:[
   {at:100,name:'The vigil',pattern:['soulbolt','soulbolt','soulbolt','soulbolt','bonevolley','bonevolley','bonevolley','bonevolley','gravefrost']},
   {at:66,name:'The court rises',onEnter:['court'],pattern:['bonevolley','bonevolley','soulbolt','soulbolt','gravefrost','soulbolt','bonevolley']},
   {at:33,name:'Judgement',pattern:['judgement','soulbolt','bonevolley','gravefrost','soulbolt','bonevolley'],text:'The crown flares cold blue.'}],
  enrage:{afterTicks:260,attackTicksMinus:1,damagePct:120,text:'The Hollow King loses patience.'},
  uniques:[{item:'weapon:hollowScepter',chance:'1/256'},{item:'armor:hollowCrown',chance:'1/512'}]},
 {id:'gloom_matriarch',name:'The Gloom Matriarch',level:112,roster:'gloom_matriarch',
  lair:{area:'gloomweb_nest',level:1,room:'cradle',unlock:'lair:gloomweb_nest'},arena:{radius:10},attackTicks:5,respawnTicks:50,resetTicks:20,
  attacks:{
   bite:A('Venom bite','strike',{style:'melee',maxHit:240,color:0x9a6bff,venom:true}),
   spit:A('Web spit','strike',{style:'ranged',maxHit:230,color:0xd06bff}),
   eggs:A('Egg-sac burst','summon',{add:'gloomweb_broodling',count:3,text:'Egg sacs split open across the cradle!'}),
   snare:A('Web snare','telegraph',{shape:'scatter',radius:4,count:9,tell:2,maxHit:300,color:0xc9b8ff,sound:'web',text:'Sticky strands rain from above!'}),
   crush:A('Brood crush','telegraph',{shape:'around',radius:2,tell:2,maxHit:400,color:0x9a6bff,sound:'slam',text:'The Matriarch rears up on her hind legs!'})},
  phases:[
   {at:100,name:'The cradle',pattern:['bite','bite','spit','bite','crush']},
   {at:66,name:'The brood',onEnter:['eggs'],immuneWhileAdds:true,pattern:['spit','spit','bite','snare'],text:'Her brood shields her — kill the broodlings!'},
   {at:33,name:'Mother of webs',attackTicks:4,onEnter:['eggs'],pattern:['bite','snare','spit','crush','bite','spit']}],
  enrage:{afterTicks:280,attackTicksMinus:1,damagePct:120,text:'The Matriarch shrieks in fury.'},
  uniques:[{item:'weapon:broodfang',chance:'1/200'},{item:'armor:gloomsilkMantle',chance:'1/384'}]},
 {id:'frostmaw',name:'Frostmaw, the Glacier Wyrm',level:115,roster:'frostmaw',
  lair:{area:'rimecoil_cavern',level:1,room:'heart',unlock:'lair:rimecoil_cavern'},arena:{radius:11},attackTicks:6,respawnTicks:50,resetTicks:20,
  attacks:{
   bite:A('Glacier bite','strike',{style:'melee',maxHit:270,color:0xcfefff}),
   frostbreath:A('Frost breath','breath',{element:'frost',tell:1,maxHit:500,color:0x8fd8ff,sound:'breath',text:'Frostmaw draws a freezing breath!'}),
   tail:A('Tail swipe','telegraph',{shape:'behind',radius:4,tell:1,maxHit:320,color:0xbfe6ff,sound:'swipe'}),
   icefall:A('Icefall','telegraph',{shape:'scatter',radius:4,count:10,tell:2,maxHit:340,color:0xe6fbff,sound:'frost',text:'Icicles crack loose from the ceiling!'}),
   whelps:A('Call the brood','summon',{add:'rimescale_whelp',count:2,text:'Frostmaw roars. Rimescale whelps answer from the ice!'})},
  phases:[
   {at:100,name:'The glacier wakes',pattern:['bite','frostbreath','bite','tail','icefall']},
   {at:66,name:'Brood call',onEnter:['whelps'],pattern:['bite','frostbreath','icefall','bite','tail']},
   {at:33,name:'White-out',attackTicks:5,pattern:['frostbreath','bite','icefall','frostbreath','tail','bite']}],
  enrage:{afterTicks:300,attackTicksMinus:1,damagePct:125,text:'Frostmaw’s scales split with cold fury!'},
  uniques:[{item:'weapon:rimeheartSpear',chance:'1/256'},{item:'armor:glacierscaleGreaves',chance:'1/384'}]},
 {id:'ashen_colossus',name:'The Ashen Colossus',level:120,roster:'ashen_colossus',
  lair:{area:'cindervault_depths',level:2,room:'crucible',unlock:'lair:cindervault_crucible'},arena:{radius:12},attackTicks:6,respawnTicks:60,resetTicks:20,
  attacks:{
   slam:A('Anvil fist','strike',{style:'melee',maxHit:290,color:0xff6a1a}),
   magma:A('Magma bolt','strike',{style:'magic',maxHit:260,color:0xff3a0a}),
   forgefall:A('Forge-fall','telegraph',{shape:'cross',radius:3,tell:2,maxHit:400,color:0xff5a1a,sound:'rumble',text:'Molten metal pours from the crucible above!'}),
   golems:A('Forge-born','summon',{add:'basalt_golem',count:2,text:'The Colossus seals its core and two golems step from the slag!'}),
   meltdown:A('Meltdown','telegraph',{shape:'ring',radius:5,tell:3,maxHit:480,color:0xffa040,sound:'charge',text:'The Colossus glows white-hot — get close!'})},
  phases:[
   {at:100,name:'The forge-god',pattern:['slam','slam','magma','forgefall','slam','magma']},
   {at:50,name:'Sealed core',onEnter:['golems'],immuneWhileAdds:true,pattern:['magma','forgefall','magma'],text:'Its core is sealed. Break the golems!'},
   {at:25,name:'Meltdown',attackTicks:5,pattern:['slam','meltdown','magma','forgefall','slam']}],
  enrage:{afterTicks:320,attackTicksMinus:1,damagePct:125,text:'The crucible boils over!'},
  uniques:[{item:'weapon:cindercoreMaul',chance:'1/300'},{item:'armor:heartforgePlate',chance:'1/512'}]},
 {id:'twinflame_wyrm',name:'Vaelith, the Twinflame',level:128,roster:'twinflame_wyrm',
  lair:{area:'wyrmhold',level:2,room:'roost',unlock:'lair:wyrmhold'},arena:{radius:12},attackTicks:6,respawnTicks:60,resetTicks:20,
  attacks:{
   claw:A('Claw rake','strike',{style:'melee',maxHit:280,color:0xffd7a0}),
   firebreath:A('Fire breath','breath',{element:'fire',tell:1,maxHit:550,color:0xff6a1a,sound:'breath',text:'Vaelith’s red throat glows!'}),
   frostbreath:A('Frost breath','breath',{element:'frost',tell:1,maxHit:550,color:0x8fd8ff,sound:'breath',text:'Vaelith’s blue throat glows!'}),
   tail:A('Tail swipe','telegraph',{shape:'behind',radius:4,tell:1,maxHit:340,color:0xffc890,sound:'swipe'}),
   sweep:A('Breath sweep','breath',{element:'fire',shape:'line',radius:10,tell:2,maxHit:520,color:0xff6a1a,sound:'breath',text:'Vaelith dives — a river of fire sweeps the roost!'}),
   flight:A('Take flight','flight',{ticks:6,sweep:'sweep',land:{shape:'around',radius:1,maxHit:380},text:'Vaelith beats her wings and takes to the air!'}),
   whelps:A('Brood','summon',{add:'ashscale_whelp',count:2,text:'Whelps scramble down from the roost walls!'})},
  phases:[
   {at:100,name:'Grounded',pattern:['claw','firebreath','claw','tail','frostbreath','claw']},
   {at:66,name:'Skyborne',onEnter:['flight'],pattern:['firebreath','claw','frostbreath','tail','flight','claw']},
   {at:33,name:'Twin fury',onEnter:['whelps'],attackTicks:5,pattern:['firebreath','frostbreath','claw','tail','flight','claw']}],
  enrage:{afterTicks:350,attackTicksMinus:1,damagePct:130,text:'Vaelith’s twin flames burn as one!'},
  uniques:[{item:'weapon:twinflameGlaive',chance:'1/1024'},{item:'armor:wyrmscaleJerkin',chance:'1/96'},{item:'armor:wyrmscaleChaps',chance:'1/96'}]}
];
export const bossById=Object.fromEntries(BOSSES.map(b=>[b.id,b]));

// Supplies (refund a trip) + uniques as preroll rows. Loot tables v2 shape (mechanics.js).
const SUPPLY={
 grimtusk:[['runiteBar',3,6,24],['tidesteelArrows',40,90,18],['cutGem',2,4,16],['swordfish',3,5,20]],
 hollow_king:[['runiteBar',2,5,20],['cutGem',3,5,20],['shrineDraught',2,3,16],['fireRune',80,160,20]],
 gloom_matriarch:[['runiteBar',3,5,20],['serpentbaneTonic',1,2,18],['grimyHerb',6,12,20],['thread',40,80,18]],
 frostmaw:[['runiteBar',3,6,22],['cutGem',3,6,22],['swordfish',3,5,20],['breathwardTonic',1,2,16]],
 ashen_colossus:[['runiteBar',4,8,26],['coal',30,60,22],['cutGem',3,6,20],['breathwardTonic',1,2,14]],
 twinflame_wyrm:[['runiteBar',4,8,24],['wyrmScale',3,6,24],['breathwardTonic',2,3,18],['cutGem',4,7,18]]
};
export function bossDrops(def){
 const rows=(SUPPLY[def.id]||[]).map(([item,min,max,weight])=>({weight,item,min,max}));
 return {always:[{item:def.id==='twinflame_wyrm'||def.id==='frostmaw'?'wyrmBones':'heftyBones',min:2,max:3}],
  preroll:def.uniques.map(u=>({item:u.item,min:1,max:1,chance:u.chance})),
  main:{denom:128,rows:[...rows,{weight:2,table:'rare'}]},tertiary:[]};
}

// New monster types (adult dragons and the dragon boss) as roster templates; stats from
// monster-roster.js statBlock at build time.
export const NEW_MONSTERS=[
 {key:'cinderhorn_drake',base:'ashscale_whelp',name:'Cinderhorn drake',level:82,rank:'Elite',scale:1.75,tint:0x5a2a1c,eyes:0xffb347,breath:0xff6a1a,attackType:'fire',examine:'Full-grown, horned, and very sure the Wyrmhold is hers.'},
 {key:'hoarscale_drake',base:'rimescale_whelp',name:'Hoarscale drake',level:86,rank:'Elite',scale:1.8,tint:0x7fa3bd,eyes:0xe6fbff,breath:0x8fd8ff,attackType:'magic',examine:'Frost rimes the stone wherever it sleeps.'},
 {key:'twinflame_wyrm',base:'frostmaw',name:'Vaelith, the Twinflame',level:128,rank:'Legendary',scale:2.6,tint:0x6a2d3a,eyes:0xffe08a,breath:0xff6a1a,aura:0xff9a5a,accent:0x8fd8ff,attackType:'fire',examine:'Two hearts, two fires, one very old grudge.'}
];
export const DRAGON_LOOT={adult:{wyrmScale:'1/6',wyrmscale:'1/96',breathwardTonic:'1/24'},whelp:{wyrmScale:'1/10',wyrmscale:'1/256'}};

// ---------------------------------------------------------------- lairs (underground-data.js format)
const room=(id,x,z,rx,rz)=>({id,x,z,rx,rz}),tunnel=(width,...points)=>({width,points});
export const LAIRS=[
 {id:'bloodtusk_warhall',name:'Bloodtusk Warhall',theme:'earth',band:[58,102],origin:{x:1200,z:2200},enabled:true,lair:'grimtusk',
  blurb:'Beneath the stronghold the Bloodtusk clans muster around their warlord’s hall.',
  levels:[
   {level:0,name:'Muster cavern',rooms:[room('entry',0,0,6,5),room('muster',26,0,13,9),room('armory',26,-26,9,7),room('pit',52,8,8,6)],
    tunnels:[tunnel(3,[0,0],[26,0]),tunnel(2.8,[26,0],[26,-26]),tunnel(3,[26,0],[52,8])]},
   {level:1,name:'Warlord’s hall',rooms:[room('landing',0,0,6,5),room('hall',30,0,16,13)],tunnels:[tunnel(3.4,[0,0],[30,0])]}],
  entrances:[{id:'gate',kind:'cave_mouth',x:329,z:-27,yaw:0,name:'Bloodtusk Warhall gate',to:{level:0,x:2,z:0},requires:{combat:70,unlock:'lair:bloodtusk_warhall',gate:false}}],
  links:[{id:'pit',kind:'ladder',level:0,x:54,z:8,to:{level:1,x:1.5,z:0}}],
  spawns:[{id:'berserkers',roster:'bloodtusk_berserker',count:5,level:0,room:'muster'},{id:'ogres',roster:'cragmaw_ogre',count:2,level:0,room:'armory'},{id:'grimtusk',roster:'grimtusk',count:1,level:1,room:'hall',roam:2,respawn:30}],
  lights:[{level:0,x:3,z:-3,kind:'torch'},{level:0,x:26,z:7,kind:'brazier'},{level:0,x:26,z:-30,kind:'torch'},{level:0,x:52,z:12,kind:'torch'},
   {level:1,x:3,z:3,kind:'torch'},{level:1,x:18,z:-9,kind:'brazier'},{level:1,x:18,z:9,kind:'brazier'},{level:1,x:42,z:-9,kind:'brazier'},{level:1,x:42,z:9,kind:'brazier'}]},
 {id:'gloomweb_nest',name:'Gloomweb Nest',theme:'earth',band:[44,112],origin:{x:4200,z:2200},enabled:true,lair:'gloom_matriarch',
  blurb:'Silk-choked warrens under Gloom hollow, and the cradle where the Matriarch waits.',
  levels:[
   {level:0,name:'Silk warrens',rooms:[room('mouth',0,0,6,5),room('warren',24,8,12,9),room('sacs',8,30,10,8),room('chute',40,24,6,5)],
    tunnels:[tunnel(3,[0,0],[24,8]),tunnel(3,[0,0],[8,30]),tunnel(2.8,[24,8],[40,24]),tunnel(2.6,[8,30],[40,24])]},
   {level:1,name:'Matriarch’s cradle',rooms:[room('landing',0,0,6,5),room('cradle',28,6,16,13)],tunnels:[tunnel(3.2,[0,0],[28,6])]}],
  entrances:[{id:'mouth',kind:'cave_mouth',x:-251,z:393,yaw:0,name:'Gloomweb Nest mouth',to:{level:0,x:2,z:0},requires:{combat:70,unlock:'lair:gloomweb_nest',gate:false}}],
  links:[{id:'chute',kind:'ladder',level:0,x:41,z:25,to:{level:1,x:1.5,z:0}}],
  spawns:[{id:'brood',roster:'gloomweb_broodling',count:5,level:0,room:'warren'},{id:'sacs',roster:'gloomweb_broodling',count:4,level:0,room:'sacs'},{id:'matriarch',roster:'gloom_matriarch',count:1,level:1,room:'cradle',roam:2,respawn:30}],
  lights:[{level:0,x:3,z:3,kind:'fungus'},{level:0,x:24,z:14,kind:'fungus'},{level:0,x:8,z:36,kind:'fungus'},{level:0,x:40,z:28,kind:'crystal'},
   {level:1,x:3,z:-3,kind:'fungus'},{level:1,x:16,z:0,kind:'fungus'},{level:1,x:28,z:16,kind:'crystal'},{level:1,x:40,z:2,kind:'fungus'}]},
 {id:'rimecoil_cavern',name:'Rimecoil Cavern',theme:'ice',band:[33,115],origin:{x:4200,z:1200},enabled:true,lair:'frostmaw',
  blurb:'A cleft in the eyrie opens on blue ice galleries, and below them the glacier’s heart.',
  levels:[
   {level:0,name:'Frozen gallery',rooms:[room('cleft',0,0,6,5),room('gallery',28,0,14,8),room('hall',28,-28,12,10),room('stair',56,-6,6,5)],
    tunnels:[tunnel(3,[0,0],[28,0]),tunnel(3,[28,0],[28,-28]),tunnel(3,[28,0],[56,-6])]},
   {level:1,name:'Glacier heart',rooms:[room('landing',0,0,6,5),room('heart',30,4,17,14)],tunnels:[tunnel(3.4,[0,0],[30,4])]}],
  entrances:[{id:'cleft',kind:'cave_mouth',x:370,z:-384,yaw:0,name:'Rimecoil ice cleft',to:{level:0,x:2,z:0},requires:{combat:70}}],
  links:[{id:'stair',kind:'stairs',level:0,x:57,z:-6,to:{level:1,x:1.5,z:0},requires:{unlock:'lair:rimecoil_cavern',gate:true}}],
  spawns:[{id:'wraiths',roster:'hoarfrost_wraith',count:4,level:0,room:'gallery'},{id:'colossi',roster:'glacier_colossus',count:3,level:0,room:'hall'},{id:'whelps',roster:'rimescale_whelp',count:2,level:0,room:'stair'},
   {id:'frostmaw',roster:'frostmaw',count:1,level:1,room:'heart',roam:2,respawn:30}],
  lights:[{level:0,x:3,z:-3,kind:'crystal'},{level:0,x:20,z:5,kind:'crystal'},{level:0,x:38,z:-5,kind:'crystal'},{level:0,x:28,z:-36,kind:'crystal'},{level:0,x:56,z:-1,kind:'torch'},
   {level:1,x:3,z:3,kind:'crystal'},{level:1,x:18,z:-6,kind:'crystal'},{level:1,x:42,z:14,kind:'crystal'},{level:1,x:30,z:-8,kind:'crystal'}]},
 {id:'wyrmhold',name:'The Wyrmhold',theme:'fire',band:[64,128],origin:{x:3600,z:1200},enabled:true,lair:'twinflame_wyrm',
  blurb:'An old volcanic vent the dragons took for a nursery. The deeper you go, the older they get.',
  levels:[
   {level:0,name:'Scorched approach',rooms:[room('maw',0,0,6,5),room('ashfield',28,0,14,9),room('nursery',30,-30,12,9),room('vent',58,4,6,5)],
    tunnels:[tunnel(3.2,[0,0],[28,0]),tunnel(3,[28,0],[30,-30]),tunnel(3,[28,0],[58,4])]},
   {level:1,name:'Brood terraces',rooms:[room('landing',0,0,6,5),room('terrace',28,-6,15,10),room('frostshelf',24,28,12,9),room('chimney',54,20,6,5)],
    tunnels:[tunnel(3.4,[0,0],[28,-6]),tunnel(3,[0,0],[8,16],[24,28]),tunnel(3,[28,-6],[46,8],[54,20]),tunnel(2.8,[24,28],[54,20])]},
   {level:2,name:'Twin roost',rooms:[room('landing',0,0,6,5),room('roost',32,0,18,15)],tunnels:[tunnel(3.6,[0,0],[32,0])]}],
  entrances:[{id:'maw',kind:'cave_mouth',x:98,z:390,yaw:0,name:'Wyrmhold maw',to:{level:0,x:2,z:0},requires:{combat:75,unlock:'lair:wyrmhold',gate:false}}],
  links:[{id:'vent',kind:'stairs',level:0,x:59,z:4,to:{level:1,x:1.5,z:0}},{id:'chimney',kind:'ladder',level:1,x:55,z:20,to:{level:2,x:1.5,z:0}}],
  spawns:[{id:'ashscale',roster:'ashscale_whelp',count:4,level:0,room:'ashfield'},{id:'verdant',roster:'verdant_whelp',count:3,level:0,room:'nursery'},
   {id:'cinderhorns',roster:'cinderhorn_drake',count:3,level:1,room:'terrace'},{id:'hoarscales',roster:'hoarscale_drake',count:3,level:1,room:'frostshelf'},
   {id:'vaelith',roster:'twinflame_wyrm',count:1,level:2,room:'roost',roam:2,respawn:30}],
  lights:[{level:0,x:3,z:-3,kind:'brazier'},{level:0,x:28,z:7,kind:'lava'},{level:0,x:30,z:-37,kind:'lava'},{level:0,x:58,z:9,kind:'torch'},
   {level:1,x:3,z:3,kind:'brazier'},{level:1,x:28,z:2,kind:'lava'},{level:1,x:24,z:35,kind:'crystal'},{level:1,x:54,z:25,kind:'lava'},
   {level:2,x:3,z:3,kind:'brazier'},{level:2,x:18,z:-10,kind:'lava'},{level:2,x:18,z:10,kind:'lava'},{level:2,x:46,z:-10,kind:'lava'},{level:2,x:46,z:10,kind:'lava'}]}
];
// Additions to the existing R2-G areas: the Hollow Throne under Hollowmere and the Colossus in the crucible.
export const LAIR_EXTENSIONS={
 hollowmere_undercroft:{lair:'hollow_king',
  levels:[{level:2,name:'Hollow Throne',rooms:[room('vestibule',0,0,6,5),room('throne',30,0,16,13)],tunnels:[tunnel(3.4,[0,0],[30,0])]}],
  links:[{id:'throne_stair',kind:'stairs',level:1,x:46,z:26,to:{level:2,x:1.5,z:0},requires:{unlock:'lair:hollow_throne',gate:true}}],
  spawns:[{id:'hollow_king',roster:'hollow_king',count:1,level:2,room:'throne',roam:2,respawn:30}],
  lights:[{level:2,x:3,z:3,kind:'brazier'},{level:2,x:20,z:-8,kind:'crystal'},{level:2,x:20,z:8,kind:'crystal'},{level:2,x:42,z:0,kind:'brazier'}]},
 // The Colossus fights in its own sealed level below the crucible room; the gate is that room's stair,
 // so the rest of Molten heart stays open for training.
 cindervault_depths:{lair:'ashen_colossus',unreserve:['crucible'],
  levels:[{level:2,name:'The Crucible',rooms:[room('vestibule',0,0,6,5),room('crucible',32,0,17,14)],tunnels:[tunnel(3.4,[0,0],[32,0])]}],
  links:[{id:'crucible_stair',kind:'stairs',level:1,x:66,z:42,to:{level:2,x:1.5,z:0},requires:{unlock:'lair:cindervault_crucible',gate:true}}],
  spawns:[{id:'colossus',roster:'ashen_colossus',count:1,level:2,room:'crucible',roam:2,respawn:30}],
  lights:[{level:2,x:3,z:3,kind:'brazier'},{level:2,x:20,z:-10,kind:'lava'},{level:2,x:20,z:10,kind:'lava'},{level:2,x:46,z:-10,kind:'lava'},{level:2,x:46,z:10,kind:'lava'}]}
};
// An area with its lair extension merged in (same result as the SQL in db/bosses-3-lairs.sql).
export function withLair(area){
 const x=LAIR_EXTENSIONS[area.id];if(!x)return area;
 const has=(list,k,v)=>(list||[]).some(o=>o[k]===v);
 const links=[...(area.links||[]),...x.links.filter(l=>!has(area.links,'id',l.id))];
 return {...area,lair:x.lair,levels:[...area.levels,...x.levels.filter(l=>!has(area.levels,'level',l.level))],links,
  spawns:[...(area.spawns||[]),...x.spawns.filter(s=>!has(area.spawns,'id',s.id))],
  lights:[...(area.lights||[]),...((area.levels||[]).some(l=>l.level===2)?[]:x.lights)],
  reserved:(area.reserved||[]).filter(r=>!(x.unreserve||[]).includes(r.room))};
}
export const lairFor=bossId=>{const b=bossById[bossId];return b&&b.lair};

// ---------------------------------------------------------------- validation (console + SQL twin)
export function validateBoss(d,{roster=null}={}){
 const e=[],num=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 if(!d||typeof d!=='object')return ['Not an object'];
 if(!/^[a-z][a-z0-9_]{1,40}$/.test(d.id||''))e.push('id: lower-case letters, digits and _');
 if(!d.name||String(d.name).length>60)e.push('name: 1–60 characters');
 if(!num(d.attackTicks,2,12))e.push('attackTicks: 2–12');
 if(!num(d.arena?.radius,3,20))e.push('arena.radius: 3–20 tiles');
 const atk=d.attacks&&typeof d.attacks==='object'?d.attacks:{};
 if(!Object.keys(atk).length)e.push('attacks: at least one');
 for(const [k,a] of Object.entries(atk)){
  if(!ATTACK_KINDS.includes(a?.kind)){e.push(`attack ${k}: kind ${ATTACK_KINDS.join('|')}`);continue}
  if(['strike','charge'].includes(a.kind)&&!STYLES.includes(a.style))e.push(`attack ${k}: style ${STYLES.join('|')}`);
  if(['strike','telegraph','charge','breath'].includes(a.kind)&&!num(a.maxHit,0,2000))e.push(`attack ${k}: maxHit 0–2000`);
  if(['telegraph','charge','breath'].includes(a.kind)&&a.tell!=null&&!num(a.tell,1,6))e.push(`attack ${k}: tell 1–6 ticks`);
  if(a.kind==='telegraph'&&!SHAPES.includes(a.shape))e.push(`attack ${k}: shape ${SHAPES.join('|')}`);
  if(a.shape&&!SHAPES.includes(a.shape))e.push(`attack ${k}: shape ${SHAPES.join('|')}`);
  if(a.kind==='breath'&&!ELEMENTS[a.element])e.push(`attack ${k}: element fire|frost`);
  if(a.kind==='summon'&&(!a.add||!num(a.count,1,6)))e.push(`attack ${k}: add (roster key) and count 1–6`);
  if(a.kind==='summon'&&roster&&!roster.has(a.add))e.push(`attack ${k}: unknown roster monster ${a.add}`);
  if(a.kind==='flight'&&(!num(a.ticks,2,12)||(a.sweep&&!atk[a.sweep])))e.push(`attack ${k}: ticks 2–12 and a known sweep attack`);
 }
 const ph=Array.isArray(d.phases)?d.phases:[];if(!ph.length||ph.length>6)e.push('phases: 1–6');
 ph.forEach((p,i)=>{if(!num(p.at,1,100))e.push(`phase ${i+1}: at 1–100`);if(i===0&&p.at!==100)e.push('phase 1 starts at 100');if(i>0&&!(p.at<ph[i-1].at))e.push(`phase ${i+1}: at must fall`);
  if(!Array.isArray(p.pattern)||!p.pattern.length||p.pattern.length>16)e.push(`phase ${i+1}: pattern of 1–16 attacks`);
  for(const k of [...(p.pattern||[]),...(p.onEnter||[])])if(!atk[k])e.push(`phase ${i+1}: unknown attack ${k}`)});
 if(d.enrage&&(!num(d.enrage.afterTicks,20,5000)||!num(d.enrage.damagePct??100,50,400)))e.push('enrage: afterTicks 20–5000, damagePct 50–400');
 for(const u of d.uniques||[])if(!u.item||!(parseOneIn(u.chance)>0&&parseOneIn(u.chance)<=1))e.push('unique '+(u.item||'?')+': item and chance like 1/256');
 return e;
}
