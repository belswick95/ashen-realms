// Exploration content (Round 3, R3-K): discoverable places, hidden areas and new regions (built on the
// underground/area engine), lore objects, treasure-hunt clue steps and reward caskets, collectable
// keepsakes and milestone rewards. Everything here is original Eldervale content.
//
// This file is the source of truth: scripts/build-explore-sql.mjs turns it into db/explore-2-content.sql
// and db/explore-3-clues.sql; explore.js (client) and admin-explore.js (Game console) read it too.
// The server keeps its own copy per row in eldervale_private.explore_defs, so owner edits made in the
// console win over this file (rows saved from the console carry owner_edited=true and are never
// overwritten by a re-run).
//
// Coordinate plan (documented in docs/exploration.md):
//  * Overworld: everything inside ±420, placed on walkable land (tests check landscape.canWalk).
//  * Explore areas use the underground plane at z = 4250 (rooms within ±130 of the origin, so every
//    tile stays below the world limit of 4500), x = 1200…4200 in steps of 600. Nothing else uses
//    z ≥ 3800: R2-G caves sit at z 1200 (+400 per level), R3-I lairs at x 1200–4200 / z 1200–2625,
//    R3-J arenas at x 1400–3800 / z 3000–3400.
import {passageLook,ARRIVAL_OFFSET} from './underground-data.js?v=release-20261107-quests162';
export const EXPLORE_BLUEPRINT='explore-v1';
export const AREA_Z=4250,AREA_XS=[1200,1800,2400,3000,3600,4200];
export const TIERS=['easy','medium','hard'];
export const TIER_LABEL={easy:'Easy',medium:'Medium',hard:'Hard'};
export const STEP_TYPES={dig:'Riddle — dig',map:'Map fragment — dig',bearing:'Bearing — dig',emote:'Emote at a place',talk:'Talk to someone',crate:'Search a crate'};
export const EMOTES={wave:'Wave',bow:'Bow',cheer:'Cheer',think:'Think',dance:'Dance',clap:'Clap',kneel:'Kneel',shrug:'Shrug'};
export const LORE_MODELS={lore_statue:'Weathered statue',lore_tablet:'Inscribed tablet',lore_grave:'Old grave',lore_journal:'Forgotten journal',lore_carving:'Carved standing stone',lore_shrine:'Wayside shrine'};
export const ENTRANCE_MODELS={waterfall_curtain:'Waterfall',thorn_thicket:'Thorn thicket',sea_cave:'Sea cave',shrine_door:'Sealed shrine door',ferry_boat:'Rowing boat',cliff_path:'Cliff path'};
export const ENTRANCE_VERBS={waterfall_curtain:'Step behind',thorn_thicket:'Squeeze into',sea_cave:'Wade into',shrine_door:'Push open',ferry_boat:'Board',cliff_path:'Climb'};
export const CRATE_TEMPLATE='explore_crate';
export const DIG_RADIUS=3,EMOTE_RADIUS=6,READ_RANGE=4.5,TALK_RANGE=6,SEARCH_RANGE=3.5;

// ------------------------------------------------------------------------------------------- items
// Catalog rows (item:<id>). Clue scrolls and caskets are one per tier; keepsakes are tradeable
// collectibles (shown in the Treasure log; not worn).
const clue=(tier,name,desc)=>({name,description:desc,icon:'clue',category:'Treasure',tier,kind:'clue',buy:0,sell:0,stackable:false});
const casket=(tier,name,desc)=>({name,description:desc,icon:'casket',category:'Treasure',tier,kind:'casket',buy:0,sell:0,stackable:false});
const keep=(name,desc,icon,rarity,sell)=>({name,description:desc,icon,category:'Keepsakes',kind:'keepsake',rarity,buy:sell*3,sell,stackable:false});
export const ITEMS={
 clueEasy:clue('easy','Weathered clue scroll','A scrap of oilcloth, folded twice. Someone wanted you to find this — and then to keep walking.'),
 clueMedium:clue('medium','Sealed clue scroll','Wax-sealed with a thumbprint instead of a crest. The wax is still faintly warm.'),
 clueHard:clue('hard','Gilt-edged clue scroll','Gold leaf on the edges, ink that shifts in the light. Whoever wrote this did not expect you to finish.'),
 casketEasy:casket('easy','Wayfarer’s casket','A small iron-bound box. It rattles encouragingly.'),
 casketMedium:casket('medium','Cartographer’s casket','Brass corners, a compass-rose lid. Heavier than it looks.'),
 casketHard:casket('hard','Gilded reliquary casket','Lacquered black and gold. It hums when you hold it near your ear.'),
 keepsakeCompass:keep('Brass pathfinder’s compass','The needle points not north but toward the nearest unread story.','compass','easy',40),
 keepsakeQuill:keep('Gull-feather quill','Cut from a Saltglass gull feather; writes a little to the left of where you aim.','quill','easy',30),
 keepsakePebble:keep('Painted Moonmere pebble','A smooth lake stone painted with a crescent. Fishers swap them for luck.','pebble','easy',25),
 keepsakeLantern:keep('Tallow lantern charm','A thumb-sized lantern on a ribbon. Its tiny wick never quite goes out.','lantern','easy',45),
 keepsakeBottleShip:keep('Saltglass bottle-ship','A two-master inside a green bottle. The sails are labelled with tiny, rude words.','bottle','medium',120),
 keepsakePennant:keep('Moth-silk pennant','A pennant spun by the grey moths of Thornveil. It moves when there is no wind.','banner','medium',140),
 keepsakeSnowglobe:keep('Rimefrost snow-globe','A Winterwatch souvenir. Shake it and the little watchtower is buried every time.','globe','medium',110),
 keepsakeHourglass:keep('Ember-glass hourglass','Sand from the Emberspire kilns. It runs upward on cold days.','hourglass','hard',380),
 keepsakeStarchart:keep('Starchart of the Quiet Lamp','A sky-map with one star too many, inked in silver.','chart','hard',420),
 keepsakeBrooch:keep('Gilded cartographer’s brooch','A compass-rose brooch with a tiny hinged lid. Inside: a map of the brooch.','brooch','hard',450),
 keepsakeCirclet:keep('Veilfall pearl circlet','Pearls from the pool behind the falls, strung on silver wire. Rare and very much admired.','circlet','rare',2500),
 keepsakeWandererLantern:keep('The Wanderer’s Lantern','An old brass lantern that throws the shadows of places you have not been yet.','lantern','rare',3000),
 keepsakeTidePin:keep('Cloak-pin of the Seventh Tide','A silver pin shaped like a wave that never breaks. Smugglers would sell their boats for it.','brooch','rare',2800)
};
export const CLUE_ITEM={easy:'clueEasy',medium:'clueMedium',hard:'clueHard'},CASKET_ITEM={easy:'casketEasy',medium:'casketMedium',hard:'casketHard'};
export const KEEPSAKES=Object.keys(ITEMS).filter(k=>ITEMS[k].kind==='keepsake');

