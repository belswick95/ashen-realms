// Arc 2 — The Long Winter (Winterwatch and the Frostbound north). Original Eldervale story.
// The wardfire beacons have gone dark, the trolls of the Rimeback are raiding for firewood, and
// something on the peaks is herding the cold down into the valleys.
import {npc,monster,shortcut,item,drop,talk,scene,room,tunnel} from './common.mjs';

const A='frontier';
export const arc={key:A,name:'The Long Winter',region:'Winterwatch and the Frostbound north',chain:'arc-frontier'};

export const npcs=[
 npc(A,1,'vossberg','knight','Marshal Ingrid Vossberg',214,-236,{yaw:90,dialogue:'Winterwatch holds because the beacons burn.\nWhen they go dark, everything north of here gets ideas.'}),
 npc(A,2,'pell','villager','Pell Ashby the Beacon-Keeper',262,-214,{yaw:180,dialogue:'Eastwatch beacon, keeper on duty. Awake on duty. Mostly.'}),
 npc(A,3,'rusk','healer','Mother Rusk',238,-228,{yaw:180,dialogue:'Salves, tinctures, and the truth, all bitter.\nSit by the fire. Not too close.'}),
 npc(A,4,'torvald','ranger','Torvald the Trapper',100,-248,{yaw:90,dialogue:'Frostfang pass. Wolves on the left, wolves on the right, wolves in the middle.'}),
 npc(A,5,'ottilie','farmer','Reeve Ottilie Marsh',258,-298,{yaw:0,dialogue:'Hearthmoor was a village once. It will be again, if I have to carry every stone.'}),
 npc(A,6,'hask','mage','Hask the Troll-Tongue',285,-315,{yaw:-90,dialogue:'I speak Troll, badly. They speak Common, worse. We manage.'})
];
export const monsters=[
 monster(A,1,'imp','peat_imp','Snuff imp',268,-210,{level:6,rank:'Common',arch:'caster',hostile:false,tint:0x8a9aa8,eyes:0x9ad8ff,breath:0xc8e8ff,examine:'It eats flames. Small ones. It is working up to big ones.'}),
 monster(A,2,'wolf1','frostfang_wolf','Starving frostfang',130,-258,{level:22,rank:'Common',arch:'swift',examine:'Ribs like a xylophone, teeth like knives.'}),
 monster(A,3,'wolf2','frostfang_wolf','Starving frostfang',136,-252,{level:22,rank:'Common',arch:'swift',examine:'Ribs like a xylophone, teeth like knives.'}),
 monster(A,4,'wolf3','frostfang_wolf','Starving frostfang',128,-246,{level:22,rank:'Common',arch:'swift',examine:'Ribs like a xylophone, teeth like knives.'}),
 monster(A,5,'wight','hoarfrost_wraith','Cairn-frost wight',292,-300,{level:32,rank:'Veteran',arch:'spirit',loot:[drop('custom_qa_frost_verse')],examine:'A shepherd’s ghost, still counting a flock of snowflakes.'}),
 monster(A,6,'thrall1','rimeback_troll','Frozen thrall',2224,3000,{level:50,rank:'Veteran',arch:'tank',tint:0xbfe3f2,eyes:0x7fd6ff,roam:1,respawn:45,examine:'A troll frozen in mid-stride and made to walk anyway.'}),
 monster(A,7,'thrall2','rimeback_troll','Frozen thrall',2226,3008,{level:50,rank:'Veteran',arch:'tank',tint:0xbfe3f2,eyes:0x7fd6ff,roam:1,respawn:45,examine:'A troll frozen in mid-stride and made to walk anyway.'}),
 monster(A,8,'shepherd','hoarfrost_wraith','The Pale Shepherd',2268,3000,{level:90,rank:'Boss',arch:'spirit',scale:2.2,tint:0xe8f4ff,eyes:0x9fe8ff,aura:0xbfefff,crown:true,roam:1,respawn:90,attackSpeed:3.6,
  loot:[drop('custom_qa_shepherds_crook')],examine:'Tall as a pine, thin as frost. It walks the winter down the mountain like a flock.'}),
 monster(A,9,'unbound','hoarfrost_wraith','The Pale Shepherd, Unbound',2226,3400,{level:110,rank:'Legendary',arch:'spirit',scale:2.6,tint:0xd4ecff,eyes:0xffffff,aura:0x9fdcff,crown:true,roam:1,respawn:300,attackSpeed:3.4,
  loot:[{item:'yewLogs',min:10,max:25,chance:1,always:true},{item:'runiteOre',min:1,max:2,chance:.35},{item:'cutGem',min:1,max:3,chance:.5}],examine:'The Shepherd, with nothing left to herd but you. Harder mode.'})
];
export const objects=[
 shortcut(A,1,{id:'rimeback_stair',template:'wall_climb',name:'Rimeback ice-stair',level:35,xp:30,fail:.2,failDamage:40,ticks:4,ends:[[268,-306],[277,-312]],unlock:'shortcut.frontier-ice-stair'})
];
export const items=[
 item('custom_qa_frost_verse','Frost-verse stone','A palm-sized slate scratched with an old shepherd’s song. The lines melt and refreeze as you read them.'),
 item('custom_qa_shepherds_crook','Pale Shepherd’s crook','A crook of blue ice that will not melt. Marshal Vossberg will want to see it.','gem'),
 item('custom_qa_wardstone','Wardstone of Hearthmoor','A warm grey stone on a cord, cut from the great beacon. Rub it to return to Hearthmoor.','gem')
];
export const areas=[{
 id:'rimeheart_grotto',name:'Rimeheart Grotto',theme:'earth',band:[45,110],origin:{x:2200,z:3000},enabled:true,
 blurb:'Ice caves under the Rimeback where the Pale Shepherd keeps its frozen flock. Opened by “The Wardstone Pact”.',
 levels:[
  {level:0,name:'Frozen galleries',rooms:[room('mouth',0,0,6,5),room('gallery',24,4,11,8),room('pillars',46,-8,10,8),room('sanctum',68,0,13,11)],
   tunnels:[tunnel(3,[0,0],[24,4]),tunnel(3,[24,4],[46,-8]),tunnel(3.2,[46,-8],[68,0])]},
  {level:1,name:'The Shepherd’s Fold',rooms:[room('landing',0,0,6,6),room('fold',26,0,14,11)],tunnels:[tunnel(3.4,[0,0],[26,0])]}],
 entrances:[
  {id:'mouth',kind:'cave_mouth',x:322,z:-362,yaw:180,name:'Rimeheart cave mouth',to:{level:0,x:2,z:0},requires:{unlock:'area.frontier-grotto'}},
  {id:'fold',kind:'cave_mouth',x:330,z:-356,yaw:180,name:'The Shepherd’s Fold',to:{level:1,x:2,z:0},requires:{unlock:'area.frontier-fold'}}],
 links:[],
 spawns:[{id:'wraiths',roster:'hoarfrost_wraith',count:3,level:0,room:'gallery'},{id:'trolls',roster:'rimeback_troll',count:2,level:0,room:'pillars'}],
 lights:[{level:0,x:3,z:-3,kind:'torch'},{level:0,x:24,z:10,kind:'crystal'},{level:0,x:46,z:-14,kind:'crystal'},{level:0,x:62,z:6,kind:'crystal'},{level:0,x:74,z:-6,kind:'crystal'},
  {level:1,x:3,z:3,kind:'torch'},{level:1,x:20,z:6,kind:'crystal'},{level:1,x:32,z:-6,kind:'crystal'}]}];

