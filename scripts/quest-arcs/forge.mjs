// Arc 3 — The Emberwright’s Debt (Emberspire, the scrubland and the Kiln Below). Original story.
// Saboteurs salt the quench barrels of Emberspire; the fire-cult behind them says the forges have
// been stealing their heat from something asleep under the town for a hundred years.
import {npc,monster,prop,item,drop,talk,scene,room,tunnel} from './common.mjs';

const A='forge';
export const arc={key:A,name:'The Emberwright’s Debt',region:'Emberspire, the scrubland and the Kiln Below',chain:'arc-forge'};

export const npcs=[
 npc(A,1,'kade','smith','Forgemistress Oriel Kade',262,198,{yaw:0,dialogue:'The Anvilhall of Emberspire. Best heat in Eldervale.\nDo not ask where it comes from. Nobody ever does.'}),
 npc(A,2,'nix','villager','Nix Calloway the Apprentice',271,204,{yaw:-90,dialogue:'Apprentice third class. I sweep, I pump the bellows, I occasionally set my eyebrows on fire.'}),
 npc(A,3,'tamber','mage','Tamber the Kindled',205,150,{yaw:90,dialogue:'Every flame remembers where it was born.\nEmberspire’s flames were born in chains.'}),
 npc(A,4,'pike','villager','Assayer Doran Pike',249,224,{yaw:180,dialogue:'Ore, ash and assay. I can tell you what anything is made of. People rarely like the answer.'}),
 npc(A,5,'kessa','villager','Kessa Emberly',312,124,{yaw:90,dialogue:'I said the oath. I meant some of it.'}),
 npc(A,6,'ember','mage','The Emberwright’s Ember',3062,3006,{yaw:-90,dialogue:'(A voice like a bellows breathing, very slowly.) Small one. You came down into the warm.'}),
 npc(A,7,'ashwright','merchant','Ashwright Quartermaster Sorrel',3020,3404,{yaw:180,dialogue:'The Kindled Forge sells to those it trusts. That list is short, and you are on it.',
  shop:{runiteBar:{buy:3000,sell:900,stock:8},adamantBar:{buy:900,sell:270,stock:20},blacksteelBar:{buy:420,sell:120,stock:30},embersteelArrowtips:{buy:40,sell:12,stock:300},coal:{buy:40,sell:12,stock:200}}})
];
export const monsters=[
 monster(A,1,'zealot','sandscar_raider','Kindled zealot',226,170,{level:12,rank:'Common',arch:'swift',loot:[drop('custom_qa_kindled_sigil')],examine:'Ash on the forehead, salt in the pockets.'}),
 monster(A,2,'hound1','ember_hound','Ash-fed ember hound',335,252,{level:35,rank:'Common',arch:'beast',examine:'Someone has been feeding it coal. It liked it.'}),
 monster(A,3,'hound2','ember_hound','Ash-fed ember hound',341,258,{level:35,rank:'Common',arch:'beast',examine:'Someone has been feeding it coal. It liked it.'}),
 monster(A,4,'hound3','ember_hound','Ash-fed ember hound',330,260,{level:35,rank:'Common',arch:'beast',examine:'Someone has been feeding it coal. It liked it.'}),
 monster(A,5,'sworn1','sandscar_raider','Kindled cinder-sworn',316,118,{level:40,rank:'Veteran',arch:'brute',examine:'Their oath is branded on the back of the hand.'}),
 monster(A,6,'sworn2','sandscar_raider','Kindled cinder-sworn',324,124,{level:40,rank:'Veteran',arch:'brute',examine:'Their oath is branded on the back of the hand.'}),
 monster(A,7,'guard1','cinder_fiend','Kiln-bound guardian',3022,2998,{level:56,rank:'Veteran',arch:'brute',scale:1.3,roam:1,respawn:45,examine:'A Kindled zealot who gave the fire more than an oath.'}),
 monster(A,8,'guard2','cinder_fiend','Kiln-bound guardian',3026,3004,{level:56,rank:'Veteran',arch:'brute',scale:1.3,roam:1,respawn:45,examine:'A Kindled zealot who gave the fire more than an oath.'}),
 monster(A,9,'herald','basalt_golem','The Cinderbound Herald',3052,3000,{level:88,rank:'Boss',arch:'stone',scale:2.3,tint:0x3a2a24,eyes:0xffa040,accent:0xff7a1a,aura:0xff7a1a,crown:true,roam:1,respawn:90,attackSpeed:4,
  loot:[drop('custom_qa_heart_coal')],examine:'Tamber’s masterpiece: a bellows with fists, built to blow a sleeping god awake.'}),
 monster(A,10,'reforged','basalt_golem','The Herald Reforged',3050,3400,{level:112,rank:'Legendary',arch:'stone',scale:2.6,tint:0x2a1d18,eyes:0xffd27a,accent:0xffb347,aura:0xffb347,crown:true,roam:1,respawn:300,attackSpeed:3.8,
  loot:[{item:'runiteBar',min:1,max:3,chance:.4},{item:'coal',min:10,max:25,chance:1,always:true},{item:'runiteOre',min:2,max:4,chance:.4}],examine:'The Herald, rebuilt by the Kindled Forge for anyone who wants a harder day. Harder mode.'})
];
export const objects=[
 prop(A,1,'anvil','anvil','Kindled Forge anvil',3026,3396),
 prop(A,2,'furnace','furnace','Kindled Forge furnace',3017,3396)
];
export const items=[
 item('custom_qa_kindled_sigil','Kindled sigil','A brass flame on a cord, warm to the touch. Every member of the Kindled wears one.'),
 item('custom_qa_heart_coal','Herald’s heart-coal','A coal the size of a fist that will not stop glowing. It hums like a bellows. Forgemistress Kade will want it.','gem'),
 item('custom_qa_ember_seal','Emberwright’s Seal','A ring of dark iron with a living spark caught in it. Turn it to return to the Anvilhall in Emberspire.','gem')
];
export const areas=[{
 id:'kiln_below',name:'The Kiln Below',theme:'fire',band:[50,112],origin:{x:3000,z:3000},enabled:true,
 blurb:'The vault under the scrubland where Emberspire’s heat really comes from. Opened by “The Bellows Below”.',
 levels:[
  {level:0,name:'The bellows halls',rooms:[room('gate',0,0,6,5),room('bellows',24,0,10,8),room('crucible',52,2,13,11)],tunnels:[tunnel(3.2,[0,0],[24,0]),tunnel(3.4,[24,0],[52,2])]},
  {level:1,name:'The Kindled Forge',rooms:[room('landing',0,0,6,6),room('forge',22,0,12,9),room('pit',50,0,13,11)],tunnels:[tunnel(3.2,[0,0],[22,0]),tunnel(3.4,[22,0],[50,0])]}],
 entrances:[
  {id:'door',kind:'crypt_door',x:322,z:108,yaw:180,name:'The Kiln Door',to:{level:0,x:2,z:0},requires:{unlock:'area.forge-kiln'}},
  {id:'forge',kind:'mine_shaft',x:329,z:108,yaw:180,name:'The Kindled Forge shaft',to:{level:1,x:2,z:0},requires:{unlock:'area.forge-kindled'}}],
 links:[],
 spawns:[{id:'golems',roster:'basalt_golem',count:2,level:0,room:'bellows'}],
 lights:[{level:0,x:3,z:-3,kind:'brazier'},{level:0,x:24,z:6,kind:'lava'},{level:0,x:46,z:-6,kind:'lava'},{level:0,x:60,z:10,kind:'lava'},
  {level:1,x:3,z:3,kind:'brazier'},{level:1,x:22,z:7,kind:'brazier'},{level:1,x:50,z:8,kind:'lava'},{level:1,x:44,z:-6,kind:'lava'}]}];

