// Eldervale gear tiers, OSRS-style equipment bonuses, level requirements and the
// combat formulas. Pure data and maths (no Three.js) so the client, the tests and
// scripts/build-equipment-sql.mjs (which writes the server catalog and functions in
// db/osrs-equipment-combat.sql) all read the same numbers.
//
// Metal tiers follow the OSRS ladder (1 / 1 / 5 / 10 / 20 / 30 / 40 / 60 / 70) with
// Eldervale's own metals. Each tier has one readable colour; equipment of that tier
// reuses the iron model and recolours only its metal parts (tier-tint.js).
export const GEAR_TIERS=[
 {id:'bronze',name:'Bronze',level:1,color:0xb0723a,weapon:.17,armour:.18,smith:1,bar:'bronzeBar',xp:12.5,fletch:1},
 {id:'iron',name:'Iron',level:1,color:0x7f868d,weapon:.24,armour:.26,smith:15,bar:'ironBar',xp:25,fletch:15},
 {id:'steel',name:'Steel',level:5,color:0xb7c2cc,weapon:.36,armour:.39,smith:30,bar:'steelBar',xp:37.5,fletch:30},
 {id:'blacksteel',name:'Blacksteel',level:10,color:0x34373f,weapon:.44,armour:.5,smith:40,bar:'blacksteelBar',xp:45,fletch:null},
 {id:'moonsilver',name:'Moonsilver',level:20,color:0x9cc4ec,weapon:.5,armour:.56,smith:50,bar:'mithrilBar',xp:50,fletch:45},
 {id:'verdite',name:'Verdite',level:30,color:0x3f9a6c,weapon:.69,armour:.79,smith:70,bar:'adamantBar',xp:62.5,fletch:60},
 {id:'tidesteel',name:'Tidesteel',level:40,color:0x37b3bb,weapon:1,armour:1,smith:85,bar:'runiteBar',xp:75,fletch:75},
 {id:'embersteel',name:'Embersteel',level:60,color:0xc4472c,weapon:1.3,armour:1.12,smith:null,bar:null,xp:0,fletch:90},
 {id:'eldersteel',name:'Eldersteel',level:70,color:0xcdb8ff,weapon:1.5,armour:1.3,smith:null,bar:null,xp:0,fletch:null}
];
export const tierById=Object.fromEntries(GEAR_TIERS.map((t,i)=>[t.id,{...t,index:i}]));
export const tierIndex=id=>tierById[id]?.index??-1;

// Eldervale's combat tick. OSRS ticks are 0.6 s; Eldervale combat alternates
// turns, so one tick is 0.45 s (which keeps the existing weapon turn lengths).
export const TICK_SECONDS=.45;
// With the tick & tile engine on (db/tick-tile-engine-4-timing.sql), timers run on 600 ms game
// ticks: a weapon's seconds round to the nearest game tick, keeping its feel (dagger 4 -> 3,
// longsword 5 -> 4, battleaxe 6 -> 5, 2h 7 -> 5). Matches eldervale_private.engine_seconds.
export const GAME_TICK_SECONDS=.6;
export const gameTicks=ticks=>Math.max(1,Math.floor(ticks*TICK_SECONDS/GAME_TICK_SECONDS+.5));
// Eldervale health is 10x OSRS (max HP = 10 x Hitpoints level), so hits are rolled
// at 10x the OSRS resolution: OSRS max hit 1 → up to 10 damage here.
export const HIT_SCALE=10;
export const COMBAT_TYPES=['stab','slash','crush','magic','ranged'];
export const BONUS_KEYS=['astab','aslash','acrush','amagic','arange','dstab','dslash','dcrush','dmagic','drange','str','rstr','mdmg','prayer'];
export const SKILL_NAMES={attack:'Attack',strength:'Strength',defence:'Defence',ranged:'Ranged',magic:'Magic',prayer:'Prayer',hitpoints:'Hitpoints'};
export const SKILL_XP_KEYS={attack:'attackXP',strength:'strengthXP',defence:'defenceXP',ranged:'rangedXP',magic:'magicXP',prayer:'prayerXP'};
const REQ_ORDER=['attack','strength','defence','ranged','magic','prayer'];

