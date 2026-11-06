// Eldervale monster roster: 53 original creature types from level 2 to 120, in the
// spirit of an Old School bestiary (level curve, stat blocks, bones and tiered drop
// tables, bosses in remote corners) without borrowing its names. Pure data:
// bestiary.js merges `rosterBeasts` into the owner console catalog, the tests check
// the curve and drop tables, and scripts/build-monster-roster-sql.mjs writes the
// server seed (db/monster-roster.sql) from the same rows and monster-spawns.js.
//
// Every type reuses an existing creature model (world-models.js / monster-dragon.js)
// with its own scale, tint, eye colour and small accessory parts, or a humanoid body
// with its own skin, gear and weapon — no new heavy assets.

// Prayer: bones are buried from the inventory (OSRS XP: 4.5 / 15 / 72), or offered
// at an altar for double XP. db/monster-roster.sql adds the catalog rows and command.
export const BONES={bones:{name:'Bones',xp:4.5,color:0xe4dcc4},heftyBones:{name:'Hefty bones',xp:15,color:0xd8ccae},wyrmBones:{name:'Wyrm bones',xp:72,color:0xb9c7b0}};
export const ALTAR_OFFER_MULTIPLIER=2;

// Hostile monsters never stand inside these (server town_zones; the castle courtyard
// is its tutorial ground). Spawns also keep their roam radius plus a margin clear.
export const SAFE_ZONES=[{id:'Eldervale Castle',x:-340,z:-305,radius:69,square:true},{id:'Birchford',x:-218,z:143,radius:66,square:true},{id:'Winterwatch',x:217,z:-244,radius:44,square:false},{id:'Emberspire',x:257,z:213,radius:44,square:false}];
export function safeZoneDistance(x,z){let best=Infinity;for(const s of SAFE_ZONES){const d=s.square?Math.max(Math.abs(x-s.x),Math.abs(z-s.z))-s.radius:Math.hypot(x-s.x,z-s.z)-s.radius;best=Math.min(best,d)}return best}

// Gear tier for a monster level, and the next tier up for its rare drop.
// Embersteel only drops from level 60+, Eldersteel from 80+ (both are loot-only).
const LADDER=[[1,'bronze'],[5,'iron'],[12,'steel'],[20,'blacksteel'],[30,'moonsilver'],[45,'verdite'],[55,'tidesteel'],[70,'embersteel'],[90,'eldersteel']];
export function tierForLevel(level){let t='bronze';for(const [l,id] of LADDER)if(level>=l)t=id;return t}
export const TIER_MIN_LEVEL={embersteel:60,eldersteel:80};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
// Item ids per tier (iron keeps the legacy keys; blacksteel has no plate of its own).
export const W=(tier,piece)=>'weapon:'+(tier==='iron'?piece:tier+cap(piece));
export const A=(tier,piece)=>{if(tier==='iron')return 'armor:'+({Armet:'helm',Breastplate:'chest',Greaves:'legs',Sabatons:'boots',Gauntlets:'knightGauntlets1'}[piece]||'helm');if(tier==='blacksteel')return 'armor:'+({Armet:'knightArmet3',Breastplate:'knightBreastplate3',Greaves:'knightGreaves3',Sabatons:'knightSabatons3',Gauntlets:'knightGauntlets3'}[piece]||'knightArmet3');return 'armor:'+tier+piece};
export const S=(tier,kind='Kiteshield')=>tier==='iron'?'shield:kite':'shield:'+tier+(kind==='Heater'?'HeaterShield':'Kiteshield');
export const ARROW={bronze:'bronzeArrows',iron:'arrows',steel:'steelArrows',blacksteel:'steelArrows',moonsilver:'moonsilverArrows',verdite:'verditeArrows',tidesteel:'tidesteelArrows',embersteel:'embersteelArrows',eldersteel:'embersteelArrows'};
export const BAR={bronze:'bronzeBar',iron:'ironBar',steel:'steelBar',blacksteel:'blacksteelBar',moonsilver:'mithrilBar',verdite:'adamantBar',tidesteel:'runiteBar',embersteel:'runiteBar',eldersteel:'runiteBar'};
export const ORE={bronze:'copperOre',iron:'ore',steel:'coal',blacksteel:'coal',moonsilver:'mithrilOre',verdite:'adamantOre',tidesteel:'runiteOre',embersteel:'runiteOre',eldersteel:'runiteOre'};

// Loot rows (at most 8, rolled independently by the server): `always` rows ignore the
// drop-rate multiplier; `rare` only marks the row in the console.
const drop=(item,min=1,max=min,chance=1)=>({item,min,max,chance});
const always=(item,min=1,max=min)=>({item,min,max,chance:1,always:true});
const rare=(item,chance,min=1,max=min)=>({item,min,max,chance,rare:true});