// ------------------------------------------------------------------------------------- settings
// Owner-tunable (Game console › World › Exploration › Settings); stored in game_settings 'explore'.
export const DEFAULT_SETTINGS={
 enabled:true,
 // Tertiary clue drops: the monster's level picks the tier (OSRS-style rates, design-patterns §8).
 clueDrops:{easy:{chance:'1/128',minLevel:1,maxLevel:30},medium:{chance:'1/128',minLevel:25,maxLevel:70},hard:{chance:'1/256',minLevel:60,maxLevel:999}},
 steps:{easy:[2,3],medium:[3,5],hard:[4,6]},
 milestones:{
  lore:[{at:5,amount:500},{at:10,amount:1500},{at:15,amount:3000},{at:20,amount:5000},{at:31,amount:12000,title:'Loremaster'}],
  place:[{at:5,amount:500},{at:10,amount:1500},{at:20,amount:4000},{at:29,amount:8000,title:'Wayfinder'}],
  clue:[{at:1,amount:750},{at:10,amount:3000,title:'Treasure Seeker'},{at:25,amount:8000},{at:50,amount:15000,title:'Master of Riddles'}]
 }
};

// ------------------------------------------------------------------------------- explore areas
// Underground-engine area definitions (eldervale_private.underground_areas). `explore` marks them as
// owned by this system (no overworld `entrances`: the entrance and way out are explore objects);
// `outdoor` makes underground.js keep the sky and paint grass/sand/sea instead of rock walls.
const room=(id,x,z,rx,rz)=>({id,x,z,rx,rz}),tunnel=(width,...points)=>({width,points});
const area=(id,name,theme,ix,band,blurb,outdoor,levels,spawns,lights)=>({id,name,theme,band,origin:{x:AREA_XS[ix],z:AREA_Z},enabled:true,blurb,explore:true,...(outdoor?{outdoor}:{}),levels,entrances:[],links:[],spawns,lights,seed:EXPLORE_BLUEPRINT});
export const AREAS=[
 area('veilfall_grotto','Veilfall Grotto','earth',0,[1,25],'A dry grotto behind the Veilfall, lit by crystals that drink the spray. Older than the river.',null,
  [{level:0,name:'Behind the falls',rooms:[room('entry',0,0,6,5),room('pool',20,6,10,8),room('gallery',42,-4,9,7),room('ledge',30,-26,7,6)],tunnels:[tunnel(3,[0,0],[20,6]),tunnel(3,[20,6],[42,-4])]}],
  [{id:'bats',roster:'dusk_bat',count:3,level:0,room:'gallery'}],
  [{level:0,x:3,z:-3,kind:'crystal'},{level:0,x:20,z:13,kind:'crystal'},{level:0,x:14,z:2,kind:'fungus'},{level:0,x:44,z:2,kind:'crystal'},{level:0,x:30,z:-31,kind:'crystal'}]),
 area('thornveil_grove','Thornveil Grove','earth',1,[1,30],'A glade sealed inside a ring of thorns, where grey moths spin silk and an old spring still runs clear.',{style:'grove',ground:0x5d7a3a,groundAlt:0x6f8c45,wall:0x2f4a22,wallAlt:0x3d5c2a},
  [{level:0,name:'The glade',rooms:[room('gate',0,0,5,5),room('glade',24,0,14,11),room('spring',52,10,8,7),room('heart',40,-26,8,7)],tunnels:[tunnel(3,[0,0],[24,0]),tunnel(3.4,[24,0],[52,10])]}],
  [],
  [{level:0,x:52,z:16,kind:'fungus'},{level:0,x:40,z:-30,kind:'crystal'}]),
 area('brinehook_cove','Brinehook Cove','earth',2,[10,30],'A smugglers’ cove under the Saltglass cliffs. The tide brings boats in at night; the smugglers would rather it did not bring you.',null,
  [{level:0,name:'The cove',rooms:[room('mouth',0,0,6,5),room('quay',24,4,12,8),room('stash',48,-6,9,7),room('inlet',30,30,8,6)],tunnels:[tunnel(3,[0,0],[24,4]),tunnel(3,[24,4],[48,-6])]}],
  [{id:'smugglers',roster:'hedge_brigand',count:3,level:0,room:'quay'},{id:'lookouts',roster:'wayside_footpad',count:3,level:0,room:'stash'}],
  [{level:0,x:3,z:-3,kind:'torch'},{level:0,x:24,z:11,kind:'torch'},{level:0,x:48,z:0,kind:'brazier'},{level:0,x:30,z:35,kind:'fungus'}]),
 area('quiet_lamp_shrine','Shrine of the Quiet Lamp','crypt',3,[10,25],'A forgotten shrine under the Heartlands ruins, where the old keepers tended a lamp that was never allowed to go out.',null,
  [{level:0,name:'The lamp hall',rooms:[room('stair',0,0,6,5),room('nave',22,0,10,7),room('sanctum',46,0,9,8)],tunnels:[tunnel(3,[0,0],[22,0]),tunnel(3,[22,0],[46,0])]}],
  [{id:'keepers',roster:'cairn_skeleton',count:3,level:0,room:'nave'}],
  [{level:0,x:3,z:-3,kind:'torch'},{level:0,x:22,z:6,kind:'brazier'},{level:0,x:46,z:6,kind:'brazier'},{level:0,x:52,z:-4,kind:'crystal'}]),
 area('gullwing_isle','Gullwing Isle','earth',4,[5,30],'A windswept island off Saltglass Bay: a broken lighthouse, a wrecked smuggler’s sloop and beaches full of things with claws.',{style:'isle',ground:0xcdb886,groundAlt:0x9fae6a,wall:0x2f6f8f,wallAlt:0x3f86a6},
  [{level:0,name:'Gullwing Isle',rooms:[room('landing',0,0,7,6),room('beach',18,10,14,9),room('dunes',38,-6,13,10),room('lighthouse',58,-22,8,7),room('wreck',52,18,10,7)],
    tunnels:[tunnel(5,[0,0],[18,10]),tunnel(5,[18,10],[38,-6]),tunnel(4,[38,-6],[58,-22]),tunnel(4.5,[38,-6],[52,18])]}],
  [{id:'scuttlers',roster:'sand_scuttler',count:4,level:0,room:'beach'},{id:'wights',roster:'marsh_wight',count:3,level:0,room:'wreck'}],
  [{level:0,x:58,z:-26,kind:'brazier'}]),
 area('stormcrown_plateau','Stormcrown Plateau','earth',5,[25,60],'A high plateau above the Cragmaw heights. Wolves hunt the meadow, trolls fish the tarn and the old storm-cairn still stands.',{style:'plateau',ground:0x6b7a52,groundAlt:0x7f8a62,wall:0x6c6a66,wallAlt:0x8a8780},
  [{level:0,name:'Stormcrown Plateau',rooms:[room('top',0,0,6,5),room('meadow',22,6,13,10),room('tarn',46,-8,10,8),room('crown',60,20,9,8),room('scree',30,-28,8,6)],
    tunnels:[tunnel(4,[0,0],[22,6]),tunnel(4,[22,6],[46,-8]),tunnel(3.6,[46,-8],[60,20])]}],
  [{id:'wolves',roster:'frostfang_wolf',count:4,level:0,room:'meadow'},{id:'trolls',roster:'rimeback_troll',count:2,level:0,room:'tarn'},{id:'ogres',roster:'cragmaw_ogre',count:2,level:0,room:'crown'}],
  [])
];
export const areaById=id=>AREAS.find(a=>a.id===id);
export const areaPoint=(id,x,z)=>{const a=areaById(id);return {x:a.origin.x+x,z:a.origin.z+z}};