// Bonus helper: attack [stab,slash,crush,magic,ranged], defence [stab,slash,crush,magic,ranged].
export function bonuses({a=[0,0,0,0,0],d=[0,0,0,0,0],str=0,rstr=0,mdmg=0,prayer=0}={}){
 return {astab:a[0]|0,aslash:a[1]|0,acrush:a[2]|0,amagic:a[3]|0,arange:a[4]|0,dstab:d[0]|0,dslash:d[1]|0,dcrush:d[2]|0,dmagic:d[3]|0,drange:d[4]|0,str:str|0,rstr:rstr|0,mdmg:mdmg|0,prayer:prayer|0};
}
// Positive values scale with the tier; penalties (negative values) stay fixed, as in OSRS.
const scaleArr=(arr,f)=>arr.map(v=>v>0?Math.max(1,Math.round(v*f)):v);
const scaleTemplate=(t,f)=>bonuses({a:scaleArr(t.a||[0,0,0,0,0],f),d:scaleArr(t.d||[0,0,0,0,0],f),str:t.str>0?Math.max(1,Math.round(t.str*f)):t.str||0,rstr:t.rstr||0,mdmg:t.mdmg||0,prayer:t.prayer||0});
export const addBonuses=(...list)=>{const out=bonuses();for(const b of list)if(b)for(const k of BONUS_KEYS)out[k]+=Number(b[k])||0;return out};

// Attack styles. Eldervale has three buttons; per weapon they map to OSRS styles.
//  stab  = Accurate   (+3 effective Attack / Ranged)
//  slash = Aggressive (+3 effective Strength); with a bow: Rapid (one tick faster)
//  lunge = Controlled (+1 Attack, Strength and Defence); with a bow: Longrange (+3 Defence)
export const STYLE_BONUS={stab:{att:3,str:0,def:0},slash:{att:0,str:3,def:0},lunge:{att:1,str:1,def:1}};
const STAB={stab:'stab',slash:'slash',lunge:'stab'},SLASH={stab:'slash',slash:'slash',lunge:'stab'},CRUSH={stab:'crush',slash:'crush',lunge:'crush'},AXE={stab:'slash',slash:'slash',lunge:'crush'},HEAVY={stab:'slash',slash:'slash',lunge:'crush'},SPEAR={stab:'stab',slash:'slash',lunge:'crush'};

// Weapon templates, with OSRS tier-40 (rune-equivalent) bonuses as the reference.
// off: smithing level offset over the tier's base; bars: bars per item.
export const WEAPON_TEMPLATES={
 dagger:{label:'dagger',model:'dagger',bars:1,off:0,ticks:4,reach:1.7,a:[25,12,-4],str:24,styles:STAB},
 scimitar:{label:'scimitar',model:'scimitar',bars:2,off:5,ticks:4,reach:2.4,a:[7,45,-2],str:44,styles:SLASH},
 longsword:{label:'longsword',model:'longsword',bars:2,off:6,ticks:5,reach:2.5,a:[38,47,-2],str:49,styles:SLASH},
 hammer:{label:'hammer',model:'hammer',bars:1,off:2,ticks:5,reach:2.0,a:[20,-2,39],str:36,prayer:4,styles:CRUSH},
 battleaxe:{label:'battleaxe',model:'battleaxe',bars:3,off:10,ticks:6,reach:2.2,a:[-2,48,43],str:64,styles:AXE},
 twohand:{label:'2h sword',model:'twohand',bars:3,off:14,ticks:7,reach:2.8,a:[-4,69,50],str:70,twoHanded:true,styles:HEAVY},
 spear:{label:'spear',model:'spear',bars:1,off:4,ticks:5,reach:3.2,a:[36,36,36],str:42,styles:SPEAR}
};
// The iron tier keeps the original item keys, so saves and shops keep working.
const IRON_KEYS={dagger:'dagger',scimitar:'scimitar',longsword:'longsword',hammer:'hammer',battleaxe:'battleaxe',twohand:'twohand',spear:'spear'};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
export const tierItemKey=(tier,piece)=>tier+cap(piece);
export const ARMOUR_VERB={weaponsOwned:'wield',shieldsOwned:'wear',armorOwned:'wear'};