// OSRS-style stat block from level, rank and fighting archetype. Hitpoints are 10x
// OSRS (Eldervale health); maxHit is in Eldervale damage (10x OSRS). The server's
// monster_stats() reads attack/strength/defence/magic levels, attackBonus,
// strengthBonus, defenceBonuses and maxHit from the entity, so these numbers are
// what combat uses.
export const RANKS={Peaceful:{hp:.8,hit:.8},Common:{hp:1,hit:1},Veteran:{hp:1.25,hit:1.08},Elite:{hp:1.6,hit:1.15},Boss:{hp:3.2,hit:1.55},Legendary:{hp:4,hit:1.7}};
const ARCHETYPES={
 // [att,str,def,mag] multipliers on level, and defence-bonus multipliers per style
 // (stab, slash, crush, magic, ranged): a weakness is a low multiplier.
 beast:{lv:[.9,.95,.8,.3],def:[.8,.8,1,.6,1]},
 swift:{lv:[1,.8,.7,.3],def:[.7,.7,.9,.7,.8]},
 brute:{lv:[.85,1.15,.85,.3],def:[1,1.1,.9,.5,.9]},
 tank:{lv:[.85,.9,1.2,.5],def:[1.3,1.3,1,.9,1.4]},
 bones:{lv:[.95,.95,.9,.4],def:[1.3,1.2,.4,1,1.3]},
 caster:{lv:[.7,.6,.7,1.2],def:[.8,.8,.8,1.4,.6]},
 archer:{lv:[1,.8,.75,.5],def:[.8,.8,.9,.9,1.3]},
 spirit:{lv:[.95,.9,.85,1],def:[1.2,1.2,1.2,.6,1.2]},
 stone:{lv:[.85,1,1.25,.4],def:[1.4,1.5,.5,1.1,1.6]},
 dragon:{lv:[1,1,1,1],def:[1.3,1.3,1.2,1,1.1]}
};
export function statBlock(level,rank='Common',arch='beast'){
 const r=RANKS[rank],a=ARCHETYPES[arch],L=level;
 const hp=Math.max(20,Math.round((L*.9+3)*10*r.hp/5)*5),maxHit=Math.max(8,Math.round(10*(1+L*.12)*r.hit));
 const [att,str,def,mag]=a.lv.map(f=>Math.max(1,Math.round(L*f*(rank==='Boss'||rank==='Legendary'?1.08:1))));
 const base=Math.floor(L/3),defenceBonuses=Object.fromEntries(['stab','slash','crush','magic','ranged'].map((k,i)=>[k,Math.round(base*a.def[i])]));
 return {hp,maxHit,damage:Math.max(1,Math.round(maxHit*.08)),attackLevel:att,strengthLevel:str,defenceLevel:def,magicLevel:mag,attackBonus:Math.round(base*(rank==='Boss'||rank==='Legendary'?1.4:1)),defenceBonuses,
  xpReward:Math.round(L*4+L*L*.35*(rank==='Boss'||rank==='Legendary'?2:rank==='Elite'?1.3:1)),goldReward:Math.round(L*1.5+L*L/40*(rank==='Boss'||rank==='Legendary'?3:1))};
}

// One roster row → a bestiary entry ({label,template,loot,...stats,...extra}, the shape
// bestiary.js already uses). `o` overrides anything computed.
function beast(key,template,name,level,rank,arch,o,loot){
 const stats=statBlock(level,rank,arch),{region,examine,group,...rest}=o;
 return [key,{label:name,template,loot,name,level,...stats,respawn:{Peaceful:30,Common:35,Veteran:60,Elite:120,Boss:600,Legendary:900}[rank],roam:rank==='Boss'||rank==='Legendary'?4:5,...rest,region,tier:rank,examine,roster:true}];
}
const T=tierForLevel;
// Standard drop table: bones + coins-equivalent resources + tier gear.
function gear(level,{weapon='scimitar',armour='Armet',shield=true,arrows=false,chance=1}={}){const t=T(level),i=LADDER.findIndex(([,id])=>id===t),up=LADDER[Math.min(LADDER.length-1,i+1)][1],next=(TIER_MIN_LEVEL[up]||0)>level?t:up;
 return [drop(W(t,weapon),1,1,.06*chance),drop(A(t,armour),1,1,.045*chance),...(shield?[drop(S(t),1,1,.03*chance)]:[]),...(arrows?[drop(ARROW[t],5,15,.25)]:[]),...(next!==t?[rare(W(next,weapon),.012*chance)]:[])]}

