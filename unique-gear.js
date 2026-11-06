// Eldervale unique gear: boss drops, dragon-only drops, the anti-breath shields and the quest
// rewards reserved for the story arcs. Pure data (no Three.js). weapons.js, shields.js and
// outfits.js add these to their catalogs (each reuses an existing model, recoloured with the tier
// tint and given an accent: an emissive trim + a few drifting motes, unique-look.js);
// scripts/build-bosses-sql.mjs writes the server catalog rows (db/bosses-4-gear.sql).
//
// Flags: tradeable (false = refused by the trade window, kept on death), shopless (never stocked by
// any shop), quest (granted by quests only; no drop source). Bonuses use the OSRS-style keys of
// gear-tiers.js bonuses(): a = attack [stab,slash,crush,magic,ranged], d = defence, str, rstr, prayer.
import {bonuses} from './gear-tiers.js?v=release-20261106-boss107';

const AXE={stab:'slash',slash:'slash',lunge:'crush'},STAB={stab:'stab',slash:'slash',lunge:'stab'},SPEAR={stab:'stab',slash:'slash',lunge:'crush'},CRUSH={stab:'crush',slash:'crush',lunge:'crush'},HEAVY={stab:'slash',slash:'slash',lunge:'crush'},MAGIC={stab:'magic',slash:'magic',lunge:'magic'};
const U=(id,kind,o)=>({id,kind,catalogId:kind+':'+id,tradeable:true,shopless:true,quest:false,...o,bonuses:bonuses(o.b||{})});
export const UNIQUE_ITEMS=[
 // ---- boss uniques
 U('unbrokenCleaver','weapon',{name:'Unbroken Cleaver',model:'battleaxe',tint:0x4a4440,accent:{color:0xff6a1a,motes:'embers'},ticks:6,reach:2.3,styles:AXE,req:{attack:75},
  b:{a:[-2,84,74],str:112},value:950000,boss:'grimtusk',desc:'Grimtusk’s own axe. The edge has never been sharpened; it has never needed to be.'}),
 U('warlordTuskhelm','armor',{name:'Warlord’s Tuskhelm',base:'eldersteelHornedHelm',tint:0x5d4a36,accent:{color:0xff6a1a},req:{defence:75},
  b:{d:[52,54,48,-1,50],a:[0,0,0,-6,-3],str:4},value:420000,boss:'grimtusk',desc:'Bone tusks riveted to blackened steel. It makes everyone else take a step back.'}),
 U('hollowScepter','weapon',{name:'Scepter of the Hollow Court',model:'amethystStaff',staff:true,color:0x7fe8ff,tint:0xcfe8ff,accent:{color:0x7fe8ff,motes:'frost'},ticks:5,reach:11,styles:MAGIC,req:{magic:75},spell:'wave',
  b:{a:[4,-1,10,26,0],d:[3,4,2,22,0],prayer:2},value:880000,boss:'hollow_king',desc:'It still expects to be obeyed. Spells cast through it hit a little harder.'}),
 U('hollowCrown','armor',{name:'The Hollow Crown',base:'nobleCrown2',tint:0xbfe8ff,accent:{color:0x7fe8ff,motes:'frost'},req:{magic:70},tradeable:false,
  b:{d:[8,8,8,16,8],a:[0,0,0,12,0],prayer:6},value:600000,boss:'hollow_king',desc:'Cold to the touch and lighter than it should be. It will not leave the one who took it.'}),
 U('broodfang','weapon',{name:'Broodfang',model:'dagger',tint:0x2a2236,accent:{color:0x9dff6e,motes:'venom'},ticks:4,reach:1.7,styles:STAB,req:{attack:75},venom:true,
  b:{a:[78,40,-4],str:72},value:700000,boss:'gloom_matriarch',desc:'A fang from the Matriarch’s first brood. Its venom never quite dries.'}),
 U('gloomsilkMantle','armor',{name:'Gloomsilk Mantle',base:'rangerPauldron2',tintMode:'all',tint:0x4a2e6e,accent:{color:0xd06bff},req:{defence:70},
  b:{d:[14,14,14,12,18],a:[0,0,0,4,6]},value:300000,boss:'gloom_matriarch',desc:'Silk so fine it drinks the light. Arrows slide off it like rain.'}),
 U('rimeheartSpear','weapon',{name:'Rimeheart Spear',model:'spear',tint:0xcfefff,accent:{color:0x8fd8ff,motes:'frost'},ticks:4,reach:3.2,styles:SPEAR,req:{attack:75},
  b:{a:[72,72,72],str:86},value:820000,boss:'frostmaw',desc:'Carved from the glacier’s heart. The haft stays cold in a forge.'}),
 U('glacierscaleGreaves','armor',{name:'Glacierscale Greaves',base:'eldersteelGreaves',tint:0xbfe6ff,accent:{color:0x8fd8ff},req:{defence:75},
  b:{d:[84,80,76,4,80],a:[0,0,0,-18,-9],str:2},value:450000,boss:'frostmaw',desc:'Overlapping scales of blue ice that never melts.'}),
 U('cindercoreMaul','weapon',{name:'Cindercore Maul',model:'warhammer',twoHanded:true,tint:0x2e2a28,accent:{color:0xff6a1a,motes:'embers'},ticks:6,reach:2.5,styles:CRUSH,req:{attack:78,strength:70},
  b:{a:[-4,-4,124],str:132},value:1100000,boss:'ashen_colossus',desc:'A shard of the Colossus’s core on an iron haft. It is still warm. It is always still warm.'}),
 U('heartforgePlate','armor',{name:'Heartforge Breastplate',base:'eldersteelBreastplate',tint:0x3a2a24,accent:{color:0xff6a1a,motes:'embers'},req:{defence:78},
  b:{d:[132,128,118,-4,126],a:[0,0,0,-28,-10],str:4},value:1300000,boss:'ashen_colossus',desc:'Cooled from the Colossus’s own slag. Faint fire moves under the plates.'}),
 U('twinflameGlaive','weapon',{name:'Twinflame Glaive',model:'scythe',twoHanded:true,tint:0x6a2d3a,accent:{color:0xff6a1a,color2:0x8fd8ff,motes:'twin'},ticks:5,reach:3,styles:HEAVY,req:{attack:80},
  b:{a:[20,104,86],str:128},value:4000000,boss:'twinflame_wyrm',desc:'One edge burns, the other freezes. Vaelith never forgave the smith.'}),
 // ---- dragon-only: wyrmscale (ranged armour), material, shield, tonic
 U('wyrmscaleCoif','armor',{name:'Wyrmscale coif',base:'rangerHood3',tintMode:'all',tint:0x8a3a2a,accent:{color:0xffa060},req:{ranged:60,defence:40},
  b:{a:[0,0,0,-1,7],d:[6,9,12,6,12]},value:36000,dragon:true,desc:'Small, hard scales laced over leather.'}),
 U('wyrmscaleJerkin','armor',{name:'Wyrmscale jerkin',base:'rangerTunic3',tintMode:'all',tint:0x8a3a2a,accent:{color:0xffa060},req:{ranged:60,defence:40},
  b:{a:[0,0,0,-15,30],d:[40,32,45,40,60]},value:110000,dragon:true,desc:'A drake’s back-scales, stitched for an archer.'}),
 U('wyrmscaleChaps','armor',{name:'Wyrmscale chaps',base:'rangerTrousers3',tintMode:'all',tint:0x8a3a2a,accent:{color:0xffa060},req:{ranged:60,defence:40},
  b:{a:[0,0,0,-10,17],d:[25,19,27,14,31]},value:68000,dragon:true,desc:'Flexible scale chaps that turn a claw.'}),
 U('wyrmscaleVambraces','armor',{name:'Wyrmscale vambraces',base:'rangerBracers3',tintMode:'all',tint:0x8a3a2a,accent:{color:0xffa060},req:{ranged:60},
  b:{a:[0,0,0,-10,13],d:[5,4,7,6,0]},value:30000,dragon:true,desc:'Scale vambraces with a bowstring guard.'}),
 U('scalewardShield','shield',{name:'Scaleward Shield',model:'kite',tint:0x7a3a2a,accent:{color:0xffb070},req:{defence:60},breathWard:'shieldPct',
  b:{d:[55,58,56,8,56],a:[0,0,0,-8,-2]},value:90000,craft:{skill:'smithing',level:62,station:'anvil',inputs:{runiteBar:2,wyrmScale:3},xp:180},desc:'Wyrm scales riveted over tidesteel. Turns most of a dragon’s breath.'}),
 // ---- quest rewards (R3-J grants these; untradeable, kept on death)
 U('wardensAegis','shield',{name:'Aegis of the Last Warden',model:'kite',tint:0xd8c070,accent:{color:0x9fe8ff,motes:'frost'},req:{defence:70},breathWard:'aegisPct',quest:true,tradeable:false,
  b:{d:[62,66,64,14,64],a:[0,0,0,-6,-2],prayer:3},value:0,desc:'The last warden of the old frontier carried it into the Wyrmhold, and out again.'}),
 U('crownwardenSigil','armor',{name:'Crownwarden’s Sigil',base:'nobleGorget1',tint:0xe8c56a,accent:{color:0xfff1b0},quest:true,tradeable:false,
  b:{a:[6,6,6,6,6],d:[10,10,10,6,10],prayer:4},value:0,desc:'Worn by the crown’s sworn wardens. The engraving is your name.'}),
 U('emberOathGauntlets','armor',{name:'Gauntlets of the Ember Oath',base:'eldersteelGauntlets',tint:0x8a2a1a,accent:{color:0xff7a2a,motes:'embers'},req:{defence:60},quest:true,tradeable:false,
  b:{a:[6,6,6,0,0],d:[14,14,14,4,14],str:6},value:0,desc:'The cult swore on these. You broke the oath and kept the gloves.'}),
 U('pathfinderBoots','armor',{name:'Pathfinder’s Boots',base:'rangerBoots1',tintMode:'all',tint:0x5a6a3a,accent:{color:0xb8ff9a},quest:true,tradeable:false,weight:-4.5,
  b:{a:[0,0,0,0,4],d:[4,4,5,4,5]},value:0,desc:'Light as moss. Winterwatch’s scouts swear they walk you home.'}),
 U('tidecallerStaff','weapon',{name:'Tidecaller’s Staff',model:'sapphireStaff',staff:true,color:0x4fd6c8,tint:0x9fe8e0,accent:{color:0x4fd6c8,motes:'frost'},ticks:5,reach:11,styles:MAGIC,req:{magic:65},spell:'wave',quest:true,tradeable:false,
  b:{a:[2,-1,8,20,0],d:[2,3,1,20,0],prayer:1},value:0,desc:'Salt-crusted driftwood that hums like a shell held to the ear.'})
];
export const UNIQUE_MATERIALS=[
 {id:'wyrmScale',name:'Wyrm scale',category:'Materials',value:4200,stackable:true,desc:'A hard, heat-proof scale shed by a dragon.'},
 {id:'breathwardTonic',name:'Breathward tonic',category:'Potions',value:2400,breathward:500,desc:'Thick and peppery. For five minutes dragon breath only singes.'}
];
export const uniqueById=Object.fromEntries(UNIQUE_ITEMS.map(u=>[u.id,u]));
export const QUEST_REWARD_ITEMS=UNIQUE_ITEMS.filter(u=>u.quest).map(u=>u.catalogId);
export const BOSS_UNIQUE_ITEMS=UNIQUE_ITEMS.filter(u=>u.boss).map(u=>u.catalogId);
// Specials and poison for the unique weapons (mech_rules 'special' / 'poison', mechanics II format).
export const UNIQUE_SPECIALS={
 unbrokenCleaver:{name:'Sunder',cost:50,accMult:1.25,dmgMult:1.2,effect:'drainDefence',drainPct:20,text:'A cleaving blow that splits armour (−20% Defence).'},
 broodfang:{name:'Brood bite',cost:25,hits:2,accMult:1.2,dmgMult:1.1,text:'Two quick venomous bites.'},
 rimeheartSpear:{name:'Rime lock',cost:50,accMult:1.1,dmgMult:1.1,effect:'bind',bindTicks:6,text:'Freezes the target in place for 6 ticks.'},
 cindercoreMaul:{name:'Slag crush',cost:60,accMult:1.1,dmgMult:1.4,text:'A crushing blow with the full weight of the core.'},
 twinflameGlaive:{name:'Twin cut',cost:60,hits:2,accMult:1.15,dmgMult:1.05,text:'One burning cut, one freezing cut.'}
};
export const UNIQUE_POISON={'weapon:broodfang':{venom:true,chance:.25}};
// Legacy display numbers the old HUD still shows (same rule as weapons.js for tier weapons).
export const legacyWeaponNumbers=u=>({damage:Math.round(u.bonuses.str/3)+2,attack:Math.max(u.bonuses.astab,u.bonuses.aslash,u.bonuses.acrush,u.bonuses.amagic)});
export const defenceOf=u=>Math.max(1,Math.round((u.bonuses.dstab+u.bonuses.dslash+u.bonuses.dcrush)/12)+3);