// Stats for the existing one-off weapons ([template, tier factor source, level]).
const SPECIAL_WEAPONS={
 shortsword:{t:{a:[38,26,-2],str:39,ticks:4,styles:STAB},tier:'iron'},
 waraxe:{t:WEAPON_TEMPLATES.battleaxe,tier:'iron'},
 warhammer:{t:{a:[-4,-4,82],str:79,ticks:7,styles:CRUSH},tier:'iron'},
 bronzeSword:{t:{a:[38,26,-2],str:39,ticks:4,styles:STAB},tier:'bronze'},
 bronzeAxe:{t:WEAPON_TEMPLATES.battleaxe,tier:'bronze'},
 goldenSword:{t:WEAPON_TEMPLATES.longsword,factor:.56,level:20},
 scythe:{t:{a:[-4,72,46],str:72,ticks:7,styles:HEAVY},factor:.72,level:30},
 claymore:{t:WEAPON_TEMPLATES.twohand,factor:1.05,level:40},
 axe:{t:{a:[-2,5,3],str:7,ticks:5,styles:AXE},factor:1,level:1,tool:true},
 pickaxe:{t:{a:[4,-2,2],str:5,ticks:5,styles:{stab:'stab',slash:'crush',lunge:'crush'}},factor:1,level:1,tool:true}
};
// Bows: ranged attack bonus, attack speed in ticks, the best arrow tier they can fire, Ranged level.
export const BOWS={
 woodenBow:{level:1,arange:8,ticks:4,arrowCap:'iron'},
 longbow:{level:1,arange:8,ticks:6,arrowCap:'iron'},
 oakShortbow:{level:5,arange:14,ticks:4,arrowCap:'steel',name:'Oak shortbow',wood:0xa77c4c,buy:110,reach:12,desc:'A light shortbow of seasoned oak.'},
 willowShortbow:{level:20,arange:20,ticks:4,arrowCap:'moonsilver',name:'Willow shortbow',wood:0xd5c38a,buy:260,reach:12,desc:'A pale, springy willow shortbow.'},
 mapleShortbow:{level:30,arange:29,ticks:4,arrowCap:'verdite',name:'Maple shortbow',wood:0xc58a4a,buy:520,reach:13,desc:'A maple shortbow with a smooth, strong draw.'},
 goldenBow:{level:30,arange:32,ticks:5,arrowCap:'verdite'},
 yewShortbow:{level:40,arange:47,ticks:4,arrowCap:'tidesteel',name:'Yew shortbow',wood:0x8d4f30,buy:1280,reach:13,desc:'A dark yew shortbow, favoured by wardens of the deep woods.'},
 bloodthornBow:{level:50,arange:69,ticks:4,arrowCap:'embersteel'}
};
// Staffs: magic attack bonus and the strongest spell family they can autocast.
export const STAFFS={apprenticeStaff:{level:1,amagic:4,spell:'strike'},sapphireStaff:{level:20,amagic:8,spell:'bolt'},amethystStaff:{level:30,amagic:10,spell:'blast'},emberStaff:{level:40,amagic:14,spell:'wave'}};
// OSRS elemental spell ladder: [Magic level, max hit] per family.
export const SPELLS={strike:[[1,2],[5,4],[9,6],[13,8]],bolt:[[17,9],[23,10],[29,11],[35,12]],blast:[[41,13],[47,14],[53,15],[59,16]],wave:[[62,17],[65,18],[70,19],[75,20]]};
const SPELL_ORDER=['strike','bolt','blast','wave'];
export function spellMaxHit(magicLevel,family='strike'){let best=0;for(const f of SPELL_ORDER.slice(0,SPELL_ORDER.indexOf(family)+1||1))for(const [lvl,hit] of SPELLS[f])if(magicLevel>=lvl)best=Math.max(best,hit);return best}

// Arrows: stackable ammunition stored by item id. The legacy 'arrows' item is iron.
export const ARROWS={bronzeArrows:{tier:'bronze',rstr:7},arrows:{tier:'iron',rstr:10},steelArrows:{tier:'steel',rstr:16},moonsilverArrows:{tier:'moonsilver',rstr:22},verditeArrows:{tier:'verdite',rstr:31},tidesteelArrows:{tier:'tidesteel',rstr:49},embersteelArrows:{tier:'embersteel',rstr:60}};
export const ARROW_IDS=Object.keys(ARROWS);
// The best arrow a bow can fire from what the player carries (counts by item id).
export function bestArrow(stats={},bowKey){const capIdx=tierIndex(BOWS[bowKey]?.arrowCap||'iron');let best=null;for(const [id,a] of Object.entries(ARROWS))if((Number(stats[id])||0)>0&&tierIndex(a.tier)<=capIdx&&(!best||tierIndex(a.tier)>tierIndex(ARROWS[best].tier)))best=id;return best}
export const arrowSupply=(stats={},bowKey)=>{const capIdx=tierIndex(BOWS[bowKey]?.arrowCap||'iron');return ARROW_IDS.filter(id=>tierIndex(ARROWS[id].tier)<=capIdx).reduce((n,id)=>n+(Number(stats[id])||0),0)};