const R=[
 // ---------------------------------------------------------------- Early (2–15)
 beast('hedgerow_rat','rat','Hedgerow rat',2,'Common','swift',{hostile:false,attackType:'bite',scale:.62,tint:0x6d5a48,region:'Birchford meadows',examine:'Fat on spilled grain and twice as bold.'},
  [always('bones'),drop('rawMeat',1,1,.4),drop('trapBait',1,2,.15),drop('copperOre',1,1,.08)]),
 beast('dusk_bat','bat','Dusk bat',3,'Common','swift',{hostile:false,attackType:'swoop',scale:.7,tint:0x3d3346,eyes:0xffd27a,region:'Royal Heartlands ruins',examine:'It only wakes when the lanterns are lit.'},
  [always('bones'),drop('feathers',2,6,.3),drop('hide',1,1,.08)]),
 beast('icetooth_rat','rat','Icetooth rat',3,'Common','swift',{hostile:false,attackType:'bite',scale:.66,tint:0xc9d3d9,eyes:0x3a5f8a,region:'Winterwatch outskirts',examine:'Its fur is crusted white with rime.'},
  [always('bones'),drop('rawMeat',1,1,.4),drop('fur',1,1,.2),drop('tinOre',1,1,.08)]),
 beast('bramble_goblin','goblin','Bramblekin goblin',4,'Common','swift',{hostile:true,attackType:'stab',weapon:'bronzeDagger',scale:.78,look:{skin:'#6f8a3c'},gear:['rangerHood2','rangerTunic2','peasantTrousers2'],region:'Kingsroad meadows',examine:'Wears thorns in its hair and steals them from hedges.'},
  [always('bones'),drop('bronzeArrows',3,8,.25),drop('feathers',3,8,.2),drop('trailBerries',1,2,.2),drop('weapon:bronzeDagger',1,1,.05),drop('armor:bronzeArmet',1,1,.03),rare('weapon:dagger',.01)]),
 beast('mossweb_spider','spider','Mossweb spider',5,'Common','swift',{hostile:true,attackType:'venom',scale:.55,tint:0x4f6b3a,eyes:0xd6ff6a,region:'Thornwood edge',examine:'Small, green and very patient.'},
  [always('bones'),drop('thread',1,3,.35),drop('herbSeeds',1,1,.06)]),
 beast('snowpelt_fox','wolf','Snowpelt fox',5,'Common','swift',{hostile:false,attackType:'bite',scale:.62,tint:0xe9ece8,eyes:0x2a1f12,region:'Winterwatch outskirts',examine:'You only see it when it moves.'},
  [always('bones'),drop('fur',1,1,.45),drop('rawMeat',1,1,.3)]),
 beast('dune_jackal','wolf','Dune jackal',6,'Common','swift',{hostile:true,attackType:'bite',scale:.7,tint:0xb98d55,region:'Emberspire scrubland',examine:'Laughs at travellers who carry too much water.'},
  [always('bones'),drop('hide',1,1,.3),drop('rawMeat',1,1,.3),drop('bronzeArrows',2,6,.1)]),
 beast('peat_imp','imp','Peat imp',7,'Common','caster',{hostile:false,attackType:'magic',scale:.55,tint:0x5d6b3b,eyes:0xb8ff7a,breath:0x9be26a,region:'Willow fen',examine:'Smells of bog-smoke and mischief.'},
  [always('ashes'),drop('airRune',3,8,.35),drop('runeEssence',1,3,.25),drop('grimyHerb',1,1,.12),drop('weapon:apprenticeStaff',1,1,.02)]),
 beast('wayside_footpad','bandit','Wayside footpad',7,'Common','swift',{hostile:true,attackType:'stab',weapon:'dagger',look:{skin:'#b98262',hair:'Cropped',hairColor:'#3a2a1d',beard:'Beard'},gear:['peasantShirt3','peasantTrousers3','rangerHood3'],region:'Birchford wayside',examine:'Polite, until you look away.'},
  [always('bones'),drop('trailRations',1,1,.25),drop('lockpick',1,1,.06),drop('arrows',3,8,.2),...gear(7,{weapon:'dagger',shield:false})]),
 beast('sand_scuttler','spider','Sand scuttler',8,'Common','tank',{hostile:true,attackType:'venom',scale:.72,tint:0xc8a46a,eyes:0x1d1610,spikes:true,accent:0x8a6a3c,region:'Emberspire scrubland',examine:'Its shell rings like pottery when struck.'},
  [always('bones'),drop('thread',1,2,.3),drop('copperOre',1,2,.15),drop('uncutGem',1,1,.02)]),
 beast('mound_shambler','zombie','Mound shambler',9,'Common','brute',{hostile:true,attackType:'claw',look:{skin:'#8a9a78'},gear:['peasantShirt1','peasantTrousers1'],region:'Royal Heartlands mounds',examine:'Something dug it up. It would like to return the favour.'},
  [always('bones'),drop('linen',1,1,.15),drop('herbSeeds',1,2,.12),drop('grimyHerb',1,1,.1),...gear(9,{weapon:'hammer'})]),
 beast('thornback_boar','boar','Thornback boar',12,'Common','brute',{hostile:true,attackType:'charge',scale:1.15,tint:0x4b3b2f,spikes:true,accent:0x9c8b66,region:'Bramble dell',examine:'The thorns on its back are its own.'},
  [always('heftyBones'),drop('rawMeat',1,2,.6),drop('hide',1,1,.4)]),
 beast('cairn_skeleton','skeleton','Cairn skeleton',13,'Common','bones',{hostile:true,attackType:'slash',weapon:'scimitar',gear:['peasantShirt2','helm'],region:'Cairn hollow',examine:'Still guarding a cairn nobody remembers.'},
  [always('bones'),drop('airRune',3,8,.25),drop('arrows',4,10,.2),...gear(13,{weapon:'scimitar'})]),
 beast('hedge_brigand','bandit','Hedge brigand',15,'Common','swift',{hostile:true,attackType:'slash',weapon:'steelScimitar',look:{skin:'#c69a7a',hair:'Long',hairColor:'#5b3c28',beard:'Beard'},gear:['knightGambeson2','peasantTrousers2','knightScarf2'],region:'Brigand thicket',examine:'He calls it a toll. Nobody else does.'},
  [always('bones'),drop('trailRations',1,2,.25),drop('steelArrows',3,10,.2),drop('lockpick',1,1,.05),...gear(15,{weapon:'scimitar'})]),
 // ---------------------------------------------------------------- Mid (17–46)
 beast('tuskgob_brute','goblin','Tuskgob brute',17,'Common','brute',{hostile:true,attackType:'hammer',weapon:'steelHammer',scale:1.02,look:{skin:'#566b33'},gear:['knightHornedHelm1','knightGambeson1','knightGauntlets1'],region:'Tuskgob warren',examine:'Bigger than a goblin. Angrier than two.'},
  [always('bones'),drop('ironBar',1,1,.15),drop('steelArrows',3,8,.15),...gear(17,{weapon:'hammer'})]),
 beast('fen_lurker','spider','Fen lurker',18,'Common','swift',{hostile:true,attackType:'venom',scale:1.05,tint:0x2f3f33,eyes:0x9dff6e,region:'Gloomfen',examine:'The reeds move. There is no wind.'},
  [always('bones'),drop('thread',2,5,.4),drop('grimyHerb',1,2,.25),drop('vial',1,1,.08),drop('uncutGem',1,1,.03)]),
 beast('cinderwing_bat','bat','Cinderwing bat',18,'Common','swift',{hostile:true,attackType:'fire',scale:.95,tint:0x5a2a22,eyes:0xffb347,breath:0xff7a33,region:'Cinderwing roost',examine:'Its wings leave sparks in the dusk.'},
  [always('bones'),drop('fireRune',4,10,.35),drop('coal',1,2,.2),drop('feathers',4,10,.2)]),
 beast('rime_imp','imp','Rime imp',19,'Common','caster',{hostile:true,attackType:'magic',scale:.62,tint:0x86b7d6,eyes:0xe6fbff,horns:true,accent:0xe9f6ff,breath:0x9fdcff,region:'Frostfang pass',examine:'It giggles in a voice like cracking ice.'},
  [always('ashes'),drop('airRune',5,12,.4),drop('runeEssence',2,5,.3),drop('weapon:apprenticeStaff',1,1,.03),rare('weapon:sapphireStaff',.008)]),
 beast('sandscar_raider','bandit','Sandscar raider',22,'Common','swift',{hostile:true,attackType:'slash',weapon:'blacksteelScimitar',look:{skin:'#a8714d',hair:'Bald',beard:'Beard',hairColor:'#211b18'},gear:['rangerHood1','rangerTunic1','rangerTrousers1','rangerBracers1'],region:'Sandscar hideout',examine:'The desert taught him to take what he needs, and then some.'},
  [always('bones'),drop('trailRations',1,2,.2),drop('goldOre',1,1,.08),drop('steelArrows',4,12,.2),...gear(22,{weapon:'scimitar'})]),
 beast('marsh_wight','revenant','Marsh wight',24,'Common','spirit',{hostile:true,attackType:'magic',scale:1,tint:0x5f7a64,eyes:0xc8ff9a,region:'Gloomfen',examine:'A drowned shepherd who still counts the sheep.'},
  [always('bones'),drop('airRune',6,14,.35),drop('fireRune',4,10,.2),drop('grimyHerb',1,2,.2),drop('herbSeeds',1,3,.12)]),
 beast('sandscar_archer','bandit','Sandscar archer',25,'Common','archer',{hostile:true,attackType:'arrow',weapon:'oakShortbow',look:{skin:'#9b6748',hair:'Long',hairColor:'#211b18',sex:'female'},gear:['rangerHood2','rangerTunic2','rangerTrousers2','rangerBoots2'],region:'Sandscar hideout',examine:'She never misses twice.'},
  [always('bones'),drop('steelArrows',8,20,.45),drop('moonsilverArrows',3,8,.12),drop('bowString',1,2,.15),drop('weapon:oakShortbow',1,1,.04),rare('weapon:willowShortbow',.012)]),
 beast('frostfang_wolf','wolf','Frostfang wolf',26,'Common','swift',{hostile:true,attackType:'bite',scale:1.12,tint:0xdfe6ea,eyes:0x7fd6ff,region:'Frostfang pass',examine:'The pack leader howls; the pass goes quiet.'},
  [always('bones'),drop('furPelt',1,1,.35),drop('rawMeat',1,2,.4),drop('fur',1,2,.25)]),
 beast('bloodtusk_raider','orc','Bloodtusk raider',28,'Common','brute',{hostile:true,attackType:'slash',weapon:'blacksteelBattleaxe',scale:1.12,look:{skin:'#6b5a3a'},gear:['knightGambeson3','knightSpikedPauldrons3','knightHornedHelm3'],region:'Bloodtusk war camp',examine:'Its tusks are painted with the blood of its last meal.'},
  [always('bones'),drop('ironBar',1,2,.2),drop('leather',1,2,.2),...gear(28,{weapon:'battleaxe'})]),
 beast('grizzled_mauler','bear','Grizzled mauler',28,'Veteran','brute',{hostile:true,attackType:'claw',scale:1.5,tint:0x6e5a48,eyes:0xffc04d,region:'Grizzled woods',examine:'Old, scarred and in no mood to share the berries.'},
  [always('heftyBones'),drop('furPelt',1,2,.6),drop('rawMeat',2,3,.7),drop('trailBerries',2,5,.3)]),
 beast('fenwitch','bandit','Fenwitch',30,'Veteran','caster',{hostile:true,attackType:'magic',weapon:'sapphireStaff',look:{sex:'female',skin:'#9aa784',hair:'Long',hairColor:'#2e3326'},gear:['wizardRobeTop3','wizardRobeBottom3','wizardBracers3'],region:'Gloomfen',examine:'She trades curses for teeth. Mostly yours.'},
  [always('bones'),drop('fireRune',8,20,.4),drop('airRune',8,20,.4),drop('unfinishedPotion',1,1,.12),drop('healingPotion',1,1,.1),drop('weapon:sapphireStaff',1,1,.03),rare('weapon:amethystStaff',.01)]),
 beast('dune_stalker','spider','Dune stalker',30,'Common','tank',{hostile:true,attackType:'venom',scale:1.25,tint:0xa8743d,eyes:0x1d1610,spikes:true,accent:0x5e3d1f,region:'Dune stalker flats',examine:'It waits under the sand for footsteps.'},
  [always('bones'),drop('uncutGem',1,1,.06),drop('goldOre',1,2,.12),drop('thread',2,5,.3)]),
 beast('bloodtusk_shaman','orc','Bloodtusk shaman',32,'Veteran','caster',{hostile:true,attackType:'magic',weapon:'sapphireStaff',scale:1.05,look:{skin:'#6b5a3a'},gear:['wizardRobeTop2','wizardRobeBottom2','knightScarf3'],region:'Bloodtusk war camp',examine:'He reads the future in burning bones.'},
  [always('bones'),drop('fireRune',10,24,.45),drop('runeEssence',3,8,.3),drop('weapon:sapphireStaff',1,1,.04),rare('weapon:amethystStaff',.012)]),
 beast('hoarfrost_wraith','wraith','Hoarfrost wraith',33,'Common','spirit',{hostile:true,attackType:'magic',scale:1.05,tint:0xa9c4d8,eyes:0xe6fbff,region:'Rimeback crags',examine:'Your breath freezes as it passes.'},
  [drop('airRune',8,20,.5),drop('runeEssence',3,8,.35),drop('cutGem',1,1,.03),rare('weapon:sapphireStaff',.01)]),
 beast('cairnbound_knight','skeleton','Cairnbound knight',34,'Veteran','bones',{hostile:true,attackType:'slash',weapon:'moonsilverLongsword',shield:'moonsilverKiteshield',gear:['moonsilverArmet','moonsilverBreastplate','moonsilverGreaves'],region:'Hollowmere cairns',examine:'Sworn to a king long buried. The oath held.'},
  [always('bones'),drop('mithrilOre',1,2,.15),drop('airRune',6,14,.25),...gear(34,{weapon:'longsword',armour:'Breastplate'})]),
 beast('ember_hound','wolf','Ember hound',35,'Common','beast',{hostile:true,attackType:'fire',scale:1.2,tint:0x7a2f22,eyes:0xffb347,breath:0xff6a2a,spikes:true,accent:0x2a1a14,region:'Ember hound run',examine:'Its paw prints smoulder for an hour.'},
  [always('bones'),drop('fireRune',6,16,.4),drop('coal',1,3,.25),drop('hide',1,1,.25)]),
 beast('rimeback_troll','troll','Rimeback troll',36,'Veteran','brute',{hostile:true,attackType:'slam',scale:1.65,tint:0x9fb1bb,eyes:0x7fd6ff,spikes:true,accent:0xe9f6ff,region:'Rimeback crags',examine:'Ice grows on its back like moss.'},
  [always('heftyBones'),drop('coal',2,4,.4),drop('mithrilOre',1,2,.15),drop('furPelt',1,1,.2),rare('weapon:moonsilverHammer',.03)]),
 beast('gloomweb_broodling','spider','Gloomweb broodling',44,'Common','swift',{hostile:true,attackType:'venom',scale:1.15,tint:0x2a2533,eyes:0xd06bff,region:'Gloom hollow',examine:'One of a great many. Its mother is watching.'},
  [always('bones'),drop('thread',3,8,.4),drop('grimyHerb',1,3,.25),drop('uncutGem',1,1,.05)]),
 beast('crypt_warden','skeleton','Crypt warden',45,'Elite','bones',{hostile:true,attackType:'hammer',weapon:'verditeHammer',shield:'verditeHeaterShield',gear:['verditeHornedHelm','verditeBreastplate','verditeGreaves','verditeSabatons'],region:'Hollowmere cairns',examine:'It has stood here so long the floor wore away beneath it.'},
  [always('bones'),drop('adamantOre',1,2,.15),drop('cutGem',1,1,.05),...gear(45,{weapon:'hammer',armour:'Breastplate'})]),
 beast('cragmaw_ogre','ogre','Cragmaw ogre',46,'Veteran','brute',{hostile:true,attackType:'slam',scale:1.8,tint:0x7d7a62,horns:true,accent:0xcfc2a2,region:'Cragmaw heights',examine:'It eats rocks when it cannot find goats.'},
  [always('heftyBones'),drop('coal',3,6,.4),drop('adamantOre',1,1,.12),drop('steelNails',10,25,.2),...gear(46,{weapon:'battleaxe',shield:false})]),
 // ---------------------------------------------------------------- High (55–92)
 beast('basalt_golem','golem','Basalt golem',55,'Veteran','stone',{hostile:true,attackType:'slam',scale:1.6,tint:0x3d3836,eyes:0xff8a3a,accent:0xff6a2a,region:'Cindervault',examine:'Cooled lava that never stopped walking.'},
  [always('coal',2,5),drop('adamantOre',1,2,.3),drop('runiteOre',1,1,.06),drop('fireRune',10,25,.35),drop('cutGem',1,1,.06)]),
 beast('gloam_phantom','revenant','Gloam phantom',58,'Veteran','spirit',{hostile:true,attackType:'magic',scale:1.15,tint:0x343a52,eyes:0xb48cff,region:'Blighted Reach',examine:'A shadow that remembers being a soldier.'},
  [always('bones'),drop('fireRune',12,30,.4),drop('airRune',12,30,.4),drop('runiteOre',1,1,.05),...gear(58,{weapon:'longsword',shield:false})]),
 beast('bloodtusk_berserker','orc','Bloodtusk berserker',58,'Veteran','brute',{hostile:true,attackType:'slash',weapon:'tidesteelBattleaxe',scale:1.25,look:{skin:'#5e4a2e'},gear:['tidesteelHornedHelm','knightGambeson3','tidesteelSpikedPauldrons','tidesteelGauntlets'],region:"Grimtusk's stronghold",examine:'It stopped feeling pain several battles ago.'},
  [always('bones'),drop('runiteBar',1,1,.06),drop('leather',2,3,.25),...gear(58,{weapon:'battleaxe'})]),
 beast('ashmaw_hound','wolf','Ashmaw hound',62,'Veteran','beast',{hostile:true,attackType:'fire',scale:1.4,tint:0x2b1d1a,eyes:0xff5a1f,breath:0xff4a1a,horns:true,spikes:true,accent:0xa83a1c,region:'Cindervault',examine:'Its bark comes out as smoke.'},
  [always('bones'),drop('fireRune',15,35,.45),drop('coal',2,4,.3),...gear(62,{weapon:'scimitar',shield:false,chance:.8})]),
 beast('ashscale_whelp','dragon','Ashscale whelp',64,'Elite','dragon',{hostile:true,attackType:'fire',scale:1.05,tint:0x6b6a68,eyes:0xffd27a,region:'Ashscale scar',examine:'Too young to fly far. Old enough to burn you.'},
  [always('wyrmBones'),drop('runiteBar',1,1,.12),drop('cutGem',1,2,.15),drop('fireRune',20,40,.4),drop(A('tidesteel','Breastplate'),1,1,.04),rare(W('embersteel','longsword'),.01),rare(S('embersteel'),.008)]),
 beast('verdant_whelp','dragon','Verdant whelp',66,'Elite','dragon',{hostile:true,attackType:'fire',scale:1.1,tint:0x3f7a3c,eyes:0xf4ff7a,breath:0xa8f06a,region:'Verdant whelp hollow',examine:'It nests in the canopy and breathes spores.'},
  [always('wyrmBones'),drop('runiteBar',1,1,.12),drop('grimyHerb',2,5,.35),drop('herbSeeds',2,5,.3),drop(W('tidesteel','spear'),1,1,.04),rare(W('embersteel','spear'),.01),rare('weapon:yewShortbow',.012)]),
 beast('glacier_colossus','ogre','Glacier colossus',68,'Elite','tank',{hostile:true,attackType:'slam',scale:2.2,tint:0xb7cbd6,eyes:0x7fd6ff,horns:true,spikes:true,accent:0xeaf7ff,region:'Frostmaw eyrie',examine:'A giant who fell asleep in the snow a thousand years ago.'},
  [always('heftyBones',2,2),drop('runiteOre',1,2,.15),drop('coal',4,8,.4),drop(W('tidesteel','twohand'),1,1,.04),drop(A('tidesteel','Greaves'),1,1,.04),rare(A('embersteel','Greaves'),.01)]),
 beast('umbral_wraith','wraith','Umbral wraith',70,'Veteran','spirit',{hostile:true,attackType:'magic',scale:1.25,tint:0x1f1d2c,eyes:0xd06bff,crown:true,accent:0x7c5bb3,region:'Blighted Reach',examine:'Light bends away from it.'},
  [drop('fireRune',20,45,.5),drop('airRune',20,45,.5),drop('cutGem',1,2,.12),drop('weapon:emberStaff',1,1,.015),rare(A('embersteel','Armet'),.012)]),
 beast('rimescale_whelp','dragon','Rimescale whelp',72,'Elite','dragon',{hostile:true,attackType:'magic',scale:1.15,tint:0x8fb4cc,eyes:0xe6fbff,breath:0x9fdcff,region:'Frostmaw eyrie',examine:'Its breath leaves frost flowers on stone.'},
  [always('wyrmBones'),drop('runiteBar',1,2,.15),drop('cutGem',1,2,.15),drop(A('tidesteel','Armet'),1,1,.05),drop(W('embersteel','dagger'),1,1,.02),rare(A('embersteel','Breastplate'),.01),rare(S('embersteel','Heater'),.008)]),
 beast('cinder_fiend','demon','Cinder fiend',74,'Elite','brute',{hostile:true,attackType:'claw',scale:1.6,tint:0x6e2420,eyes:0xffb347,crown:true,accent:0xffa23a,region:'Cindervault',examine:'Born where the earth cracked and the fire got out.'},
  [always('ashes',2,4),drop('fireRune',30,60,.5),drop('runiteOre',1,2,.15),drop('cutGem',1,2,.12),drop(W('embersteel','scimitar'),1,1,.03),rare(A('embersteel','Gauntlets'),.015),rare('weapon:emberStaff',.01)]),
 beast('dread_knight','skeleton','Dread knight',80,'Elite','bones',{hostile:true,attackType:'slash',weapon:'embersteelTwohand',gear:['embersteelHornedHelm','embersteelBreastplate','embersteelGreaves','embersteelSabatons','embersteelGauntlets','knightScarf3'],eyes:0xff5a1f,region:'Blighted Reach',examine:'Its armour still bears the crest of a kingdom that burned.'},
  [always('bones'),drop('runiteBar',1,2,.15),drop(W('embersteel','twohand'),1,1,.03),drop(A('embersteel','Breastplate'),1,1,.025),drop('embersteelArrows',5,15,.2),rare(W('eldersteel','longsword'),.006),rare(A('eldersteel','Armet'),.006)]),
 beast('runebound_sentinel','golem','Runebound sentinel',82,'Elite','stone',{hostile:true,attackType:'magic',scale:1.75,tint:0x5c6670,eyes:0x7fe8ff,accent:0x7fe8ff,crown:true,region:'Runebound ruins',examine:'The runes carved into it are still being written.'},
  [always('runeEssence',5,10),drop('airRune',30,60,.5),drop('fireRune',30,60,.5),drop('runiteOre',1,3,.2),drop('cutGem',2,3,.12),drop('weapon:emberStaff',1,1,.02),rare(S('eldersteel'),.006)]),
 beast('stonehide_elder','troll','Stonehide elder',88,'Elite','tank',{hostile:true,attackType:'slam',scale:1.95,tint:0x6f7262,eyes:0xffd27a,horns:true,spikes:true,accent:0xb5ad93,region:'Stonehide crag',examine:'The oldest troll in the mountains, and the most patient.'},
  [always('heftyBones',2,3),drop('runiteOre',2,3,.25),drop('coal',5,10,.4),drop(W('embersteel','hammer'),1,1,.03),drop(A('embersteel','Sabatons'),1,1,.03),rare(W('eldersteel','hammer'),.006),rare(A('eldersteel','Greaves'),.006)]),
 beast('duskborn_demon','demon','Duskborn demon',92,'Elite','brute',{hostile:true,attackType:'claw',scale:1.85,tint:0x2c1f33,eyes:0xd06bff,horns:true,crown:true,accent:0x9a6bff,region:'Duskborn rift',examine:'It arrived at sunset and never left.'},
  [always('ashes',3,5),drop('runiteBar',2,3,.2),drop('cutGem',2,3,.15),drop(W('embersteel','longsword'),1,1,.035),drop(A('embersteel','Breastplate'),1,1,.03),rare(W('eldersteel','scimitar'),.007),rare(A('eldersteel','Breastplate'),.005)]),
 // ---------------------------------------------------------------- Bosses (102–120)
 beast('grimtusk','orc','Grimtusk the Unbroken',102,'Boss','brute',{hostile:true,attackType:'slash',weapon:'eldersteelBattleaxe',scale:1.6,look:{skin:'#4f3d27',beard:'Beard'},gear:['eldersteelHornedHelm','eldersteelSpikedPauldrons','knightGambeson3','eldersteelGauntlets','eldersteelGreaves'],aura:0xff5a1f,attackSpeed:3.4,region:"Grimtusk's stronghold",examine:'Warlord of the Bloodtusk clans. Nobody has ever made him kneel.'},
  [always('heftyBones',3,3),always('runiteBar',2,4),drop(W('eldersteel','battleaxe'),1,1,.06),drop(A('eldersteel','HornedHelm'),1,1,.05),drop(A('embersteel','Breastplate'),1,1,.12),drop('cutGem',2,4,.3),rare('weapon:bloodthornBow',.02)]),
 beast('hollow_king','skeleton','The Hollow King',105,'Boss','caster',{hostile:true,attackType:'magic',weapon:'emberStaff',scale:1.35,gear:['nobleCrown3','nobleCoat3','nobleSleeves3','eldersteelGreaves','eldersteelSabatons','knightScarf3'],eyes:0x7fe8ff,aura:0x7fe8ff,attackSpeed:3.6,region:'Hollowmere cairns',examine:'He rules the cairns still. His court never left.'},
  [always('bones',3,3),always('runeEssence',10,20),drop('weapon:emberStaff',1,1,.08),drop(A('eldersteel','Armet'),1,1,.05),drop(S('eldersteel','Heater'),1,1,.05),drop('cutGem',2,4,.3),rare(A('eldersteel','Breastplate'),.02)]),
 beast('gloom_matriarch','spider','The Gloom Matriarch',112,'Boss','tank',{hostile:true,attackType:'venom',scale:2.7,tint:0x1d1824,eyes:0xd06bff,spikes:true,crown:true,accent:0x6e4aa8,aura:0x9a6bff,attackSpeed:3.4,roam:3,region:'Gloom hollow',examine:'Mother of every web in the Gloom. She has been expecting you.'},
  [always('bones',4,4),always('thread',20,40),drop('grimyHerb',5,10,.5),drop('cutGem',3,5,.35),drop(W('eldersteel','dagger'),1,1,.07),drop(A('eldersteel','Gauntlets'),1,1,.05),rare('weapon:yewShortbow',.05),rare(A('eldersteel','Sabatons'),.03)]),
 beast('frostmaw','dragon','Frostmaw, the Glacier Wyrm',115,'Boss','dragon',{hostile:true,attackType:'magic',scale:2.4,tint:0x9cc4dc,eyes:0xe6fbff,breath:0x9fdcff,aura:0x9fdcff,attackSpeed:4.4,roam:3,region:'Frostmaw eyrie',examine:'The mountain had a heartbeat once. This is it.'},
  [always('wyrmBones',3,3),always('runiteBar',3,5),drop(W('eldersteel','longsword'),1,1,.06),drop(A('eldersteel','Breastplate'),1,1,.04),drop(S('eldersteel'),1,1,.05),drop('cutGem',3,5,.4),rare(W('eldersteel','twohand'),.025)]),
 beast('ashen_colossus','golem','The Ashen Colossus',120,'Legendary','stone',{hostile:true,attackType:'slam',scale:2.6,tint:0x2e2a28,eyes:0xff6a1a,accent:0xff6a1a,crown:true,aura:0xff6a1a,attackSpeed:4.6,roam:3,region:'Cindervault',examine:'The forge-god of a people who no longer exist. It is still working.'},
  [always('coal',10,20),always('runiteBar',4,6),drop(W('eldersteel','hammer'),1,1,.07),drop(W('eldersteel','twohand'),1,1,.05),drop(A('eldersteel','Breastplate'),1,1,.05),drop('cutGem',4,6,.45),rare('weapon:bloodthornBow',.03)])
];
// Ranged/magic monsters keep their distance a little longer between attacks.
for(const [,b] of R)if(['arrow','magic'].includes(b.attackType)&&!b.attackSpeed)b.attackSpeed=2.8;
export const rosterBeasts=Object.fromEntries(R);
export const ROSTER_KEYS=Object.keys(rosterBeasts);