// ---------------------------------------------------------------------------------------- places
// type: town|landmark (overworld circle), cave (an engine area), hidden (explore area behind a
// discoverable entrance), region (new explorable area). Discovering a place: being inside it.
// Hidden places and regions carry `entrance` (overworld object) and `inside` (arrival, local x/z).
const town=(id,name,x,z,radius,blurb)=>({id,name,type:'town',x,z,radius,blurb});
const mark=(id,name,x,z,radius,blurb)=>({id,name,type:'landmark',x,z,radius,blurb});
const cave=(id,name,areaId,blurb)=>({id,name,type:'cave',area:areaId,blurb});
export const PLACES=[
 town('birchford','Birchford',-234,126,30,'The river city of House Varrow: markets, guilds and a keep full of candles.'),
 town('eldervale_castle','Eldervale Castle',-340,-300,40,'Seat of King Oswin, where every new adventurer starts.'),
 town('winterwatch','Winterwatch',217,-244,28,'The frontier town that keeps the north road open.'),
 town('emberspire','Emberspire',257,213,28,'Kiln-town of the south, warm in every season.'),
 town('saltglass_bay','Saltglass Bay',300,348,26,'Nets, gulls and a pier that has outlived three harbourmasters.'),
 mark('moonmere','Moonmere Lake',-91,80,30,'A still lake where the Silverwater rests before Birchford.'),
 mark('silverfin_lake','Silverfin Lake',157,77,34,'The great lake of the middle lands.'),
 mark('greenwatch_pond','Greenwatch Pond',244,175,20,'A reedy pond on the Emberspire road.'),
 mark('willow_fen','Willow fen',-115,255,30,'Soft ground, willow roots and things that bite at dusk.'),
 mark('heron_brook','Heron Brook',150,349,22,'A clear brook with a log across it — if you trust logs.'),
 mark('thornwood_edge','Thornwood edge',-330,40,30,'Where the farmland gives up and the old wood begins.'),
 mark('wayfarer_camp','Wayfarers’ camp',-310,-150,22,'Tents, a cooking pot and the best stories on the Kingsroad.'),
 mark('old_tams_hut','Old Tam’s hut',-335,-10,18,'A fisherman’s hut that has been “about to fall down” for forty years.'),
 mark('heartlands_ruins','Royal Heartlands ruins',-120,-180,30,'Broken walls of a town nobody admits to remembering.'),
 mark('cairn_hollow','Cairn hollow',-60,-120,24,'A dip in the moor ringed with stacked stones.'),
 mark('frostfang_pass','Frostfang pass',60,-250,30,'The cold road north, watched by wolves.'),
 mark('rimeback_crags','Rimeback crags',300,-330,32,'Ice-bitten rocks where trolls grow moss of frost.'),
 mark('emberspire_scrub','Emberspire scrubland',185,135,30,'Dry heath, thornbrush and the old kiln road.'),
 mark('hollowmere_cairns','Hollowmere cairns',-100,-385,30,'Cairns over a crypt that was not built to keep people out.'),
 mark('bloodtusk_camp','Bloodtusk war camp',80,-65,24,'Smoke, drums and orcs who do not like visitors.'),
 cave('birchroot_hollow','Birchroot Hollow','birchroot_hollow','Roots of the birch wood above an underground stream.'),
 cave('hollowmere_undercroft','Hollowmere Undercroft','hollowmere_undercroft','The Hollow King’s court below the cairns.'),
 cave('cindervault_depths','Cindervault Depths','cindervault_depths','The fire under Cindervault that never went out.'),
 {id:'veilfall_grotto',name:'Veilfall Grotto',type:'hidden',area:'veilfall_grotto',blurb:'Behind the waterfall on the Westmere Run.',
  entrance:{model:'waterfall_curtain',name:'The Veilfall',x:-170,z:-300,yaw:0,requires:{}},inside:{x:2,z:0},exitModel:'cave_exit',hint:'The falls on the Westmere Run sound hollow behind the water.'},
 {id:'thornveil_grove',name:'Thornveil Grove',type:'hidden',area:'thornveil_grove',blurb:'A glade sealed inside a ring of thorns near Bramble dell.',
  entrance:{model:'thorn_thicket',name:'Thornveil thicket',x:-160,z:330,yaw:90,requires:{agility:28}},inside:{x:2,z:0},exitModel:'thorn_thicket',hint:'Grey moths drift out of a thicket in Bramble dell. Something in there is not thorns.'},
 {id:'brinehook_cove',name:'Brinehook Cove',type:'hidden',area:'brinehook_cove',blurb:'A smugglers’ cove east of Saltglass pier.',
  entrance:{model:'sea_cave',name:'Brinehook sea cave',x:350,z:385,yaw:180,requires:{}},inside:{x:2,z:0},exitModel:'cave_exit',hint:'At low tide, a dark gap opens in the rocks east of the pier.'},
 {id:'quiet_lamp_shrine',name:'Shrine of the Quiet Lamp',type:'hidden',area:'quiet_lamp_shrine',blurb:'A forgotten shrine under the Royal Heartlands ruins.',
  entrance:{model:'shrine_door',name:'Sealed shrine door',x:-112,z:-170,yaw:270,requires:{lore:'heartlands_tablet',lockedText:'The door will not move. The tablet in the ruins might explain why.'}},inside:{x:2,z:0},exitModel:'stairs_up',hint:'A door with no handle stands in the Heartlands ruins.'},
 {id:'gullwing_isle',name:'Gullwing Isle',type:'region',area:'gullwing_isle',blurb:'An island off Saltglass Bay, reached by rowing boat from the pier.',
  entrance:{model:'ferry_boat',name:'Rowing boat to Gullwing Isle',x:306,z:376,yaw:180,requires:{}},inside:{x:2,z:0},exitModel:'ferry_boat',exitName:'Rowing boat to Saltglass pier',hint:'Wenna Saltglass keeps a rowing boat tied at the end of the pier.'},
 {id:'stormcrown_plateau',name:'Stormcrown Plateau',type:'region',area:'stormcrown_plateau',blurb:'A high plateau above the Cragmaw heights, reached by a cliff path.',
  entrance:{model:'cliff_path',name:'Stormcrown cliff path',x:340,z:-150,yaw:0,requires:{agility:40}},inside:{x:2,z:0},exitModel:'cliff_path',exitName:'Cliff path down',hint:'A goat track climbs the cliffs above the Cragmaw heights.'}
];
export const placeById=id=>PLACES.find(p=>p.id===id);
DEFAULT_SETTINGS.milestones.place[DEFAULT_SETTINGS.milestones.place.length-1].at=PLACES.length;
// Overworld point in front of an entrance (where the way out puts you); same arithmetic as the SQL.
// A trapdoor puts you one tile from the hatch (OSRS style); natural ways in keep their 3.2 clearance.
export const entranceOffset=model=>passageLook(model)==='trapdoor'?ARRIVAL_OFFSET:3.2;
export const exitOffset=model=>passageLook(model||'cave_exit')==='ladder_up'?ARRIVAL_OFFSET:3.5;
export const entranceFront=e=>{const a=(e.yaw||0)*Math.PI/180,r=entranceOffset(e.model);return {x:Math.round((e.x+Math.sin(a)*r)*10)/10,z:Math.round((e.z+Math.cos(a)*r)*10)/10}};
// The two passage objects of a hidden place/region (entrance outside, way out inside).
export function placePassages(p){
 const a=areaById(p.area);if(!a||!p.entrance)return [];const e=p.entrance,front=entranceFront(e),inside=areaPoint(a.id,p.inside.x,p.inside.z);
 const req={...(e.requires||{})};
 return [
  {key:'entrance',template:e.model,name:e.name,x:e.x,z:e.z,yaw:e.yaw||0,passage:{area:a.id,dest:[inside.x,inside.z],requires:req,depth:0,place:p.id}},
  {key:'exit',template:p.exitModel||'cave_exit',name:p.exitName||('Way out to '+e.name),x:inside.x-exitOffset(p.exitModel),z:inside.z,yaw:90,passage:{area:a.id,dest:[front.x,front.z],depth:-1,place:p.id}}
 ];
}