// Weapon stats for every weapon key. Returns {bonuses, req, ticks, speed, styles}.
export function weaponGear(key,kind){
 if(BOWS[key]){const b=BOWS[key];return {bonuses:bonuses({a:[0,0,0,0,b.arange]}),req:{ranged:b.level},ticks:b.ticks,speed:+(b.ticks*TICK_SECONDS).toFixed(2),styles:{stab:'ranged',slash:'ranged',lunge:'ranged'},arrowCap:b.arrowCap}}
 if(STAFFS[key]){const s=STAFFS[key];return {bonuses:bonuses({a:[2,-1,8,s.amagic,0],d:[2,3,1,s.amagic,0]}),req:{magic:s.level},ticks:5,speed:+(5*TICK_SECONDS).toFixed(2),styles:{stab:'magic',slash:'magic',lunge:'magic'},spell:s.spell}}
 if(SPECIAL_WEAPONS[key]){const s=SPECIAL_WEAPONS[key],tier=s.tier&&tierById[s.tier],f=s.factor??tier.weapon,level=s.level??tier.level;return {bonuses:scaleTemplate(s.t,f),req:level>1?{attack:level}:{},ticks:s.t.ticks,speed:+(s.t.ticks*TICK_SECONDS).toFixed(2),styles:s.t.styles,...(tier?{tier:tier.id}:{})}}
 return null;
}
// Generated metal weapons: one per tier x template (iron keeps the legacy keys).
export function tierWeapons(){
 const out={};
 for(const tier of GEAR_TIERS)for(const [piece,t] of Object.entries(WEAPON_TEMPLATES)){
  const key=tier.id==='iron'?IRON_KEYS[piece]:tierItemKey(tier.id,piece);
  const price=Math.round((t.bars*[10,18,40,70,110,260,640,1800,4200][tier.index??GEAR_TIERS.indexOf(tier)])*1.25);
  out[key]={key,tier:tier.id,piece,model:t.model,name:tier.name+' '+t.label,kind:'weapon',twoHanded:!!t.twoHanded,reach:t.reach,
   bonuses:scaleTemplate(t,tier.weapon),req:tier.level>1?{attack:tier.level}:{},ticks:t.ticks,speed:+(t.ticks*TICK_SECONDS).toFixed(2),styles:t.styles,
   buy:Math.max(12,price),sell:Math.max(4,Math.round(price*.3)),tint:tier.id==='iron'?null:tier.color,
   desc:`A ${tier.name.toLowerCase()} ${t.label}.`};
 }
 return out;
}