export const quests=[
{n:1,key:'arc-frontier-1',name:'Ashes on the Wardfires',questPoints:1,difficulty:'Novice',length:'Short',giver:'@frontier.vossberg',icon:'oakLogs',
 description:'The wardfire beacons that ring Winterwatch have gone dark one by one. Marshal Vossberg wants the Eastwatch beacon burning before nightfall.',
 dialogue:{
  offer:talk('You. You look like you can carry wood and swing a stick. Both skills are in short supply.','The wardfires keep the north honest. Three have gone dark this month and nobody can tell me why.','Get up to Eastwatch, find young Pell, and get that beacon lit. If he is asleep, wake him. Firmly.'),
  progress:talk('Is Eastwatch burning? I can see it from here, so: no.'),
  complete:talk('Trolls? Stealing firewood? Trolls do not steal firewood. Trolls do not feel the cold.','...Unless something has made them. I do not like the shape of that thought. Here, for your trouble.')},
 stages:[
  {id:'pell',journal:'Marshal Ingrid Vossberg asked me to relight the Eastwatch wardfire, on the hill east of Winterwatch. Its keeper is a young man called Pell Ashby.',
   objectives:[{type:'talk',target:'@frontier.pell',amount:1,label:'Find Pell Ashby at the Eastwatch beacon',dialogue:talk('I was not asleep! I was resting my eyes in a lookout posture.','Something keeps snuffing the fire. Little grey thing, all mouth. It ate my tinderbox. My second tinderbox.')}]},
  {id:'imp',journal:'Pell says a little grey creature keeps eating the beacon’s flames, and his tinderboxes. I should get rid of it before I try to light anything.',
   onEnter:{cutscene:'imp'},
   objectives:[{type:'kill',target:'@frontier.imp',amount:1,label:'Get rid of the snuff imp'}]},
  {id:'timber',journal:'The snuff imp is gone, but so is the beacon’s woodpile. I need to chop some logs and get a good fire going to show Pell I know how.',
   objectives:[{type:'event',event:'woodcut',amount:3,label:'Chop logs for the beacon'},{type:'xp',skill:'firemaking',amount:40,label:'Light a fire (Firemaking XP)'}]},
  {id:'tracks',journal:'With the beacon lit again, Pell showed me deep tracks in the snow leading east from the empty woodpile. Somebody big carried the firewood away. I should follow the tracks a little way.',
   objectives:[{type:'visit',x:274,z:-222,radius:4,amount:1,label:'Follow the tracks east from the beacon'}]},
  {id:'rusk',journal:'The tracks were troll tracks, and they carried the wood away carefully, like something precious. Mother Rusk at the Winterwatch Lodge knows more about trolls than anyone; I should ask her before I report to the Marshal.',
   objectives:[{type:'talk',target:'@frontier.rusk',amount:1,label:'Ask Mother Rusk about the troll tracks',dialogue:talk('Trolls carrying firewood? Hah. And next the fish will take up knitting.','...You are serious. Trolls are made of cold, child. A troll by a fire is a troll that is dying, or frightened of something colder.')}]}],
 cutscenes:{
  imp:scene('The snuff imp','Eastwatch beacon','East of Winterwatch',[['@frontier.pell','There! The grey one! It is looking at the fire like I look at pie.','Pell Ashby']]),
  lit:scene('Eastwatch burns','The first wardfire','Winterwatch',[['@frontier.vossberg','One beacon. One. And it took a stranger to light it. Fine. It is a start.','Marshal Ingrid Vossberg']])},
 onComplete:{cutscene:'lit'},
 journalDone:'I drove off a snuff imp and relit the Eastwatch wardfire. The missing firewood was carried off by trolls, which Mother Rusk says only happens when trolls are frightened of something colder than themselves.',
 gold:150,xp:{firemaking:1500,woodcutting:1000},lamps:[{perLevel:10,minLevel:5,label:'Wardfire lamp'}],
 unlocks:[
  {type:'flag',id:'frontier.eastwatch_lit',label:'The Eastwatch wardfire burns again'},
  {type:'dialogue',id:'dialogue.frontier-pell-1',label:'Pell stays awake',npc:'@frontier.pell',lines:talk('Fire’s burning, eyes are open. I have taken up humming. It helps. The wolves hate it.')}]},

{n:2,key:'arc-frontier-2',name:'The Hungry Pass',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@frontier.ottilie',icon:'trout',
 requirements:{quests:['arc-frontier-1'],skills:{fishing:{level:20,boostable:false},cooking:{level:20,boostable:false}}},
 description:'The grain promised from Birchford never came, and the ruined hamlet of Hearthmoor is going hungry. Reeve Ottilie Marsh needs food brought over the Frostfang pass.',
 dialogue:{
  offer:talk('Hearthmoor burned two winters ago. Twelve families came back anyway. Stubborn, like me.','Birchford promised us grain. Royal writs, royal seals. Nothing came. Not a sack.','Torvald the trapper runs a sled over the Frostfang pass. He needs fish for the cart and a strong arm for the wolves. Will you?'),
  progress:talk('The children are eating snow and pretending it is porridge. They are very good at pretending.'),
  complete:talk('Bread! And fish! Torvald, you old goat, you came through.','Thank you. Truly. Hearthmoor will remember who fed it in the long winter.')},
 branchDialogue:[{stage:'complete',ifFlags:{fed_trolls:true},lines:talk('Bread and fish, and less than there might have been. You fed the trolls, I hear.','...My grandmother would have spat. I think she would have been wrong. Thank you.')}],
 stages:[
  {id:'trapper',journal:'Reeve Ottilie Marsh of Hearthmoor told me the grain promised from Birchford never arrived. Torvald the trapper, at the west end of the Frostfang pass, runs a sled over the mountains.',
   npc:'@frontier.torvald',
   objectives:[{type:'talk',target:'@frontier.torvald',amount:1,label:'Find Torvald the Trapper at the Frostfang pass',dialogue:talk('Hearthmoor again? My traps are empty, my sled is empty, and my wife says my head is empty.','Bring me fish and I will haul them. Cooked; raw fish freezes into a club up there.')}]},
  {id:'catch',journal:'Torvald will run his sled to Hearthmoor if I bring him four cooked trout. Raw fish freeze solid on the pass.',
   npc:'@frontier.torvald',
   objectives:[{type:'collect',target:'trout',amount:4,label:'Bring Torvald four cooked trout'}],
   dialogue:{advance:talk('Good fish. Now walk ahead of the sled and keep your eyes on the treeline. The wolves are hungrier than we are.')}},
  {id:'ford',journal:'Torvald loaded the sled and asked me to walk ahead of him over the pass, starting with the frozen ford.',
   onEnter:{cutscene:'sled'},
   objectives:[{type:'visit',x:132,z:-252,radius:6,amount:1,label:'Lead the sled to the frozen ford'}]},
  {id:'wolves',journal:'At the frozen ford a pack of starving frostfang wolves came out of the trees for the sled.',
   objectives:[{type:'event',event:'death',targets:['@frontier.wolf1','@frontier.wolf2','@frontier.wolf3'],amount:3,label:'Drive off the starving frostfangs'}]},
  {id:'scouts',journal:'Past the ford, near Hearthmoor, two young trolls were crouched in the snow, thin as rakes and shivering. Reeve Ottilie came out to meet the sled and saw them too.',
   npc:'@frontier.ottilie',
   objectives:[{type:'visit',x:240,z:-292,radius:5,amount:1,label:'Bring the sled past the troll scouts to Hearthmoor'}],
   dialogue:{choice:talk('Trolls. At my gate. Burned my village, their kind did, or their cousins did.','They look starving. So do we. It is your sled now as much as Torvald’s. You decide.')},
   choices:[
    {id:'feed',label:'Leave a share of the fish for the trolls.',flags:{fed_trolls:true},dialogue:talk('...Fine. Fine! But if they come back for seconds, you are the one telling them no.')},
    {id:'drive',label:'Drive the trolls off. Hearthmoor eats first.',flags:{drove_trolls:true},dialogue:talk('Good. Hard, but good. They will not forget it, mind. Neither will I.')}]},
  {id:'bread',journal:'The sled is at Hearthmoor. Ottilie still needs three loaves of bread for the children before she will call the run a success.',
   objectives:[{type:'collect',target:'bread',amount:3,label:'Bring Reeve Ottilie three loaves of bread'}]}],
 cutscenes:{
  sled:scene('Over the pass','The Frostfang pass','Between Winterwatch and the west',[['@frontier.torvald','Walk ahead, stay on the packed snow, and if you hear howling, do not howl back. It encourages them.','Torvald the Trapper']]),
  fed:scene('Hearthmoor eats','Hearthmoor eats','The ruins of Hearthmoor',[['@frontier.ottilie','Twelve families, one sled, one stranger. Not bad for a winter that was meant to finish us.','Reeve Ottilie Marsh']])},
 onComplete:{cutscene:'fed'},
 journalDone:'I helped Torvald run a sled of cooked trout over the Frostfang pass to Hearthmoor, driving off a starving wolf pack on the way, and brought bread for the children.',
 journalVariants:[{ifFlags:{fed_trolls:true},text:'I left a share of the food for two starving young trolls at Hearthmoor’s gate.'},{ifFlags:{drove_trolls:true},text:'I drove two starving young trolls away from Hearthmoor’s gate.'}],
 gold:400,xp:{fishing:6000,cooking:5000,strength:3000},lamps:[{perLevel:10,minLevel:10,label:'Sled-runner’s lamp'}],
 unlocks:[
  {type:'flag',id:'frontier.hearthmoor_fed',label:'Hearthmoor survives the winter'},
  {type:'dialogue',id:'dialogue.frontier-torvald-2',label:'Torvald’s sled runs again',npc:'@frontier.torvald',lines:talk('Two runs a week to Hearthmoor now. The wolves have started waiting politely by the ford. I do not trust it.')},
  {type:'dialogue',id:'dialogue.frontier-ottilie-fed',label:'Ottilie remembers the trolls',npc:'@frontier.ottilie',ifFlags:{fed_trolls:true},lines:talk('Those two young trolls left a pile of firewood by my gate last night. Neatly stacked. I am not crying, it is the cold.')},
  {type:'dialogue',id:'dialogue.frontier-ottilie-drove',label:'Ottilie keeps watch',npc:'@frontier.ottilie',ifFlags:{drove_trolls:true},lines:talk('No trolls at the gate since. I sleep with a poker, all the same.')}]},

{n:3,key:'arc-frontier-3',name:'Under the Rimeback',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@frontier.rusk',icon:'custom_qa_frost_verse',
 requirements:{quests:['arc-frontier-2','arc-forge-2'],skills:{agility:{level:25,boostable:false},herblore:{level:15,boostable:false}}},
 description:'Mother Rusk believes the trolls are fleeing something on the peaks. She wants someone to go up the Rimeback and ask them. Politely.',
 dialogue:{
  offer:talk('Trolls do not run from men. They do not run from wolves. They run from one thing in all my grandmother’s stories.','The Pale Shepherd. A cold that walks, and herds the winter down the mountain like sheep.','There is a hermit in the Rimeback foothills, Hask, who speaks Troll. Badly. Go and ask him what the trolls are running from.'),
  progress:talk('Well? Did Hask make sense? He rarely does before noon.'),
  complete:talk('The song of the hearth. Of course. My grandmother sang it to frighten the frost out of the windows.','Take this, and keep that stone. We will need its song again, I think.')},
 stages:[
  {id:'hask',journal:'Mother Rusk fears the trolls are fleeing the Pale Shepherd, a walking cold from her grandmother’s stories. Hask the Troll-Tongue, a hermit in the Rimeback foothills south-east of Hearthmoor, may know.',
   objectives:[{type:'talk',target:'@frontier.hask',amount:1,label:'Ask Hask the Troll-Tongue what the trolls fear',dialogue:talk('They say: tall-cold-walker. They say: it takes the young ones and makes them stop. Stop moving. Stop being warm.','There is an old cairn up the slope where the shepherds sang to keep it away. The trolls will not go near it now. Something guards it.')}]},
  {id:'cairn',journal:'Hask says the trolls call it the tall-cold-walker, and that it freezes their young. An old shepherds’ cairn up the slope from his camp was where people once sang to keep it away.',
   objectives:[{type:'visit',x:290,z:-303,radius:4,amount:1,label:'Climb to the old shepherds’ cairn'}]},
  {id:'wight',journal:'The cairn is guarded by the ghost of a shepherd, rimed with frost and still counting its flock.',
   onEnter:{cutscene:'cairn'},
   objectives:[{type:'kill',target:'@frontier.wight',amount:1,label:'Lay the cairn-frost wight to rest'},{type:'have',target:'custom_qa_frost_verse',amount:1,label:'Pick up the frost-verse stone'}]},
  {id:'salve',journal:'The wight left a slate scratched with an old song. Mother Rusk can read the old shepherds’ marks, and she will want herbs to brew a thaw-salve while she does.',
   npc:'@frontier.rusk',
   objectives:[{type:'collect',target:'cleanHerb',amount:3,label:'Bring Mother Rusk three clean herbs'},{type:'have',target:'custom_qa_frost_verse',amount:1,label:'Show her the frost-verse stone'}],
   dialogue:{advance:talk('Three songs on one stone. The shepherds sang one of them to drive the cold back. Which one, though?','“The hunt that runs before the snow. The hearth that waits behind the door. The flock that sleeps beneath the stars.” Think, child. What does the cold fear?')}},
  {id:'riddle',journal:'The stone holds three shepherds’ songs: of the hunt that runs before the snow, of the hearth that waits behind the door, and of the flock that sleeps beneath the stars. Only one drove the cold back. Mother Rusk wants my answer.',
   npc:'@frontier.rusk',
   objectives:[{type:'talk',target:'@frontier.rusk',amount:1,label:'Tell Mother Rusk which song drives back the cold'}],
   dialogue:{choice:talk('Well? Which song?')},
   choices:[
    {id:'hearth',label:'The hearth that waits behind the door.',next:'warn',flags:{knew_hearth:true},dialogue:talk('Yes. Warmth that waits for someone to come home. The cold cannot bear it.')},
    {id:'hunt',label:'The hunt that runs before the snow.',next:'think',dialogue:talk('The hunt runs from the snow, child. That is a song for losing. Go and ask Hask what the trolls sing.')},
    {id:'flock',label:'The flock that sleeps beneath the stars.',next:'think',dialogue:talk('A sleeping flock is what the Shepherd wants. Go and ask Hask what the trolls sing.')}]},
  {id:'think',journal:'My answer was wrong. Mother Rusk sent me back to Hask to ask what the trolls sing when they are frightened.',next:'riddle',
   objectives:[{type:'talk',target:'@frontier.hask',amount:1,label:'Ask Hask what the trolls sing',dialogue:talk('Trolls sing about a cave with a fire in it and someone waiting. It is the saddest song they have. They have never had one.')}]},
  {id:'warn',journal:'The shepherds’ song is the song of the hearth. Mother Rusk says the Marshal must hear about the Pale Shepherd before it comes down to the valley.',
   objectives:[{type:'talk',target:'@frontier.vossberg',amount:1,label:'Warn Marshal Vossberg about the Pale Shepherd',dialogue:talk('A walking winter. Herding trolls. Wonderful. Any more good news? No? Then thank Rusk for me.')}]}],
 cutscenes:{
  cairn:scene('The shepherds’ cairn','The shepherds’ cairn','The Rimeback foothills',[['@frontier.hask','Careful. The trolls say the cairn counts you. If it reaches a number it likes, it keeps you.','Hask the Troll-Tongue']]),
  song:scene('The song of the hearth','The song of the hearth','The Winterwatch Lodge',[['@frontier.rusk','Every window in this town has a candle in it on the longest night. Now you know why.','Mother Rusk']])},
 onComplete:{cutscene:'song'},
 journalDone:'Hask the Troll-Tongue told me the trolls flee the Pale Shepherd. At an old shepherds’ cairn I laid a frost-wight to rest and found a stone of songs; Mother Rusk and I worked out that the song of the hearth drives the cold back. Marshal Vossberg has been warned.',
 gold:500,xp:{herblore:6000,agility:5000,prayer:3000},lamps:[{perLevel:10,minLevel:15,label:'Hearth-song lamp'}],
 unlocks:[
  {type:'flag',id:'frontier.hearth_song',label:'Winterwatch remembers the song of the hearth'},
  {type:'dialogue',id:'dialogue.frontier-hask-3',label:'Hask trusts you',npc:'@frontier.hask',lines:talk('The trolls call you warm-walker now. It is either a great honour or a recipe. Their grammar is unclear.')}]},

{n:4,key:'arc-frontier-4',name:'The Wardstone Pact',questPoints:3,difficulty:'Experienced',length:'Long',giver:'@frontier.vossberg',icon:'willowLogs',
 requirements:{quests:['arc-frontier-3'],qp:16,skills:{firemaking:{level:35,boostable:false},woodcutting:{level:35,boostable:false},defence:{level:30,boostable:false}}},
 description:'The great wardfire on the Rimeback summit has been dark for a generation. If it burns, the whole north will see it. So will the Pale Shepherd.',
 dialogue:{
  offer:talk('Rusk says a fire and a song drive this thing back. Fine. I have the biggest fire in the north, if anyone can light it.','The summit beacon on the Rimeback. Dark since my mother was Marshal. The trolls hold the crags around it now.','Take Pell. He hates heights. It builds character.'),
  progress:talk('Can I see the summit burning? I cannot. Climb.'),
  complete:talk('The summit burns. The whole north can see it from here. My mother would have wept. I nearly did.','Ottilie says Hearthmoor will rebuild under that light. And the cave the Shepherd hides in is open to us. Take these boots; they belonged to the last Marshal who climbed it.')},
 branchDialogue:[{stage:'complete',ifFlags:{pact_broken:true},lines:talk('The summit burns, and the troll caves are marked on my map. A bounty is a bounty.','I will not pretend it sits easy. Take these boots; the cave the Shepherd hides in is open to us.')}],
 stages:[
  {id:'willow',journal:'Marshal Vossberg wants the great wardfire on the Rimeback summit lit again. Pell will carry the tinder if I bring ten willow logs; he is terrified of heights.',
   npc:'@frontier.pell',
   objectives:[{type:'collect',target:'willowLogs',amount:10,label:'Bring Pell ten willow logs'}],
   dialogue:{advance:talk('Ten logs. Up there. With me. I am going to be brave about this. Starting... now. No. Now.')}},
  {id:'summit',journal:'Pell is coming, slowly, with the tinder. I have to reach the old summit beacon on the Rimeback crags, through the trolls that hold them.',
   onEnter:{cutscene:'climb'},
   objectives:[{type:'visit',x:306,z:-346,radius:5,amount:1,label:'Reach the summit beacon on the Rimeback'}]},
  {id:'kindle',journal:'The summit beacon is a great bowl of black iron, full of snow. I need to clear it and get a proper fire going.',
   objectives:[{type:'xp',skill:'firemaking',amount:300,label:'Kindle the great wardfire (Firemaking XP)'},{type:'xp',skill:'woodcutting',amount:200,label:'Cut kindling on the summit (Woodcutting XP)'}]},
  {id:'pact',journal:'The great wardfire is burning. The trolls came out of the crags to stare at it, and Hask came up behind them, breathless. They want to talk.',
   npc:'@frontier.hask',
   objectives:[{type:'talk',target:'@frontier.hask',amount:1,label:'Meet Hask and the trolls below the summit',dialogue:talk('They say: the fire is a hearth. They say: warm-walker made a hearth for everyone.','They offer a pact. They will guard the summit fire and the pass, if Winterwatch lets their young winter by the wardfires.')}],
   dialogue:{choice:talk('Or. The Marshal pays a bounty for every troll cave found. They have just shown you where theirs are. Your choice, warm-walker.')},
   choices:[
    {id:'pact',label:'Swear the pact. The fires are for everyone.',flags:{pact_sworn:true},dialogue:talk('They are... singing. Badly. It is the hearth song. I think it is the first time they have ever sung it happy.')},
    {id:'bounty',label:'Report the troll caves for the Marshal’s bounty.',flags:{pact_broken:true},dialogue:talk('Then go. And do not come back to my camp. They will not forget this, and neither will I.')}]},
  {id:'hearthmoor',journal:'I have made my decision about the trolls. Reeve Ottilie should hear that the great wardfire is burning over Hearthmoor before I report to the Marshal.',
   objectives:[{type:'talk',target:'@frontier.ottilie',amount:1,label:'Tell Reeve Ottilie the summit burns',dialogue:talk('I saw it! The whole valley saw it. We are rebuilding by its light. Starting with the bakery, obviously.')}]}],
 cutscenes:{
  climb:scene('The Rimeback climb','The Rimeback','Above Hearthmoor',[['@frontier.pell','I am fine. This is fine. Do not look down. I looked down. Why did I look down.','Pell Ashby']]),
  summit:scene('The great wardfire','The great wardfire','The Rimeback summit',[['@frontier.vossberg','There it is. Every farm from here to the pass can see it. And somewhere up there, something cold has just noticed.','Marshal Ingrid Vossberg']])},
 onComplete:{cutscene:'summit'},
 journalDone:'I carried willow up the Rimeback with Pell and lit the great wardfire on the summit for the first time in a generation. Hearthmoor is rebuilding by its light, and the Marshal opened the way to the cave where the Pale Shepherd hides.',
 journalVariants:[{ifFlags:{pact_sworn:true},text:'I swore a pact with the trolls: they guard the fires, and their young winter by them.'},{ifFlags:{pact_broken:true},text:'I reported the troll caves for the Marshal’s bounty.'}],
 gold:1200,xp:{firemaking:20000,woodcutting:15000,defence:15000},items:{'armor:pathfinderBoots':1},lamps:[{amount:15000,minLevel:30,label:'Summit lamp (any skill of level 30+)'}],
 unlocks:[
  {type:'area',id:'area.frontier-grotto',label:'Rimeheart Grotto, under the Rimeback'},
  {type:'shortcut',id:'shortcut.frontier-ice-stair',label:'Rimeback ice-stair from Hearthmoor (Agility 35)'},
  {type:'flag',id:'frontier.summit_lit',label:'The great wardfire burns on the Rimeback'},
  {type:'dialogue',id:'dialogue.frontier-hask-pact',label:'Hask keeps the pact',npc:'@frontier.hask',ifFlags:{pact_sworn:true},lines:talk('The young trolls winter by the Eastwatch fire now. Pell taught them to hum. Everyone regrets it.')},
  {type:'dialogue',id:'dialogue.frontier-hask-broken',label:'Hask will not speak to you',npc:'@frontier.hask',ifFlags:{pact_broken:true},lines:talk('Go away, bounty-walker. The caves are empty now. You made sure of that.')}]},

{n:5,key:'arc-frontier-5',name:'The Pale Shepherd',questPoints:5,difficulty:'Master',length:'Very long',giver:'@frontier.vossberg',icon:'custom_qa_wardstone',
 requirements:{quests:['arc-frontier-1','arc-frontier-2','arc-frontier-3','arc-frontier-4'],qp:34,skills:{firemaking:{level:45,boostable:false},woodcutting:{level:45,boostable:false},agility:{level:40,boostable:false},prayer:{level:35,boostable:false}},combat:60},
 description:'The Pale Shepherd has seen the great wardfire. Every night the cold creeps further down the Rimeback. Marshal Vossberg wants it finished, in its own cave.',
 dialogue:{
  offer:talk('Frost on the inside of my windows. In my own hall. It is coming down to look at us.','Rusk says it hides in the Rimeheart Grotto, under the crags, with its frozen flock. Fire and the hearth song.','> Then I’ll bring both.','Take the braziers up with you. Pell has volunteered. Pell does not know he has volunteered yet.'),
  progress:talk('The cold is in the well now. Hurry.'),
  complete:talk('Its crook. Ice that will not melt, even here by the fire. So it is truly gone.','Hearthmoor is a village again, the pass is open, and the north will not freeze this winter. Take the Aegis of the last Warden. And this stone, cut from the summit fire: it will always bring you home to Hearthmoor.')},
 branchDialogue:[{stage:'complete',ifFlags:{pact_sworn:true},lines:talk('Its crook. And Hask tells me trolls carried the braziers to the cave mouth for you. Trolls! Carrying fire!','Take the Aegis of the last Warden, and this stone from the summit fire: it will always bring you home to Hearthmoor.')}],
 stages:[
  {id:'rally',journal:'The Pale Shepherd is creeping down from the peaks. Marshal Vossberg wants it destroyed in its cave, the Rimeheart Grotto under the Rimeback. Hask may know the way in.',
   objectives:[{type:'talk',target:'@frontier.hask',amount:1,label:'Ask Hask about the Rimeheart Grotto',dialogue:talk('The cave breathes cold. The Shepherd keeps frozen trolls inside, standing, like statues that walk.','Fire and the song. If you carry the fire, the song will find you.')}]},
  {id:'braziers',journal:'Hask says the Shepherd keeps frozen trolls as its flock. I need fuel for the braziers we will carry in: six maple logs, for Pell to pack.',
   npc:'@frontier.pell',
   objectives:[{type:'collect',target:'mapleLogs',amount:6,label:'Bring Pell six maple logs for the braziers'}],
   dialogue:{advance:talk('Braziers packed. I will stay at the cave mouth and keep them burning. Bravely. From the cave mouth.')}},
  {id:'descend',journal:'Pell is keeping the braziers burning at the Rimeheart cave mouth. Time to go in.',
   onEnter:{cutscene:'grotto'},
   objectives:[{type:'visit',x:2224,z:3004,radius:7,amount:1,label:'Enter the frozen galleries of Rimeheart Grotto'}]},
  {id:'thralls',journal:'The frozen galleries are full of the Shepherd’s flock: trolls frozen mid-stride and made to walk.',
   objectives:[{type:'event',event:'death',targets:['@frontier.thrall1','@frontier.thrall2'],amount:2,label:'Shatter the frozen thralls'}]},
  {id:'pillars',journal:'Beyond the thralls stand three pillars of blue ice, humming with the Shepherd’s cold. The hearth song says “the hearth that waits behind the door”: I should warm each pillar in turn before the Shepherd’s door.',
   objectives:[{type:'visit',x:2242,z:2988,radius:2.5,amount:1,label:'Warm the western ice pillar'},{type:'visit',x:2250,z:2988,radius:2.5,amount:1,label:'Warm the eastern ice pillar'},{type:'visit',x:2246,z:2998,radius:2.5,amount:1,label:'Warm the pillar by the door'}]},
  {id:'shepherd',journal:'The pillars cracked and the door to the sanctum groaned open. The Pale Shepherd is waiting inside.',
   onEnter:{cutscene:'shepherd'},
   objectives:[{type:'kill',target:'@frontier.shepherd',amount:1,label:'Defeat the Pale Shepherd'},{type:'have',target:'custom_qa_shepherds_crook',amount:1,label:'Take the Pale Shepherd’s crook'}]},
  {id:'home',journal:'The Pale Shepherd is gone. Its crook of unmelting ice should go to Marshal Vossberg in Winterwatch.',
   objectives:[{type:'collect',target:'custom_qa_shepherds_crook',amount:1,label:'Give the crook to Marshal Vossberg'}]}],
 cutscenes:{
  grotto:scene('Rimeheart Grotto','Rimeheart Grotto','Under the Rimeback',[['@frontier.pell','I will be right here. Feeding the fire. Not crying. Go on.','Pell Ashby']]),
  shepherd:scene('The Pale Shepherd','The Pale Shepherd','The Rimeheart sanctum',[['@frontier.hask','(Far behind you, faintly, somebody is singing the hearth song. Badly. In Troll.)','Hask the Troll-Tongue']]),
  thaw:scene('The thaw','The long winter ends','Hearthmoor',[['@frontier.ottilie','Roofs on every house. Bread in every oven. And the wardfire over all of it. Welcome home, whoever you are.','Reeve Ottilie Marsh']])},
 onComplete:{cutscene:'thaw'},
 journalDone:'I carried fire into Rimeheart Grotto, shattered the Pale Shepherd’s frozen flock, warmed its ice pillars by the hearth song and destroyed the Shepherd in its sanctum. The long winter is over: Hearthmoor is rebuilt, and a wardstone from the summit fire will always bring me back there.',
 journalVariants:[{ifFlags:{pact_sworn:true},text:'The trolls carried the braziers to the cave for me, keeping the pact.'}],
 gold:5000,xp:{firemaking:60000,woodcutting:40000,prayer:30000,agility:30000},items:{custom_qa_wardstone:1,'shield:wardensAegis':1},
 lamps:[{amount:20000,minLevel:40,label:'Wardfire lamp (any skill of level 40+)'}],
 unlocks:[
  {type:'teleport',id:'teleport.hearthmoor',label:'Wardstone of Hearthmoor: the rebuilt village',x:258,z:-294},
  {type:'area',id:'area.frontier-fold',label:'The Shepherd’s Fold: the Pale Shepherd, Unbound (harder mode)'},
  {type:'area',id:'lair:rimecoil_cavern',label:'Rimecoil Cavern: Frostmaw, the Glacier Wyrm, wakes in the thaw'},
  {type:'flag',id:'frontier.hearthmoor_rebuilt',label:'Hearthmoor is rebuilt'},
  {type:'dialogue',id:'dialogue.frontier-ottilie-5',label:'Hearthmoor rebuilt',npc:'@frontier.ottilie',lines:talk('Roofs, ovens, a well that does not freeze. The children have named a goat after you. It bites. It is an honour.')},
  {type:'dialogue',id:'dialogue.frontier-vossberg-5',label:'The Marshal’s thanks',npc:'@frontier.vossberg',lines:talk('The beacons burn, the pass is open, and nothing herds the winter but the winter. You did that.','Though with the thaw, the ice cleft by the Frostmaw eyrie has opened. Something big is breathing in there. Take the Aegis when you go.')},
  {type:'dialogue',id:'dialogue.frontier-rusk-5',label:'Mother Rusk’s blessing',npc:'@frontier.rusk',lines:talk('I sang the hearth song in the square last night and everyone joined in. Even the Marshal. She sings like a gate.')},
  {type:'dialogue',id:'dialogue.frontier-pell-5',label:'Pell, hero of the cave mouth',npc:'@frontier.pell',lines:talk('I kept the braziers burning for six hours. Alone. In a cave. I am telling everyone. I have already told everyone.')}]}
];