// ------------------------------------------------------------------------------------- lore
// 31 readable objects. `area` objects use local x/z of that explore area.
const lore=(id,name,model,region,x,z,yaw,text,extra={})=>({id,name,model,region,x,z,yaw,text,...extra});
export const LORE=[
 lore('birchford_founding','Founding stone of Birchford','lore_tablet','Birchford',-241,121,30,'“Here the first Varrow drove a birch stake into the riverbank and said: a town, here, because the fish are stupid.” Under it, smaller, a later hand: “The fish have since learned.”'),
 lore('oswin_plinth','Plinth of King Oswin the Builder','lore_carving','Birchford',-222,170,180,'The plinth lists every bridge Oswin the Builder raised. The last line is chiselled and then filled in again with mortar, as if someone changed their mind about a bridge.'),
 lore('lamplighter_ledger','Lamplighter’s ledger','lore_journal','Birchford',-172,186,200,'Night 412: Lamp on Crown Way burnt green again. Third time this month. The candle-stewards at the keep say it is my oil. My oil says it is their candles.'),
 lore('candle_steward_grave','Grave of a candle-steward','lore_grave','Birchford',-266,92,0,'“Hesk Varrow, candle-steward. She lit four thousand candles for the house and asked for none at her grave.” Someone has left one anyway, pressed into the moss.'),
 lore('heron_marker','Heron Brook marker','lore_carving','Heron Brook',142,343,90,'A heron is carved above a line of tally marks — one for every traveller who fell off the log. The tally is long. The heron looks smug.'),
 lore('moonmere_shrine','Moonmere wayside shrine','lore_shrine','Moonmere Lake',-75,98,200,'Fishers leave painted pebbles here before they cast. The oldest is painted with a crescent and the words “for the one under the water, who lets us keep what we catch.”'),
 lore('silverfin_journal','A wet journal','lore_journal','Silverfin Lake',157,100,0,'…the Silverfin does not freeze, not even in the Long Winter my grandmother spoke of. She said the lake remembers being warm. I said lakes do not remember things. She said, “Not to you.”'),
 lore('kingsroad_milestone','Kingsroad milestone','lore_carving','Kingsroad meadows',-235,-185,45,'CASTLE — 4 LEAGUES. BIRCHFORD — 9 LEAGUES. Below, scratched: WINTERWATCH — TOO FAR. Below that, in a child’s hand: EMBERSPIRE — WARM.'),
 lore('heartlands_tablet','Tablet in the Heartlands ruins','lore_tablet','Royal Heartlands ruins',-120,-180,90,'“Under the old hall the keepers tend the Quiet Lamp. The door knows the hand that has read this stone. Go softly; the lamp does not like loud feet.”'),
 lore('cairn_hollow_grave','The empty cairn','lore_grave','Cairn hollow',-60,-120,0,'“Here lies no one. We built it in case.” The stones are newer than the words.'),
 lore('castle_gate_tablet','Gate tablet of Eldervale Castle','lore_tablet','Eldervale Castle',-330,-236,180,'“Every road in Eldervale begins at this gate,” the tablet says. Under it a trainee has added: “and every blister.”'),
 lore('winterwatch_frost_tablet','Frost-cracked tablet','lore_tablet','Winterwatch',209,-252,0,'A list of winters, each with a word: Hard. Hard. Mild. Hard. LONG. The last word is cut so deep the tablet cracked through it.'),
 lore('frostfang_cairn','Wolf-warden’s cairn','lore_grave','Frostfang pass',60,-250,180,'“Ryn, who walked the pass forty winters and was never once bitten. The wolves came to his burial. They sat at the edge of the firelight and did not howl.”'),
 lore('pale_shepherd_carving','Carving of the Pale Shepherd','lore_carving','Rimeback crags',299,-328,200,'A tall figure with a crook leads a line of sheep into a cave mouth. The sheep are carved with great care. The shepherd has no face at all.'),
 lore('emberspire_kiln_statue','Statue of the first Emberwright','lore_statue','Emberspire',243,203,90,'The Emberwright holds out a brick as if offering it to the town. The plaque reads: “She paid for the first kiln with a promise. Emberspire is still paying.”'),
 lore('emberwright_ledger','Debt ledger, scorched','lore_journal','Emberspire scrubland',185,135,0,'Owed: one fire, kept burning, for as long as the town stands. Paid: every year, on the coldest night. Witness: (the name is burnt away). Interest: unclear.'),
 lore('cinderwing_carving','Cinderwing roost stone','lore_carving','Cinderwing roost',120,330,270,'Bats are carved around the stone, every one with a tiny flame for an eye. A note tucked into a crack: “Do NOT bring torches. They think it is a party.”'),
 lore('drowned_bell_tablet','Tablet of the drowned bell','lore_tablet','Saltglass Bay',312,356,180,'“Old Corrow stood where the bay is now. When the sea took it, the chapel bell kept ringing for a year from under the water. Then it stopped. Then, on stormy nights, it started again.”'),
 lore('old_corrow_grave','Grave of Old Corrow’s last mayor','lore_grave','Dune stalker flats',200,385,0,'“Mayor Ebbe Calloway, who refused to leave Old Corrow and so, technically, never did.”'),
 lore('willow_fen_journal','Fen-walker’s notes','lore_journal','Willow fen',-115,255,90,'Rule one: the ground is lying. Rule two: the lights are lying. Rule three: if the willow moves and there is no wind, you are lying to yourself about rule two.'),
 lore('gloomfen_statue','Statue with a veiled face','lore_statue','Gloomfen',-250,280,0,'A woman in a veil, holding a jar. The jar is full of rainwater and very small spiders. Nobody remembers who she was; everyone in Birchford knows not to empty the jar.'),
 lore('thornwood_carving','Boundary stone of the Thornwood','lore_carving','Thornwood edge',-330,40,90,'On one side: “FARMLAND — HOUSE VARROW.” On the other side, facing the wood, much older: “WE WERE HERE FIRST. MIND YOUR FENCES.”'),
 lore('bloodtusk_war_tablet','Bloodtusk war-tablet','lore_tablet','Bloodtusk war camp',100,-80,270,'Tusk-marks count the battles of the Bloodtusk clan. The last mark is not a tusk but a broken axe, and every orc who passes it spits.'),
 lore('runebound_tablet','Runebound warning stone','lore_tablet','Runebound ruins',-30,-300,0,'Runes cover the stone. The few you can read say only: “IT IS NOT GUARDING THE RUINS. THE RUINS ARE GUARDING IT.”'),
 lore('sandscar_journal','Raider’s diary','lore_journal','Sandscar hideout',70,120,180,'Day 9: Captain says we rob only the rich. Day 10: Captain says everyone is rich compared to us. Day 11: robbed a goat.'),
 lore('veilfall_mural','Mural behind the Veilfall','lore_statue','Veilfall Grotto',44,0,270,'Painted in crystal-dust: a river flowing uphill into the sky, and people walking up it carrying lanterns. Under it: “When the falls run backward, follow them.”',{area:'veilfall_grotto'}),
 lore('thornveil_moth_shrine','Moth-silk shrine','lore_shrine','Thornveil Grove',40,-26,180,'Grey moths sleep on a little stone shrine wrapped in silk. Carved underneath: “We sealed the grove so the moths could finish their weaving. They have not finished. They never will. That is the point.”',{area:'thornveil_grove'}),
 lore('smugglers_ledger','Smugglers’ ledger','lore_journal','Brinehook Cove',46,-10,0,'Brandy — 12 casks — Winterwatch (for the cold). Lamp oil — 30 jars — Birchford (for the candle-stewards, who must NOT know it is ours). Clue scrolls — 4 — “for the riddle-folk, who pay in gold and ask no questions.”',{area:'brinehook_cove'}),
 lore('quiet_lamp_tablet','The keepers’ last tablet','lore_tablet','Shrine of the Quiet Lamp',48,0,270,'“We tended the lamp for nine hundred years. It never once needed oil. On the last night we understood: it was never we who kept the lamp alight.”',{area:'quiet_lamp_shrine'}),
 lore('gullwing_keeper_log','Lighthouse keeper’s log','lore_journal','Gullwing Isle',56,-18,0,'Fog. Gulls. Fog. A sloop ran on the rocks with no lamp lit — smugglers, so I let the lamp go out too. Fog. Gulls. Someone keeps leaving riddles in the wreck. I did not write them.',{area:'gullwing_isle'}),
 lore('stormcrown_cairn','The Stormcrown cairn','lore_carving','Stormcrown Plateau',60,20,90,'Climbers add a stone and say a name. The cairn is taller than a troll and has never once been struck by the storms that strike everything else up here.',{area:'stormcrown_plateau'})
];
export const loreById=id=>LORE.find(l=>l.id===id);
// The last lore milestone is "every object".
DEFAULT_SETTINGS.milestones.lore[DEFAULT_SETTINGS.milestones.lore.length-1].at=LORE.length;
export const lorePoint=l=>l.area?areaPoint(l.area,l.x,l.z):{x:l.x,z:l.z};