// Knight (plate) armour templates, tier-40 reference. All other outfits keep fixed stats.
export const PLATE_PIECES={
 Armet:{d:[30,32,27,-1,30],a:[0,0,0,-6,-3]},
 HornedHelm:{d:[31,33,28,-1,31],a:[0,0,0,-6,-3],str:1},
 Breastplate:{d:[82,80,72,-6,80],a:[0,0,0,-30,-10]},
 Gauntlets:{d:[10,10,10,2,10],a:[0,0,0,-2,-1]},
 Greaves:{d:[51,49,47,-4,49],a:[0,0,0,-21,-11]},
 Sabatons:{d:[12,13,14,0,0],a:[0,0,0,-3,-1]},
 RoundPauldrons:{d:[8,8,8,-1,8],a:[0,0,0,-2,-1]},
 SpikedPauldrons:{d:[9,9,9,-1,9],a:[0,0,0,-2,-1],str:1}
};
export const PLATE_SMITH={Armet:{bars:2,off:7},HornedHelm:{bars:2,off:9},Breastplate:{bars:5,off:18},Gauntlets:{bars:1,off:3},Greaves:{bars:3,off:16},Sabatons:{bars:1,off:1},RoundPauldrons:{bars:2,off:11},SpikedPauldrons:{bars:2,off:13}};
// Existing knight colour variants: 1 = Iron, 3 = Blacksteel (own textures), 2 = Gilded (Defence 20).
export const KNIGHT_VARIANT_TIER={1:'iron',2:'gilded',3:'blacksteel'};
const GILDED={name:'Gilded',level:20,armour:.56};
const RANGER={1:{level:1,f:.35},3:{level:20,f:.6},2:{level:40,f:1,defence:40}};
const RANGER_PIECES={Hood:{a:[0,0,0,-1,4],d:[4,6,8,4,8]},Pauldron:{a:[0,0,0,-1,2],d:[3,3,3,2,4]},Tunic:{a:[0,0,0,-15,15],d:[18,27,24,20,40]},Bracers:{a:[0,0,0,-10,8],d:[3,2,4,2,0]},Trousers:{a:[0,0,0,-10,8],d:[12,15,18,8,20]},Boots:{a:[0,0,0,-2,3],d:[2,2,3,1,3]}};
const WIZARD={1:{level:1,f:.2},2:{level:20,f:.55},3:{level:40,f:1}};
const WIZARD_PIECES={RobeTop:{a:[0,0,0,20,0],d:[0,0,0,20,0]},RobeBottom:{a:[0,0,0,15,0],d:[0,0,0,15,0]},Bracers:{a:[0,0,0,5,0],d:[0,0,0,5,0]},Boots:{a:[0,0,0,3,0],d:[0,0,0,3,0]}};
const NOBLE_PIECES={Crown:{d:[1,1,1,2,1],prayer:3},Gorget:{d:[2,2,2,1,2],prayer:1},Pauldron:{d:[3,3,3,0,3]},LionPauldron:{d:[4,4,4,0,4],str:1},Coat:{d:[3,3,3,2,3],prayer:2},Sleeves:{d:[1,1,1,0,1]},Trousers:{d:[2,2,2,1,2]},Boots:{d:[1,1,1,0,1]}};
// Stats for an outfit item ({outfit, piece, variant, tier?}).
export function outfitGear(item){
 if(!item)return {bonuses:bonuses(),req:{}};
 if(item.outfit==='knight'){
  if(item.piece==='Gambeson')return {bonuses:bonuses({d:[8,9,10,4,9]}),req:{}};
  if(item.piece==='Scarf')return {bonuses:bonuses({d:[1,1,1,1,1],prayer:1}),req:{}};
  const tier=item.tier?tierById[item.tier]:KNIGHT_VARIANT_TIER[item.variant]==='gilded'?GILDED:tierById[KNIGHT_VARIANT_TIER[item.variant]],t=PLATE_PIECES[item.piece];
  if(!t||!tier)return {bonuses:bonuses(),req:{}};
  return {bonuses:scaleTemplate(t,tier.armour),req:tier.level>1?{defence:tier.level}:{},tier:item.tier||KNIGHT_VARIANT_TIER[item.variant]};
 }
 if(item.outfit==='ranger'){const v=RANGER[item.variant],t=RANGER_PIECES[item.piece];if(!v||!t)return {bonuses:bonuses(),req:{}};return {bonuses:scaleTemplate(t,v.f),req:{...(v.level>1?{ranged:v.level}:{}),...(v.defence?{defence:v.defence}:{})}}}
 if(item.outfit==='wizard'){const v=WIZARD[item.variant],t=WIZARD_PIECES[item.piece];if(!v||!t)return {bonuses:bonuses(),req:{}};return {bonuses:scaleTemplate(t,v.f),req:v.level>1?{magic:v.level}:{}}}
 if(item.outfit==='noble'){const t=NOBLE_PIECES[item.piece];return {bonuses:t?bonuses(t):bonuses(),req:{}}}
 return {bonuses:bonuses(),req:{}};
}
export const CAPE_GEAR={bonuses:bonuses({d:[1,1,1,1,1]}),req:{}};
// Generated plate armour for the tiers without their own colour variant.
export const PLATE_TIERS=['bronze','steel','moonsilver','verdite','tidesteel','embersteel','eldersteel'];
export const PLATE_NAMES={Armet:'armet helm',HornedHelm:'horned helm',Breastplate:'breastplate',Gauntlets:'gauntlets',Greaves:'greaves',Sabatons:'sabatons',RoundPauldrons:'round pauldrons',SpikedPauldrons:'spiked pauldrons'};
const PLATE_PRICE={Armet:60,HornedHelm:80,Breastplate:60,Gauntlets:40,Greaves:60,Sabatons:60,RoundPauldrons:40,SpikedPauldrons:55};
export const TIER_PRICE={bronze:.6,iron:1,steel:2.2,blacksteel:1.6,moonsilver:5,verdite:12,tidesteel:30,embersteel:90,eldersteel:220};