// Regions shown in the bestiary and on the spawn map (centre, label, level band).
export const ROSTER_REGIONS={
 'Kingsroad meadows':{x:-235,z:-185,band:'2–4'},'Royal Heartlands ruins':{x:-120,z:-180,band:'3–9'},'Royal Heartlands mounds':{x:-120,z:-180,band:'9'},'Birchford meadows':{x:-215,z:45,band:'2'},'Thornwood edge':{x:-330,z:40,band:'5'},
 'Willow fen':{x:-115,z:255,band:'5–7'},'Birchford wayside':{x:-110,z:150,band:'7'},'Winterwatch outskirts':{x:300,z:-195,band:'3–5'},'Emberspire scrubland':{x:185,z:135,band:'6–8'},
 'Cairn hollow':{x:-60,z:-120,band:'13'},'Brigand thicket':{x:-60,z:205,band:'15'},'Bramble dell':{x:-160,z:330,band:'12'},
 'Tuskgob warren':{x:-60,z:330,band:'4–17'},'Gloomfen':{x:-270,z:300,band:'18–30 · slayer swamp'},'Bloodtusk war camp':{x:80,z:-65,band:'28–32'},'Frostfang pass':{x:60,z:-250,band:'19–26'},
 'Rimeback crags':{x:300,z:-330,band:'33–36'},'Cragmaw heights':{x:350,z:-175,band:'46'},'Hollowmere cairns':{x:-100,z:-385,band:'34–105 · slayer crypt'},'Sandscar hideout':{x:70,z:120,band:'22–25'},
 'Cinderwing roost':{x:120,z:330,band:'18'},'Dune stalker flats':{x:200,z:385,band:'30'},'Ember hound run':{x:335,z:255,band:'35'},'Grizzled woods':{x:-375,z:200,band:'28'},
 'Cindervault':{x:385,z:40,band:'55–120 · slayer fire pits'},'Blighted Reach':{x:-130,z:-400,band:'58–80 · wilderness'},'Frostmaw eyrie':{x:370,z:-390,band:'68–115'},'Verdant whelp hollow':{x:-385,z:395,band:'66'},
 'Ashscale scar':{x:100,z:395,band:'64'},'Runebound ruins':{x:-30,z:-300,band:'82'},'Stonehide crag':{x:200,z:-395,band:'88'},'Duskborn rift':{x:290,z:395,band:'92'},
 "Grimtusk's stronghold":{x:330,z:-30,band:'58–102'},'Gloom hollow':{x:-250,z:395,band:'44–112'}
};