// ------------------------------------------------------------------------------------ crates
const crate=(id,name,x,z,yaw,extra={})=>({id,name,x,z,yaw,...extra});
export const CRATES=[
 crate('saltglass_loft','Net-loft crate',318,330,20),
 crate('wayfarer_supplies','Wayfarers’ supply crate',-306,-154,70),
 crate('winterwatch_market','Winterwatch market crate',199,-235,0),
 crate('emberspire_market','Emberspire market crate',278,224,45),
 crate('old_tam_tackle','Old Tam’s tackle crate',-330,-15,10),
 crate('castle_gate_stores','Gatehouse stores crate',-345,-234,0),
 crate('cove_stash','Smugglers’ stash crate',52,-8,30,{area:'brinehook_cove'}),
 crate('isle_wreck','Wreck cargo crate',54,20,60,{area:'gullwing_isle'})
];
export const crateById=id=>CRATES.find(c=>c.id===id);
export const cratePoint=c=>c.area?areaPoint(c.area,c.x,c.z):{x:c.x,z:c.z};

// ------------------------------------------------------------------------------------ steps
// Step pool. dig/map/bearing: dig with a spade within DIG_RADIUS of (x,z); emote: perform `emote`
// within EMOTE_RADIUS; talk: talk to npc (realm actor id); crate: search that crate.
// `area` points use that explore area's local x/z.
const dig=(id,tier,x,z,text,extra={})=>({id,tier,type:'dig',x,z,text,...extra});
const mapStep=(id,tier,x,z,text,extra={})=>({id,tier,type:'map',x,z,text,...extra});
const bearing=(id,tier,x,z,text,extra={})=>({id,tier,type:'bearing',x,z,text,...extra});
const emote=(id,tier,x,z,e,text,extra={})=>({id,tier,type:'emote',x,z,emote:e,text,...extra});
const talk=(id,tier,npc,npcName,text,reply)=>({id,tier,type:'talk',npc,npcName,text,reply});
const search=(id,tier,crateId,text)=>({id,tier,type:'crate',crate:crateId,text});
export const NPCS={corin:'8e1013ae-c555-4aff-a4ba-8425fb7a290a',tam:'9a3750ac-1129-4832-8c0a-cf7cc5c048ce',wenna:'96c070e2-a084-4db7-2499-9badcaca15e6',orrin:'cbb796a6-29c3-45cb-8bba-2774aa21189f',
 hesper:'fdb2d70e-ee36-4765-9ff8-0f6f69f5d4ca',ottilie:'2440a89d-bdff-4082-8a60-325865a2bffc',saffi:'863251ea-c761-49d6-8e2e-d8a73d724d21',wwCook:'529b34ed-e8b2-4735-9fca-463f3d39ec9f',
 emSmith:'efa05eb5-aea8-4164-a784-d39beee8ef3f',emShop:'00578c5b-129f-47be-8389-1401af382793',alden:'9648060c-eafe-4da9-8c43-d7c40c47e836',maud:'96d6414a-90ce-4080-8515-adc6b4db298b',
 dagna:'29ed959a-d60e-409b-b7a0-f61fd0d4a06d',gilly:'a32ad176-9da6-4941-94d6-00821a58c268',wynn:'c7a5e000-0000-4000-8000-000000000009',nettie:'c7a5e000-0000-4000-8000-000000000012',torren:'ddf6e9ae-7bb0-424e-bcb3-9493c3e70169'};