// Shields: [stab,slash,crush,magic,ranged] defence and attack penalties, tier-40 reference.
export const SHIELD_TEMPLATES={kite:{label:'kiteshield',model:'kite',d:[44,48,46,-1,46],a:[0,0,0,-8,-2],bars:3,off:12},square:{label:'heater shield',model:'square',d:[38,40,36,-1,38],a:[0,0,0,-6,-2],bars:2,off:8}};
const SPECIAL_SHIELDS={woodenShield:{d:[3,4,2,0,3]},roundShield:{d:[6,7,5,0,6]},quarteredShield:{d:[8,9,7,0,8]},celticShield:{t:SHIELD_TEMPLATES.kite,f:.6,level:20,prayer:2}};
export function shieldGear(key){
 if(SPECIAL_SHIELDS[key]){const s=SPECIAL_SHIELDS[key];if(s.t)return {bonuses:{...scaleTemplate(s.t,s.f),prayer:s.prayer||0},req:{defence:s.level}};return {bonuses:bonuses({d:s.d}),req:{}}}
 return null;
}
export function tierShields(){
 const out={};
 for(const tier of GEAR_TIERS)for(const [piece,t] of Object.entries(SHIELD_TEMPLATES)){
  const key=tier.id==='iron'?piece:tierItemKey(tier.id,piece==='square'?'heaterShield':'kiteshield'),price=Math.round(t.bars*15*TIER_PRICE[tier.id]);
  out[key]={key,tier:tier.id,piece,model:t.model,name:tier.name+' '+t.label,kind:'shield',bonuses:scaleTemplate(t,tier.armour),req:tier.level>1?{defence:tier.level}:{},
   buy:Math.max(12,price),sell:Math.max(4,Math.round(price*.3)),tint:['iron','blacksteel'].includes(tier.id)?(tier.id==='blacksteel'?tier.color:null):tier.color,desc:`A ${tier.name.toLowerCase()} ${t.label}.`};
 }
 return out;
}

// Requirements: {skill: level}. Returns the OSRS-style refusal, or null.
const article=name=>/^[AEIOU]/.test(name)?'an':'a';
export function requirementError(req={},levels={},verb='wield'){
 for(const skill of REQ_ORDER){const need=Number(req?.[skill])||0;if(need>1&&(Number(levels[skill])||1)<need){const n=SKILL_NAMES[skill];return `You need ${article(n)} ${n} level of ${need} to ${verb} this.`}}
 return null;
}
export const requirementText=(req={})=>REQ_ORDER.filter(s=>(Number(req?.[s])||0)>1).map(s=>SKILL_NAMES[s]+' '+req[s]).join(', ');

// ---- OSRS combat formulas -------------------------------------------------
// Effective level: level + style bonus + 8 (prayer boosts would multiply first).
export const effectiveLevel=(level,styleBonus=0)=>Math.max(1,Math.floor(Number(level)||1))+styleBonus+8;
// OSRS max hit, at the given resolution (scale 1 = OSRS numbers, HIT_SCALE = Eldervale damage).
export const maxHit=(effStrength,strengthBonus=0,scale=1)=>Math.floor(.5+effStrength*(strengthBonus+64)*scale/640);
export const attackRoll=(effAttack,attackBonus=0)=>effAttack*(attackBonus+64);
export const defenceRoll=(effDefence,defenceBonus=0)=>effDefence*(defenceBonus+64);
export const hitChance=(att,def)=>att>def?1-(def+2)/(2*(att+1)):att/(2*(def+1));
// Player magic defence uses 70% Magic and 30% Defence, as in OSRS.
export const magicDefenceLevel=(magic,defence)=>Math.floor(.7*magic+.3*defence);