export const quests=[
{n:1,key:'arc-forge-1',name:'Sparks in the Ashpit',questPoints:1,difficulty:'Novice',length:'Short',giver:'@forge.kade',icon:'bronzeBar',
 description:'Someone is salting the quench barrels of the Anvilhall in Emberspire, cracking blade after blade. Forgemistress Kade wants the saboteur found.',
 dialogue:{
  offer:talk('Three blades cracked in the quench this week. Three! My grandmother’s grandmother never cracked three in a lifetime.','Someone is pouring ash-salt into my barrels. I want them found, and I want them to explain themselves to my hammer.','Start with Nix, my apprentice. He sleeps in the forge loft. If anyone saw something, it was him, probably while sleepwalking.'),
  progress:talk('Found my salter yet? My hammer is getting impatient. So am I.'),
  complete:talk('The Kindled. Those ash-smeared prophets from the scrubland. Of course.','New tools, too. You have a decent hand for bronze. Take this.')},
 stages:[
  {id:'nix',journal:'Forgemistress Oriel Kade of the Anvilhall in Emberspire told me someone is salting her quench barrels. Her apprentice Nix sleeps in the forge loft and may have seen something.',
   objectives:[{type:'talk',target:'@forge.nix',amount:1,label:'Ask Nix the apprentice what he saw',dialogue:talk('I saw nothing! I was asleep. Well. Mostly. There were people in robes by the barrels, with ash on their faces.','They went off towards the old ash pits west of town. I did not follow them. I am an apprentice, not an idiot. Mostly.')}]},
  {id:'pits',journal:'Nix saw robed people with ash-smeared faces by the barrels at night, heading for the old ash pits west of Emberspire.',
   objectives:[{type:'visit',x:228,z:172,radius:5,amount:1,label:'Search the old ash pits west of Emberspire'}]},
  {id:'zealot',journal:'At the ash pits a Kindled zealot was filling sacks with ash-salt. He drew a knife rather than talk.',
   onEnter:{cutscene:'pits'},
   objectives:[{type:'kill',target:'@forge.zealot',amount:1,label:'Stop the Kindled zealot'},{type:'have',target:'custom_qa_kindled_sigil',amount:1,label:'Take the zealot’s brass sigil'}]},
  {id:'tools',journal:'The zealot wore a brass flame: the sigil of the Kindled, a fire-cult from the scrubland. The salt has ruined Kade’s quench tongs, so I should bring her two bronze bars along with the sigil.',
   objectives:[{type:'have',target:'custom_qa_kindled_sigil',amount:1,label:'Show Kade the Kindled sigil'},{type:'collect',target:'bronzeBar',amount:2,label:'Bring Kade two bronze bars for new tongs'}]}],
 cutscenes:{
  pits:scene('The ash pits','The ash pits','West of Emberspire',[['@forge.nix','(Nix’s voice, from a safe distance) Are they there? Are they big? Never mind, I can hear the knife from here.','Nix Calloway']]),
  sigil:scene('The Kindled','A brass flame','The Anvilhall, Emberspire',[['@forge.kade','The Kindled say our fires are stolen. Stolen from whom, I always ask. They never give a straight answer.','Forgemistress Oriel Kade']])},
 onComplete:{cutscene:'sigil'},
 journalDone:'I caught a Kindled zealot salting the Anvilhall’s quench barrels at the ash pits west of Emberspire and brought Forgemistress Kade his brass sigil, and bronze for new tongs.',
 gold:150,xp:{smithing:1500,mining:1000},lamps:[{perLevel:10,minLevel:5,label:'Quench lamp'}],
 unlocks:[
  {type:'flag',id:'forge.salter_caught',label:'The Anvilhall’s quench runs clean'},
  {type:'dialogue',id:'dialogue.forge-nix-1',label:'Nix the brave',npc:'@forge.nix',lines:talk('I have told everyone I helped catch the salter. I have described my part as “crucial”. Please do not correct me.')}]},

{n:2,key:'arc-forge-2',name:'The Kindled Word',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@forge.kade',icon:'custom_qa_kindled_sigil',
 requirements:{quests:['arc-forge-1'],skills:{smithing:{level:20,boostable:false},mining:{level:20,boostable:false}}},
 description:'The Kindled preach that Emberspire’s fires are stolen. Kade wants someone to wear the brass flame, walk into their shrine, and find out what they are planning.',
 dialogue:{
  offer:talk('A cult that salts barrels is a cult that plans something bigger. I want to know what.','Wear that sigil. Walk into their shrine in the scrubland like you belong. Listen. Do not, under any circumstances, swear anything.'),
  progress:talk('Anything from the shrine? Do not tell me you joined. You joined. Did you join?'),
  complete:talk('A golem to blow a sleeping god awake. Under my town. Under my forge.','...Pike will want to assay this. I think I would rather not know. Thank you.')},
 branchDialogue:[{stage:'complete',ifFlags:{swore_oath:true},lines:talk('You swore their oath. I told you not to swear anything. I said “under any circumstances”. I was very clear.','...But Kessa trusts you because of it, so. Fine. Thank you.')}],
 stages:[
  {id:'shrine',journal:'Forgemistress Kade asked me to wear the Kindled sigil and walk into the cult’s Cinder Shrine in the scrubland north-west of Emberspire, and listen.',
   objectives:[{type:'have',target:'custom_qa_kindled_sigil',amount:1,label:'Wear the Kindled sigil openly'},{type:'visit',x:208,z:153,radius:5,amount:1,label:'Walk into the Cinder Shrine'}]},
  {id:'tamber',journal:'The shrine is a ring of blackened stones around a fire that never goes out. The Kindled’s prophet, Tamber, wants to speak with the newcomer.',
   npc:'@forge.tamber',onEnter:{cutscene:'shrine'},
   objectives:[{type:'talk',target:'@forge.tamber',amount:1,label:'Listen to Tamber the Kindled',dialogue:talk('A new spark. Sit. Hear the truth the Anvilhall pays to forget.','Beneath Emberspire sleeps the Emberwright, the fire that made the first forge. A hundred years ago the forgemasters chained it and drank its heat. Every blade in Emberspire is borrowed.','The debt comes due. Bring an offering to the fire, and I will tell you how.')},
    {type:'collect',target:'coal',amount:5,label:'Bring five coal as an offering'}],
   dialogue:{choice:talk('The fire accepts your offering. Now: the oath. Say it with me, and be Kindled. Or leave, and be cold.')},
   choices:[
    {id:'swear',label:'Swear the Kindled oath (and keep your fingers crossed).',flags:{swore_oath:true},dialogue:talk('Kindled! Welcome, spark. Soon we wake the Emberwright, and the debt is paid in full.')},
    {id:'refuse',label:'Refuse the oath and walk out.',flags:{refused_oath:true},dialogue:talk('Cold, then. The fire will remember your face.')}]},
  {id:'kessa',journal:'On the way out of the shrine an initiate called Kessa Emberly whispered that she would meet me at the Kindled’s kiln camp, east of Emberspire, where nobody listens.',
   objectives:[{type:'talk',target:'@forge.kessa',amount:1,label:'Meet Kessa Emberly at the kiln camp east of Emberspire',dialogue:talk('I joined because I believed the story. I still do. But Tamber is not waiting for the debt. He is building a Herald, a golem of bellows and basalt, to blow the Emberwright awake.','If he wakes it angry, Emberspire burns. Tell the Anvilhall. Please.')}]},
  {id:'assay',journal:'Kessa says Tamber is building a Herald, a bellows-golem, to force the Emberwright awake. Before I tell Kade, Assayer Doran Pike by the Emberspire market should hear about this “stolen heat”.',
   objectives:[{type:'talk',target:'@forge.pike',amount:1,label:'Tell Assayer Pike about the Emberwright',dialogue:talk('Heat from below. Hm. My furnace readings have been falling for ten years, a hair at a time.','I assumed I was getting old. I might also be right. Tell Kade I want to assay the vents.')}]}],
 cutscenes:{
  shrine:scene('The Cinder Shrine','The Cinder Shrine','The scrubland north-west of Emberspire',[['@forge.tamber','The fire never goes out here. We feed it, and it remembers. Come closer, spark.','Tamber the Kindled']]),
  herald:scene('The Herald','Bellows and basalt','The Anvilhall, Emberspire',[['@forge.kade','A golem built to wake a god. Under my forge. I need to sit down. On an anvil. They are very comfortable.','Forgemistress Oriel Kade']])},
 onComplete:{cutscene:'herald'},
 journalDone:'Wearing the Kindled sigil, I heard Tamber’s story of the Emberwright, the fire chained under Emberspire. Kessa Emberly warned me that Tamber is building a Herald to wake it by force. Assayer Pike has noticed the forges’ heat falling for years.',
 journalVariants:[{ifFlags:{swore_oath:true},text:'I swore the Kindled oath, fingers crossed.'},{ifFlags:{refused_oath:true},text:'I refused the Kindled oath and walked out.'}],
 gold:400,xp:{smithing:6000,mining:5000,firemaking:3000},lamps:[{perLevel:10,minLevel:10,label:'Kindled lamp'}],
 unlocks:[
  {type:'flag',id:'forge.herald_known',label:'Emberspire knows of the Herald'},
  {type:'dialogue',id:'dialogue.forge-tamber-sworn',label:'Tamber greets a spark',npc:'@forge.tamber',ifFlags:{swore_oath:true},lines:talk('Spark! The fire asks after you. Sit, warm your hands. Soon the debt is paid.')},
  {type:'dialogue',id:'dialogue.forge-tamber-cold',label:'Tamber remembers your face',npc:'@forge.tamber',ifFlags:{refused_oath:true},lines:talk('The cold one returns. The fire remembers you. It is not fond.')}]},

{n:3,key:'arc-forge-3',name:'Assay of Embers',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@forge.pike',icon:'ironBar',
 requirements:{quests:['arc-forge-2','arc-crown-2'],skills:{smithing:{level:30,boostable:false},mining:{level:30,boostable:false}}},
 description:'Assayer Doran Pike wants to measure the heat rising from the vents east of Emberspire. If the Emberwright is real, the numbers will say so.',
 dialogue:{
  offer:talk('Numbers do not lie. People do. Forgemistresses, occasionally.','I need assay rods, three iron bars, and readings from the three vents by the ember hound run. The hounds will object.','> I’ll bring you your numbers.'),
  progress:talk('Rods, vents, hounds. In that order is traditional.'),
  complete:talk('There. Written down, it is just a number. Out loud, it is a hundred years of theft.','Thank you. I think. Here, for the rods and the bites.')},
 branchDialogue:[{stage:'complete',ifFlags:{kept_silent:true},lines:talk('So we keep it between us for now. The numbers will wait. They are patient. I am less so.','Here, for the rods and the bites.')}],
 stages:[
  {id:'rods',journal:'Assayer Doran Pike wants to measure the heat rising from the vents east of Emberspire. He needs three iron bars to make assay rods.',
   npc:'@forge.pike',
   objectives:[{type:'collect',target:'ironBar',amount:3,label:'Bring Pike three iron bars for assay rods'}],
   dialogue:{advance:talk('Good iron. Push one into each vent by the ember hound run, east of town, and read the colour it turns.')}},
  {id:'vents',journal:'Pike gave me three assay rods to push into the vents by the ember hound run, east of Emberspire.',
   objectives:[{type:'visit',x:326,z:244,radius:3,amount:1,label:'Assay the western vent'},{type:'visit',x:347,z:249,radius:3,amount:1,label:'Assay the eastern vent'},{type:'visit',x:338,z:265,radius:3,amount:1,label:'Assay the southern vent'}]},
  {id:'hounds',journal:'The rods turned white in every vent. Then the ember hounds came: someone has been feeding them coal by the vents, and they treat the heat as theirs.',
   onEnter:{cutscene:'vents'},
   objectives:[{type:'event',event:'death',targets:['@forge.hound1','@forge.hound2','@forge.hound3'],amount:3,label:'Fight off the ash-fed ember hounds'}]},
  {id:'samples',journal:'With the hounds gone I can chip some ember-glass from around the vents for Pike to compare with the Anvilhall’s furnace slag.',
   objectives:[{type:'xp',skill:'mining',amount:250,label:'Chip ember-glass samples (Mining XP)'}]},
  {id:'verdict',journal:'I brought Pike the readings and samples. The heat under the scrubland and the heat in the Anvilhall’s furnaces are the same heat: drawn up by old iron channels the guild laid a century ago. Kade’s guild records must show them.',
   npc:'@forge.pike',
   objectives:[{type:'talk',target:'@forge.pike',amount:1,label:'Hear Pike’s verdict'}],
   dialogue:{choice:talk('The Anvilhall drinks the Emberwright’s heat. And the guild records have known for a hundred years. Kade has those records.','Do we put this in front of her, or keep it quiet until we know what the Kindled will do?')},
   choices:[
    {id:'confront',label:'Kade deserves to see the numbers. Now.',flags:{confronted_kade:true},dialogue:talk('Then go. I will be here, recalculating my will.')},
    {id:'silent',label:'Keep it quiet until we know Tamber’s plan.',flags:{kept_silent:true},dialogue:talk('Quiet it is. Numbers keep. Tell Kade only that the vents are hot.')}]},
  {id:'forgemistress',journal:'I have decided what to tell Forgemistress Kade. I should speak to her at the Anvilhall, then return to Pike.',
   objectives:[{type:'talk',target:'@forge.kade',amount:1,label:'Speak to Forgemistress Kade',dialogue:talk('I know what the vents say. I have known since I took the hammer. Every forgemistress is told on her first day, and sworn to say nothing.','I am tired of saying nothing.')}]}],
 cutscenes:{
  vents:scene('The vents','The ember hound run','East of Emberspire',[['@forge.pike','(Pike’s note, pinned to the rod) White means very hot. If the rod is white and the hounds are near, run first and assay later.','Assayer Doran Pike']]),
  numbers:scene('A hundred years','The assay','Emberspire market',[['@forge.pike','Same heat, same channels, same signature. The Emberwright is real, and Emberspire has been drinking it dry.','Assayer Doran Pike']])},
 onComplete:{cutscene:'numbers'},
 journalDone:'I assayed the vents by the ember hound run for Doran Pike. Their heat is the Anvilhall’s heat: for a hundred years the guild has drawn its fire from the sleeping Emberwright through old iron channels, and every forgemistress has known.',
 journalVariants:[{ifFlags:{confronted_kade:true},text:'I put the numbers in front of Kade.'},{ifFlags:{kept_silent:true},text:'Pike and I kept the numbers quiet for now.'}],
 gold:600,xp:{mining:7000,smithing:6000,strength:4000},lamps:[{perLevel:10,minLevel:15,label:'Assayer’s lamp'}],
 unlocks:[
  {type:'flag',id:'forge.debt_proven',label:'The Emberwright’s debt is proven'},
  {type:'dialogue',id:'dialogue.forge-pike-3',label:'Pike’s new hobby',npc:'@forge.pike',lines:talk('I assay the vents every morning now. They are cooling, a hair a day. I have started talking to them. They do not answer. Yet.')}]},

{n:4,key:'arc-forge-4',name:'The Bellows Below',questPoints:3,difficulty:'Experienced',length:'Long',giver:'@forge.kade',icon:'coal',
 requirements:{quests:['arc-forge-3'],qp:16,skills:{smithing:{level:40,boostable:false},mining:{level:40,boostable:false},firemaking:{level:30,boostable:false}}},
 description:'Nix has been taken by the Kindled. Tamber needs an apprentice who knows the Anvilhall’s old channels, and Nix knows them better than he knows his own boots.',
 dialogue:{
  offer:talk('They took Nix. From the loft. In his nightshirt.','Tamber wants the old channels. Nix sweeps them every week. He knows every grate between here and the scrubland.','Bring him back. And find out where those channels lead. I will not be told the answer by a cult any longer.'),
  progress:talk('Nix? Anything? He owes me three weeks of sweeping.'),
  complete:talk('Nix! You stink of bellows-smoke and you are wearing one boot. Come here.','The Kiln Door. Under the scrubland. A hundred years and not one forgemistress went down to look. That ends now. Take this, and the key.')},
 stages:[
  {id:'trail',journal:'The Kindled took Nix the apprentice from the forge loft; Tamber wants his knowledge of the Anvilhall’s old heat channels. Kessa Emberly at the kiln camp east of Emberspire might know where he was taken.',
   objectives:[{type:'talk',target:'@forge.kessa',amount:1,label:'Ask Kessa Emberly where Nix was taken',dialogue:talk('They have him in the kiln camp, by the Kiln Door. Tamber wants the door open tonight and thinks Nix can read the old bellows.','Two cinder-sworn guard him. I cannot fight them. You can.')}]},
  {id:'sworn',journal:'Nix is held in the kiln camp by two of Tamber’s cinder-sworn, who mean to make him open the Kiln Door tonight.',
   onEnter:{cutscene:'camp'},
   objectives:[{type:'event',event:'death',targets:['@forge.sworn1','@forge.sworn2'],amount:2,label:'Defeat the cinder-sworn guards'}]},
  {id:'bellows',journal:'Nix is free, and he says the Kiln Door is opened by three great bellows pumped in the order the Kindled pray. Kessa is the only one of us who has heard their prayers.',
   npc:'@forge.kessa',
   objectives:[{type:'talk',target:'@forge.kessa',amount:1,label:'Ask Kessa how the Kindled pray'}],
   dialogue:{choice:talk('We pray to the fire’s life, as it was and will be. “The ember waits, the flame rises, the ash remembers.”','Three bellows: ember, flame, ash. Which order do you pump them?')},
   choices:[
    {id:'right',label:'Ember, then flame, then ash.',flags:{door_opened:true},next:'escort',dialogue:talk('Listen. The door is breathing. It is open. Gods, it is warm down there.')},
    {id:'ash',label:'Ash, then ember, then flame.',next:'shrine-wall',dialogue:talk('Nothing. The bellows just wheeze. The prayer is carved on the shrine wall; go and read it properly.')},
    {id:'flame',label:'Flame, then ash, then ember.',next:'shrine-wall',dialogue:talk('A cough of soot, and nothing. The prayer is carved on the shrine wall; go and read it properly.')}]},
  {id:'shrine-wall',journal:'The bellows wheezed and the door stayed shut. Kessa says the Kindled prayer is carved on the wall of the Cinder Shrine; I should read it there and come back.',next:'bellows',
   objectives:[{type:'visit',x:203,z:146,radius:3,amount:1,label:'Read the prayer on the Cinder Shrine wall'}]},
  {id:'escort',journal:'The Kiln Door is breathing warm air. Before anyone goes down, Nix needs to get home to the Anvilhall in one piece, and he refuses to walk without an escort. Through the scrubland, by the old road.',
   onEnter:{cutscene:'door'},
   objectives:[{type:'visit',x:292,z:168,radius:6,amount:1,label:'Walk Nix back along the old road'}]},
  {id:'home',journal:'Nix and I reached the edge of Emberspire. He is limping on one boot and complaining about it at length. He should be safely back at the forge before I report to Kade.',
   objectives:[{type:'talk',target:'@forge.nix',amount:1,label:'See Nix safely back to the Anvilhall',dialogue:talk('Home! My loft! My broom! I will never complain about sweeping again. That is a lie. But I will complain less.')}]}],
 cutscenes:{
  camp:scene('The kiln camp','The kiln camp','East of Emberspire',[['@forge.kessa','Two of them, by the door. Nix is tied to the bellows. He is... lecturing them on correct bellows maintenance.','Kessa Emberly']]),
  door:scene('The Kiln Door','The Kiln Door','The scrubland',[['@forge.kessa','I will keep the camp quiet. Tamber is not here; he is already below. Whatever he is building, it is nearly done.','Kessa Emberly']]),
  nixhome:scene('One boot','Home to the Anvilhall','Emberspire',[['@forge.kade','The key to the Kiln Door has hung over my anvil for a hundred years. Today someone finally takes it down.','Forgemistress Oriel Kade']])},
 onComplete:{cutscene:'nixhome'},
 journalDone:'I freed Nix from the Kindled’s kiln camp, worked out the Kindled prayer that opens the Kiln Door, and walked Nix home. Forgemistress Kade has opened the way to the Kiln Below, where Tamber is finishing his Herald.',
 gold:1200,xp:{smithing:20000,mining:15000,firemaking:12000},lamps:[{amount:15000,minLevel:30,label:'Bellows lamp (any skill of level 30+)'}],
 unlocks:[
  {type:'area',id:'area.forge-kiln',label:'The Kiln Door, east of Emberspire'},
  {type:'flag',id:'forge.kiln_door_open',label:'The Kiln Door breathes again'},
  {type:'dialogue',id:'dialogue.forge-kessa-4',label:'Kessa keeps the camp',npc:'@forge.kessa',lines:talk('Half the Kindled went home after the camp. The other half are waiting to see what you do below. So am I.')}]},

{n:5,key:'arc-forge-5',name:'The Emberwright’s Debt',questPoints:5,difficulty:'Master',length:'Very long',giver:'@forge.kade',icon:'custom_qa_ember_seal',
 requirements:{quests:['arc-forge-1','arc-forge-2','arc-forge-3','arc-forge-4'],qp:36,skills:{smithing:{level:50,boostable:false},mining:{level:45,boostable:false},firemaking:{level:45,boostable:false}},combat:65},
 description:'Below the Kiln Door, Tamber’s Herald is ready to blow the Emberwright awake. Forgemistress Kade is going to settle a hundred-year debt one way or another.',
 dialogue:{
  offer:talk('A hundred years, and I am the forgemistress who has to pay. Fine. I would rather pay than steal.','Nix is forging quench-chains for the Herald. Mithril, he says. He is very excited. Bring him the bars.','Then go down and stop that golem before Tamber wakes the Emberwright angry.'),
  progress:talk('The anvils are cooling. I can feel it in the hammer. Hurry.'),
  complete:talk('The Herald’s heart. Still humming. And the Emberwright is... answered.','The guild owes you more than it can pay. It will try. Take these gauntlets, sworn on the oldest anvil in Emberspire, and this seal.')},
 branchDialogue:[
  {stage:'complete',ifFlags:{rekindled:true},lines:talk('You let it wake. The anvils are colder and the Emberwright is free, and my guild has to learn to make its own heat.','We will. It is about time. Take these gauntlets and this seal; the Kindled Forge below is open to you.')},
  {stage:'complete',ifFlags:{bound:true},lines:talk('It sleeps again, by its own choice, and lends us its warmth as a gift instead of a theft. The guild will pay it back in kind, every year.','Take these gauntlets and this seal; the Kindled Forge below is open to you.')}],
 stages:[
  {id:'chains',journal:'Below the Kiln Door, Tamber’s Herald is nearly ready to blow the Emberwright awake. Nix wants two mithril bars to forge quench-chains to slow it down.',
   npc:'@forge.nix',
   objectives:[{type:'collect',target:'mithrilBar',amount:2,label:'Bring Nix two mithril bars'}],
   dialogue:{advance:talk('Quench-chains! My first proper commission. Throw them at its bellows and it will sputter. In theory. Do not quote me.')}},
  {id:'below',journal:'Nix forged the quench-chains. Time to go down through the Kiln Door into the Kiln Below.',
   onEnter:{cutscene:'below'},
   objectives:[{type:'visit',x:3022,z:3000,radius:7,amount:1,label:'Enter the bellows halls of the Kiln Below'}]},
  {id:'guardians',journal:'The bellows halls are guarded by Kindled who gave the fire more than an oath.',
   objectives:[{type:'event',event:'death',targets:['@forge.guard1','@forge.guard2'],amount:2,label:'Defeat the kiln-bound guardians'}]},
  {id:'herald',journal:'In the crucible the Cinderbound Herald is pumping, louder every breath, and the floor is glowing. Tamber is nowhere to be seen; I think he climbed inside it.',
   onEnter:{cutscene:'herald'},
   objectives:[{type:'kill',target:'@forge.herald',amount:1,label:'Stop the Cinderbound Herald'},{type:'have',target:'custom_qa_heart_coal',amount:1,label:'Take the Herald’s heart-coal'}]},
  {id:'ember',journal:'The Herald fell apart, and Tamber with it. In the quiet a voice like slow bellows spoke from the crucible floor: the Emberwright, half awake, wants to know what Emberspire will do now.',
   npc:'@forge.ember',
   objectives:[{type:'talk',target:'@forge.ember',amount:1,label:'Answer the Emberwright’s Ember',dialogue:talk('Small one. A hundred years I have dreamed of hammers. Some of the dreams were pleasant.','Your people drank from me without asking. Now you ask. So. What is it you ask?')}],
   dialogue:{choice:talk('Shall I wake, and leave, and let your forges learn the cold? Or shall I sleep, and give you warmth, as a gift and not a theft?')},
   choices:[
    {id:'rekindle',label:'Wake and be free. Emberspire will learn to make its own fire.',flags:{rekindled:true},dialogue:talk('Free. I had forgotten the word. I will remember your name, small one, for a while. A long while, for you.')},
    {id:'bind',label:'Sleep, and lend us your warmth; we will pay you back every year.',flags:{bound:true},dialogue:talk('A gift. Yes. That is better than a chain. I will sleep warm, and your hammers will sing.')}]},
  {id:'debt',journal:'The Emberwright has its answer. The Herald’s heart-coal should go to Forgemistress Kade at the Anvilhall.',
   objectives:[{type:'collect',target:'custom_qa_heart_coal',amount:1,label:'Give the heart-coal to Forgemistress Kade'}]}],
 cutscenes:{
  below:scene('The Kiln Below','The Kiln Below','Under the scrubland',[['@forge.kessa','The Kindled who went below have not come back up. Be careful. Be quick. Be both.','Kessa Emberly']]),
  herald:scene('The Cinderbound Herald','The Cinderbound Herald','The crucible',[['@forge.ember','(Something huge stirs beneath the crucible floor, like a sleeper hearing its name.)','The Emberwright’s Ember']]),
  settled:scene('A debt settled','The debt is settled','The Anvilhall, Emberspire',[['@forge.nix','The Kindled Forge below is open to us now. Real anvils, real heat, honestly given. I may cry. I may already be crying.','Nix Calloway']])},
 onComplete:{cutscene:'settled'},
 journalDone:'Beneath the Kiln Door I broke the Kindled’s guardians and destroyed the Cinderbound Herald, with Tamber inside it. The Emberwright woke enough to ask what Emberspire would do, and I answered for the town. The Kindled Forge below is open to me, and an Emberwright’s Seal will always bring me back to the Anvilhall.',
 journalVariants:[{ifFlags:{rekindled:true},text:'I let the Emberwright wake and go free; Emberspire is learning to make its own fire.'},{ifFlags:{bound:true},text:'The Emberwright chose to sleep and lend its warmth as a gift, repaid every year.'}],
 gold:5000,xp:{smithing:60000,mining:40000,firemaking:35000,strength:30000},items:{custom_qa_ember_seal:1,'armor:emberOathGauntlets':1},
 lamps:[{amount:20000,minLevel:40,label:'Emberwright lamp (any skill of level 40+)'}],
 unlocks:[
  {type:'teleport',id:'teleport.anvilhall',label:'Emberwright’s Seal: the Anvilhall, Emberspire',x:264,z:200},
  {type:'area',id:'area.forge-kindled',label:'The Kindled Forge: anvil, furnace, rare-stock quartermaster and the Herald Reforged (harder mode)'},
  {type:'area',id:'lair:cindervault_crucible',label:'The Cindervault crucible: the Ashen Colossus stirs in sympathy'},
  {type:'flag',id:'forge.debt_settled',label:'Emberspire’s debt is settled'},
  {type:'dialogue',id:'dialogue.forge-kade-wake',label:'Kade learns the cold',npc:'@forge.kade',ifFlags:{rekindled:true},lines:talk('Our forges burn coal now, like everyone else’s. Slower. Honest. My blades have never been better, which is annoying.')},
  {type:'dialogue',id:'dialogue.forge-kade-gift',label:'Kade pays the gift back',npc:'@forge.kade',ifFlags:{bound:true},lines:talk('Every midsummer the guild carries the year’s first blade down to the Emberwright. It hums when we arrive. I think it likes the company.')},
  {type:'dialogue',id:'dialogue.forge-kessa-5',label:'Kessa leads the Kindled',npc:'@forge.kessa',lines:talk('The Kindled tend the shrine fire now, and nothing else. No salt. No golems. Just a fire, and a debt remembered.')},
  {type:'dialogue',id:'dialogue.forge-pike-5',label:'Pike’s readings',npc:'@forge.pike',lines:talk('The vents read steady. The deep shaft at Cindervault, though, reads hotter every day. Something down there felt the Emberwright stir.')}]}
];