export const STEPS=[
 // Easy (Birchford, the castle and the near roads).
 dig('e_fountain_coins','easy',-238,130,'Where Birchford throws its wishes, the unlucky ones roll downhill. Dig where the cobbles dip, a few steps toward the setting sun.'),
 dig('e_scarecrow','easy',-292,136,'He guards the barley with a turnip for a head and no fear at all. Dig at his feet; he will not mind.'),
 dig('e_coop','easy',-279,123,'Seven hens, one egg, and a great deal of argument. Dig just behind the house of the arguing.'),
 mapStep('e_map_wayfarer','easy',-313,-143,'A torn corner of a map. A tent, a pot, a fire — and a small inked X.'),
 mapStep('e_map_crown_fountain','easy',-344,-296,'A sketch of a castle courtyard with a fountain drawn in blue. The X is close by the water.'),
 bearing('e_bearing_well','easy',-187,170,'From the well of the Grand Market, walk four paces toward Emberspire and four toward the river. Dig.'),
 emote('e_wave_pier','easy',300,362,'wave','Gulls overhead, salt in the air: at the start of the long walk over the water, wave to the boats.'),
 emote('e_bow_statues','easy',-232,168,'bow','Between a king and a queen of stone, show some respect.'),
 emote('e_dance_tam','easy',-333,-4,'dance','By a hut that will fall down any year now, dance — gently.'),
 talk('e_talk_corin','easy',NPCS.corin,'Corin the Lamplighter','I keep the dark at bay in Birchford, one wick at a time. Ask me what burns green.','“Green? That is the candle-stewards’ fault, not my oil. Here — someone left this with me for whoever asked.”'),
 talk('e_talk_tam','easy',NPCS.tam,'Old Tam the Fisherman','Forty years of “about to fall down” and still he fishes. Ask him for the line.','“The line? Ha. Riddle-folk. Fine — this was tangled in my net last spring.”'),
 talk('e_talk_alden','easy',NPCS.alden,'Alden the Wayfarer','He has walked every road and still prefers the one with a campfire on it.','“Ah, a riddle-walker. The last one left this by the pot and never came back for it.”'),
 search('e_crate_wayfarer','easy','wayfarer_supplies','Rations, rope and a riddle: search the crate the wayfarers share.'),
 search('e_crate_tam','easy','old_tam_tackle','Hooks and floats and something folded small: search the old fisher’s tackle.'),
 search('e_crate_gate','easy','castle_gate_stores','The gate of every road keeps its stores close. Search them.'),
 dig('e_milestone','easy',-232,-188,'“Too far,” someone scratched. Dig three steps from the stone that counts the leagues.'),
 // Medium (all towns, lakes and the wilds between).
 dig('m_moonmere_shrine','medium',-78,101,'Where fishers leave a painted stone for the one under the water, dig behind the offerings.'),
 dig('m_heron_tally','medium',145,346,'A heron counts the clumsy. Dig where the counted would have climbed out.'),
 dig('m_cairn','medium',-57,-117,'“Here lies no one. We built it in case.” Dig beside the case.'),
 mapStep('m_map_winterwatch','medium',224,-238,'A map scrap drawn in a cold hand: a square, a fountain, four lamps. The X is on the side of the rising sun.'),
 mapStep('m_map_emberspire','medium',252,218,'Kiln-smoke drawn in charcoal, a round square and a fountain. The X sits toward the market.'),
 mapStep('m_map_silverfin','medium',160,104,'Blue ink, a great lake, a wet journal sketched on the shore. X marks the south bank.'),
 bearing('m_bearing_kiln','medium',239,200,'From the first Emberwright’s statue, five paces toward the castle and three toward the frost. Dig.'),
 bearing('m_bearing_frost','medium',205,-256,'Stand at the cracked tablet that counts the winters. Four paces west, four south. Dig.'),
 emote('m_think_founding','medium',-241,124,'think','Where a stake was driven because the fish were stupid, consider whether the fish have learned.'),
 emote('m_cheer_ember','medium',257,209,'cheer','In the warmest square in Eldervale, beside water that never freezes, cheer.'),
 emote('m_kneel_frostfang','medium',62,-247,'kneel','Kneel where the wolves came to a burial and did not howl.'),
 talk('m_talk_wenna','medium',NPCS.wenna,'Wenna Saltglass','She mends the nets and knows the tides. Ask her which way the bell rings.','“Under the water, love. Always under the water. Take this; it washed up with the kelp.”'),
 talk('m_talk_wwcook','medium',NPCS.wwCook,'Winterwatch Cook','The warmest pot on the frontier. Ask the one who stirs it.','“A riddle? In my kitchen? Fine. It was in the flour sack. Do not ask how.”'),
 talk('m_talk_emsmith','medium',NPCS.emSmith,'Emberspire Smith','Hammer and kiln-heat: ask the one who owes a debt to the fire.','“Every smith here owes the fire. This was under my anvil this morning.”'),
 talk('m_talk_ottilie','medium',NPCS.ottilie,'Ottilie the Chandler','She sells what the lamplighter burns and the stewards distrust. Ask her about wax.','“Wax, wax, always wax. Here — sealed with my own, at someone’s request.”'),
 search('m_crate_loft','medium','saltglass_loft','Where nets dry and gulls steal, search the loft’s crate.'),
 search('m_crate_ww','medium','winterwatch_market','A frontier market keeps its spare stock in a crate. Search it.'),
 search('m_crate_em','medium','emberspire_market','Warm bricks, warm bread and a warm crate by the market. Search it.'),
 // Hard (the dangerous wilds, hidden places and the new regions).
 dig('h_veil_ledge','hard',30,-28,'Behind the falls, above the pool, where only the sure-footed stand: dig.',{area:'veilfall_grotto'}),
 dig('h_grove_heart','hard',38,-22,'Where moths weave what they will never finish, dig beside the shrine.',{area:'thornveil_grove'}),
 dig('h_runebound','hard',-27,-297,'The ruins guard something. Dig where its warning stands.'),
 dig('h_corrow','hard',203,388,'A mayor who never left lies by the dunes. Dig where he would have planted his feet.'),
 mapStep('h_map_isle','hard',38,-6,'A sea-chart of a small island with a broken lighthouse. X marks the dunes in the middle.',{area:'gullwing_isle'}),
 mapStep('h_map_plateau','hard',46,-12,'A climber’s sketch: a high meadow, a tarn, a cairn. X on the tarn’s south shore.',{area:'stormcrown_plateau'}),
 bearing('h_bearing_cairn','hard',57,24,'At the storm-cairn that lightning will not touch, three paces west and four south. Dig.',{area:'stormcrown_plateau'}),
 emote('h_bow_lamp','hard',44,0,'bow','Before the lamp that was never theirs to keep alight, bow.',{area:'quiet_lamp_shrine'}),
 emote('h_clap_lighthouse','hard',58,-20,'clap','Where the keeper let the lamp go out on purpose, applaud the decision.',{area:'gullwing_isle'}),
 emote('h_shrug_runebound','hard',-30,-303,'shrug','Before a stone that says the ruins guard something, admit you do not know what.'),
 talk('h_talk_orrin','hard',NPCS.orrin,'Orrin the Storykeeper','He keeps every tale on the Kingsroad. Ask him for the one about the riddle-folk.','“Ah, that tale ends with you, I think. Here is its last page.”'),
 talk('h_talk_saffi','hard',NPCS.saffi,'Saffi the Gem Trader','She weighs every stone twice. Ask her about the pearl behind the falls.','“A Veilfall pearl? If I had one I would not be talking to you. I have this instead.”'),
 search('h_crate_cove','hard','cove_stash','The smugglers keep their stash where the tide cannot reach. Search it.'),
 search('h_crate_wreck','hard','isle_wreck','A sloop ran aground with no lamp lit. Search what it was carrying.')
];
export const stepById=id=>STEPS.find(s=>s.id===id);
export const stepPoint=s=>s.area?areaPoint(s.area,s.x,s.z):{x:s.x,z:s.z};