// Monster attack types → the OSRS style they are defended with.
const MONSTER_STYLE={stab:'stab',bite:'stab',venom:'stab',sting:'stab',slash:'slash',claw:'slash',swoop:'slash',crush:'crush',punch:'crush',kick:'crush',charge:'crush',slam:'crush',arrow:'ranged',ranged:'ranged',spit:'ranged',magic:'magic',fire:'magic'};
export const monsterAttackStyle=type=>MONSTER_STYLE[type]||'crush';
export const isTrainingDummy=d=>!!(d&&(d.trainingDummy||d.species==='dummy'||d.template==='training_dummy'));
export const monsterDamageScale=level=>Math.max(1,1+((Number(level)||1)-20)/80);
// OSRS-style stat block for an Eldervale monster. Explicit fields win; otherwise the
// levels follow the monster's level, bonuses grow with it, and the strength bonus is
// chosen so the OSRS max-hit formula keeps the monster's existing hit size.
export function monsterStats(d={}){
 const L=Math.max(1,Math.floor(Number(d.level)||1)),num=(v,fb)=>Number.isFinite(Number(v))&&v!==null&&v!==''?Math.floor(Number(v)):fb;
 const attackLevel=num(d.attackLevel,L),strengthLevel=num(d.strengthLevel,L),defenceLevel=num(d.defenceLevel,L),magicLevel=num(d.magicLevel,L);
 const attackBonus=num(d.attackBonus,Math.floor(L/3)),base=num(d.defenceBonus,Math.floor(L/3));
 const defence=Object.fromEntries(COMBAT_TYPES.map(k=>[k,num(d.defenceBonuses?.[k],base)]));
 const dummy=isTrainingDummy(d),effStr=strengthLevel+9;
 const target=Math.round(2*(6+num(d.damage,4))*monsterDamageScale(L));
 const strengthBonus=num(d.strengthBonus,Math.max(0,Math.ceil(target*640/(HIT_SCALE*effStr))-64));
 const hit=dummy?0:num(d.maxHit,maxHit(effStr,strengthBonus,HIT_SCALE));
 return {level:L,attackLevel,strengthLevel,defenceLevel,magicLevel,attackBonus,strengthBonus,defence,maxHit:hit,attackStyle:monsterAttackStyle(d.attackType),dummy};
}

// ---- Player side ------------------------------------------------------------
// levels: {attack,strength,defence,ranged,magic}; bonusesTotal: equipment totals;
// weapon: {ranged,magic,styles,spell} (null = unarmed punch, crush).
export function playerAttackProfile({levels={},bonuses:b=bonuses(),weapon=null,style='slash',arrowRstr=0}={}){
 const s=STYLE_BONUS[style]||STYLE_BONUS.slash,lv=k=>Math.max(1,Number(levels[k])||1);
 if(weapon?.magic){const eff=lv('magic')+9,base=spellMaxHit(lv('magic'),weapon.spell||'strike');return {type:'magic',effAccuracy:eff,attackRoll:attackRoll(eff,b.amagic),maxHit:Math.floor(base*(100+(b.mdmg||0))/100)*HIT_SCALE,osrsMaxHit:Math.floor(base*(100+(b.mdmg||0))/100)}}
 if(weapon?.ranged){const eff=lv('ranged')+(style==='stab'?3:0)+8,rstr=(b.rstr||0);return {type:'ranged',effAccuracy:eff,attackRoll:attackRoll(eff,b.arange),maxHit:maxHit(eff,rstr,HIT_SCALE),osrsMaxHit:maxHit(eff,rstr)}}
 const type=weapon?.styles?.[style]||'crush',effA=effectiveLevel(lv('attack'),s.att),effS=effectiveLevel(lv('strength'),s.str);
 return {type,effAccuracy:effA,attackRoll:attackRoll(effA,b['a'+type]||0),maxHit:maxHit(effS,b.str,HIT_SCALE),osrsMaxHit:maxHit(effS,b.str)};
}
export function playerDefenceRoll({levels={},bonuses:b=bonuses(),style='slash',type='crush'}={}){
 const lv=k=>Math.max(1,Number(levels[k])||1),styleDef=(STYLE_BONUS[style]||STYLE_BONUS.slash).def;
 const eff=type==='magic'?magicDefenceLevel(lv('magic'),lv('defence'))+8:effectiveLevel(lv('defence'),styleDef);
 return defenceRoll(eff,b['d'+(type==='ranged'?'range':type)]||0);
}
const defKey=type=>type==='ranged'?'ranged':type;
// One player attack against a monster: 0 = miss/zero, else damage (Eldervale units).
export function rollPlayerHit(profile,monster,rng=Math.random){
 const ms=monsterStats(monster),type=profile.type,effDef=(type==='magic'?ms.magicLevel:ms.defenceLevel)+9,def=defenceRoll(effDef,ms.defence[defKey(type)]||0);
 if(ms.dummy)return 1+Math.floor(rng()*Math.max(1,profile.maxHit));
 if(rng()>=hitChance(profile.attackRoll,def))return 0;
 return Math.floor(rng()*(profile.maxHit+1));
}
export function rollMonsterHit(monster,{levels={},bonuses:b=bonuses(),style='slash'}={},rng=Math.random){
 const ms=monsterStats(monster);if(ms.dummy||ms.maxHit<=0)return 0;
 const att=attackRoll(ms.attackLevel+9,ms.attackBonus),def=playerDefenceRoll({levels,bonuses:b,style,type:ms.attackStyle});
 if(rng()>=hitChance(att,def))return 0;
 return Math.floor(rng()*(ms.maxHit+1));
}
// Attack period in seconds; Rapid (slash with a bow) is one tick faster.
export const attackPeriod=(weapon,style)=>Math.max(TICK_SECONDS*2,(Number(weapon?.speed)||1.8)-(weapon?.ranged&&!weapon?.magic&&style==='slash'?TICK_SECONDS:0));
// Labels for the three style buttons.
export function styleLabels(weapon){
 if(weapon?.magic)return {stab:['Accurate','Casts at full accuracy. Magic XP.'],slash:['Accurate','Casts at full accuracy. Magic XP.'],lunge:['Accurate','Casts at full accuracy. Magic XP.']};
 if(weapon?.ranged)return {stab:['Accurate','+3 effective Ranged. Ranged XP.'],slash:['Rapid','Shoots one tick faster. Ranged XP.'],lunge:['Longrange','+3 effective Defence. Ranged XP.']};
 const t=k=>cap(weapon?.styles?.[k]||'crush');
 return {stab:['Accurate ('+t('stab')+')','+3 effective Attack. Awards Attack XP.'],slash:['Aggressive ('+t('slash')+')','+3 effective Strength. Awards Strength XP.'],lunge:['Controlled ('+t('lunge')+')','+1 Attack, Strength and Defence. Shares XP.']};
}