// ------------------------------------------------------------------------------------ rewards
// Each casket: rolls (min–max) on its tier table, plus one roll on the rare table at `rare` chance.
const row=(item,min,max,weight)=>({item,min,max,weight});
export const REWARDS={
 easy:{rolls:[2,4],rare:'1/1200',rows:[row('gold',150,700,28),row('shrimp',4,8,10),row('trout',3,6,8),row('bread',3,6,6),row('bronzeArrows',25,60,8),row('steelArrows',15,35,6),row('ironBar',2,4,6),row('uncutGem',1,2,5),
  row('airRune',30,60,6),row('fireRune',20,45,6),row('oakLogs',8,15,6),row('feathers',30,60,6),row('healingPotion',1,2,4),
  row('keepsakeCompass',1,1,2),row('keepsakeQuill',1,1,2),row('keepsakePebble',1,1,2),row('keepsakeLantern',1,1,2)]},
 medium:{rolls:[3,4],rare:'1/600',rows:[row('gold',600,2200,26),row('lobster',4,8,10),row('salmon',4,8,8),row('steelBar',3,6,7),row('mithrilBar',2,4,6),row('goldBar',2,3,5),row('moonsilverArrows',20,50,7),
  row('uncutGem',2,4,6),row('cutGem',1,3,4),row('yewLogs',8,15,5),row('shrineDraught',1,2,4),row('briskTonic',2,3,4),
  row('keepsakeBottleShip',1,1,2),row('keepsakePennant',1,1,2),row('keepsakeSnowglobe',1,1,2)]},
 hard:{rolls:[4,5],rare:'1/250',rows:[row('gold',2500,9000,24),row('swordfish',4,8,9),row('stoneBass',3,6,7),row('runiteBar',1,2,5),row('adamantBar',2,4,6),row('tidesteelArrows',20,60,6),
  row('windstepBrew',1,2,5),row('serpentbaneTonic',1,2,4),row('cutGem',2,4,6),row('deepglowAngler',2,4,4),
  row('keepsakeHourglass',1,1,2),row('keepsakeStarchart',1,1,2),row('keepsakeBrooch',1,1,2)]},
 rare:{rows:[row('keepsakeCirclet',1,1,1),row('keepsakeWandererLantern',1,1,1),row('keepsakeTidePin',1,1,1)]}
};
export const parseChance=c=>{if(typeof c==='number')return c;const m=/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(c||''));return m?Number(m[1])/Number(m[2]):Number(c)||0};
// Weighted pick (deterministic with a supplied random()).
export function pickRow(rows,random=Math.random){const total=rows.reduce((t,r)=>t+(r.weight||0),0);if(!total)return null;let x=random()*total;for(const r of rows){x-=r.weight||0;if(x<0)return r}return rows[rows.length-1]}
// Roll a casket in JS (tests and the console's reward preview); SQL mirrors it (explore_roll_casket).
export function rollCasket(tier,{tables=REWARDS,random=Math.random}={}){const t=tables[tier];if(!t)return [];const out=[],n=t.rolls[0]+Math.floor(random()*(t.rolls[1]-t.rolls[0]+1));
 for(let k=0;k<n;k++){const r=pickRow(t.rows,random);if(r)out.push({item:r.item,n:r.min+Math.floor(random()*(r.max-r.min+1))})}
 if(random()<parseChance(t.rare)){const r=pickRow(tables.rare.rows,random);if(r)out.push({item:r.item,n:1,rare:true})}
 return out}
// Clue tier for a monster level (null: no clue).
export function clueTierFor(level,drops=DEFAULT_SETTINGS.clueDrops){let best=null;for(const t of TIERS){const d=drops[t];if(d&&level>=d.minLevel&&level<=d.maxLevel)best=t}return best}