// Human-readable bonus lines, OSRS equipment-screen order.
export const BONUS_LABELS=[['Attack bonus',[['astab','Stab'],['aslash','Slash'],['acrush','Crush'],['amagic','Magic'],['arange','Range']]],['Defence bonus',[['dstab','Stab'],['dslash','Slash'],['dcrush','Crush'],['dmagic','Magic'],['drange','Range']]],['Other bonuses',[['str','Melee strength'],['rstr','Ranged strength'],['mdmg','Magic damage'],['prayer','Prayer']]]];
const signed=v=>(v>=0?'+':'')+v;
export function bonusSummary(b){if(!b)return '';const parts=[];for(const [k,l] of [['astab','Stab'],['aslash','Slash'],['acrush','Crush'],['amagic','Magic'],['arange','Range']])if(b[k])parts.push('Att '+l+' '+signed(b[k]));for(const [k,l] of [['dstab','Stab'],['dslash','Slash'],['dcrush','Crush'],['dmagic','Magic'],['drange','Range']])if(b[k])parts.push('Def '+l+' '+signed(b[k]));if(b.str)parts.push('Str '+signed(b.str));if(b.rstr)parts.push('Ranged str '+signed(b.rstr));if(b.mdmg)parts.push('Magic dmg '+signed(b.mdmg)+'%');if(b.prayer)parts.push('Prayer '+signed(b.prayer));return parts.join(' · ')}
// Examine / tooltip text: requirement, bonuses and speed.
export function describeGear(item){
 if(!item)return '';const bits=[];const req=requirementText(item.req);bits.push(req?'Requires '+req:'No level requirement');
 const b=bonusSummary(item.bonuses);if(b)bits.push(b);if(item.ticks)bits.push('Speed '+item.ticks+' ticks ('+item.speed+'s)');if(item.arrowCap)bits.push('Arrows up to '+tierById[item.arrowCap].name.toLowerCase());if(item.spell)bits.push('Casts '+item.spell+' spells');
 return bits.join(' · ');
}
// Skill levels from a client state / save skills object (xp keys).
export function levelsFromXp(skills={},level){const out={};for(const [k,x] of Object.entries(SKILL_XP_KEYS))out[k]=level(Number(skills[x])||0);return out}