// ------------------------------------------------------------------------- objects in explore areas
// Gatherable resources and fixtures placed inside the explore areas (local x/z), materialised as
// normal world entities so the existing gathering, fishing and altar systems handle them.
const res=(id,areaId,template,name,x,z,extra={})=>({id,area:areaId,template,name,x,z,...extra});
export const RESOURCES=[
 res('veil_gold_1','veilfall_grotto','rock','Gold rocks',46,-8,{resource:'goldOre'}),
 res('veil_gold_2','veilfall_grotto','rock','Gold rocks',40,2,{resource:'goldOre'}),
 res('grove_yew_1','thornveil_grove','tree','Old yew',18,6,{treeType:'yew'}),
 res('grove_yew_2','thornveil_grove','tree','Old yew',30,-6,{treeType:'yew'}),
 res('grove_herbs','thornveil_grove','herb_patch','Thornveil herbs',52,6),
 res('shrine_altar','quiet_lamp_shrine','altar','Altar of the Quiet Lamp',50,0),
 res('isle_pine_1','gullwing_isle','pine','Wind-bent pine',36,-12),
 res('isle_pine_2','gullwing_isle','pine','Wind-bent pine',42,0),
 res('isle_silver','gullwing_isle','rock','Silver rocks',34,2,{resource:'silverOre'}),
 res('isle_gold','gullwing_isle','rock','Gold rocks',44,-12,{resource:'goldOre'}),
 res('isle_fish_1','gullwing_isle','fishing_spot','Gullwing shallows',22,18,{spotType:'cage',waterHeight:.06}),
 res('isle_fish_2','gullwing_isle','fishing_spot','Gullwing shallows',8,8,{spotType:'shore',waterHeight:.06}),
 res('plateau_pine_1','stormcrown_plateau','pine','Stormcrown pine',18,10),
 res('plateau_pine_2','stormcrown_plateau','pine','Stormcrown pine',28,2),
 res('plateau_moon_1','stormcrown_plateau','rock','Moonsilver rocks',28,-30,{resource:'mithrilOre'}),
 res('plateau_moon_2','stormcrown_plateau','rock','Moonsilver rocks',33,-26,{resource:'mithrilOre'}),
 res('plateau_verdite','stormcrown_plateau','rock','Verdite rocks',31,-31,{resource:'adamantOre'}),
 res('plateau_coal_1','stormcrown_plateau','rock','Coal rocks',62,25,{resource:'coal'}),
 res('plateau_coal_2','stormcrown_plateau','rock','Coal rocks',56,24,{resource:'coal'})
];
// Agility shortcuts inside explore areas (local ends; agility-v1 entities like the R2-G ones).
export const SHORTCUTS=[
 {id:'veilfall_ledge',area:'veilfall_grotto',template:'wall_climb',name:'Slick ledge',level:25,xp:20,fail:.25,failDamage:30,ticks:4,ends:[[22,-.5],[30,-21]]},
 {id:'thornveil_tunnel',area:'thornveil_grove',template:'squeeze',name:'Thorn tunnel',level:35,xp:28,fail:.2,failDamage:35,ticks:5,ends:[[30,-8],[40,-21]]},
 {id:'brinehook_swing',area:'brinehook_cove',template:'rope_swing',name:'Inlet rope swing',level:45,xp:36,fail:.25,failDamage:50,ticks:4,ends:[[26,10],[30,26]]},
 {id:'stormcrown_scramble',area:'stormcrown_plateau',template:'wall_climb',name:'Crag scramble',level:55,xp:48,fail:.2,failDamage:60,ticks:5,ends:[[44,-15],[32,-23]]}
];
export function shortcutWorldEnds(s){return s.ends.map(([x,z])=>{const p=areaPoint(s.area,x,z);return [p.x,p.z]})}

// ------------------------------------------------------------------------------------ helpers
// Is a world point within r of an explore point?
export const near=(p,x,z,r)=>Math.hypot(p.x-x,p.z-z)<=r;
// Public step data the client may see (no dig coordinates for riddles; map steps get a centre).
export function publicStep(s){if(!s)return null;const out={id:s.id,tier:s.tier,type:s.type,text:s.text};if(s.type==='map'){const p=stepPoint(s);out.map={x:Math.round(p.x),z:Math.round(p.z),area:s.area||null}}if(s.type==='emote')out.emote=s.emote;if(s.type==='talk')out.npcName=s.npcName;return out}
// Totals for the achievement counter.
export const TOTALS={lore:LORE.length,place:PLACES.length};
// Every id is lower-case and unique per kind; every reference resolves. Returns a list of problems.
export function validateExplore({items=ITEMS,areas=AREAS,places=PLACES,lore:loreList=LORE,crates=CRATES,steps=STEPS,rewards=REWARDS,shortcuts=SHORTCUTS,resources=RESOURCES,catalog=null}={}){
 const errors=[],idOk=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{1,40}$/.test(v),seen=(list,kind)=>{const s=new Set();for(const x of list){if(!idOk(x.id))errors.push(kind+' '+x.id+': bad id');if(s.has(x.id))errors.push(kind+' '+x.id+': duplicate');s.add(x.id)}};
 seen(places,'place');seen(loreList,'lore');seen(crates,'crate');seen(steps,'step');seen(areas,'area');seen(shortcuts,'shortcut');seen(resources,'resource');
 for(const p of places){if(p.area&&!areas.find(a=>a.id===p.area)&&p.type!=='cave')errors.push('place '+p.id+': unknown area');if(['town','landmark'].includes(p.type)&&!(Math.abs(p.x)<=420&&Math.abs(p.z)<=420&&p.radius>0))errors.push('place '+p.id+': overworld point and radius');
  if(['hidden','region'].includes(p.type)){if(!p.entrance||!ENTRANCE_MODELS[p.entrance.model])errors.push('place '+p.id+': entrance model');if(p.entrance&&(Math.abs(p.entrance.x)>420||Math.abs(p.entrance.z)>420))errors.push('place '+p.id+': entrance inside ±420')}}
 for(const l of loreList){if(!LORE_MODELS[l.model])errors.push('lore '+l.id+': model');if(!l.text||l.text.length>600)errors.push('lore '+l.id+': text 1–600');if(l.area&&!areas.find(a=>a.id===l.area))errors.push('lore '+l.id+': area')}
 for(const s of steps){if(!TIERS.includes(s.tier)||!STEP_TYPES[s.type])errors.push('step '+s.id+': tier/type');if(s.type==='crate'&&!crates.find(c=>c.id===s.crate))errors.push('step '+s.id+': unknown crate');if(s.type==='emote'&&!EMOTES[s.emote])errors.push('step '+s.id+': emote');if(s.type==='talk'&&!/^[0-9a-f-]{36}$/.test(s.npc||''))errors.push('step '+s.id+': npc id');if(s.area&&!areas.find(a=>a.id===s.area))errors.push('step '+s.id+': area')}
 for(const t of TIERS){const n=steps.filter(s=>s.tier===t).length,max=DEFAULT_SETTINGS.steps[t][1];if(n<max+2)errors.push('tier '+t+': only '+n+' steps for up to '+max+' per clue')}
 const known=id=>id==='gold'||!!items[id]||!catalog||catalog.has(id);
 for(const [t,tab] of Object.entries(rewards))for(const r of tab.rows){if(!known(r.item))errors.push('reward '+t+': unknown item '+r.item);if(!(r.min>=1&&r.max>=r.min&&r.weight>0))errors.push('reward '+t+' '+r.item+': amounts/weight')}
 return errors;
}
