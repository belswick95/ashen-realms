// Arc 4 — The Drowned Choir (Saltglass Bay and the fens). Original Eldervale story.
// At low tide the fishermen of Saltglass hear bells under the bay: the choir of Old Corrow, a town
// the sea took two hundred years ago, is still singing. Someone made sure nobody heard the warning.
import {npc,monster,item,drop,talk,scene,room,tunnel} from './common.mjs';

const A='tide';
export const arc={key:A,name:'The Drowned Choir',region:'Saltglass Bay and the fens',chain:'arc-tide'};

export const npcs=[
 npc(A,1,'tidewell','guard','Harbourmaster Corwen Tidewell',306,340,{yaw:180,dialogue:'Saltglass harbour. Tides, tolls and trouble. Mostly tolls.'}),
 npc(A,2,'agathe','villager','Agathe the Net-Mender',316,333,{yaw:-90,dialogue:'Every net tells a story. Mostly the story is “a crab did this”.'}),
 npc(A,3,'tobin','villager','Little Tobin',294,352,{yaw:180,dialogue:'Do you hear the bells? Grown-ups never hear the bells.',extra:{scale:.78}}),
 npc(A,4,'moss','healer','Grandmother Moss',-190,262,{yaw:90,dialogue:'Mind the bog, mind the eels, mind your manners. In that order.'}),
 npc(A,5,'reedly','villager','Ferryman Ambrose Reedly',-178,252,{yaw:90,dialogue:'The Mirewater ferry. Fens to the bay by the old channels, if you know the way. I know the way.'}),
 npc(A,6,'ilse','mage','Scholar Ilse Quillon',282,340,{yaw:90,dialogue:'Old Corrow had a library, a choir and a harbour. The sea kept all three. I would like them back.'}),
 npc(A,7,'echo','mage','Echo of Old Corrow',3878,3008,{yaw:-90,dialogue:'(A voice made of many voices, singing very quietly.) Is it time? Is it finally time?'}),
 npc(A,8,'salvager','merchant','Bell-Salvager Odile',3820,3404,{yaw:180,dialogue:'Everything the sea gives back, I sell. Everything the sea keeps, I dive for.',
  shop:{harpoon:{buy:45,sell:14,stock:10},lobsterPot:{buy:40,sell:12,stock:10},rawSwordfish:{buy:180,sell:55,stock:20},rawStormfin:{buy:420,sell:130,stock:10},tidesteelArrowtips:{buy:30,sell:9,stock:300}}})
];
export const monsters=[
 monster(A,1,'eel1','peat_imp','Bog eel-thief',-196,270,{level:9,rank:'Common',arch:'caster',examine:'It has stolen an eel. It is wearing the eel. Why is it wearing the eel?'}),
 monster(A,2,'eel2','peat_imp','Bog eel-thief',-186,272,{level:9,rank:'Common',arch:'caster',examine:'It has stolen an eel. It is wearing the eel. Why is it wearing the eel?'}),
 monster(A,3,'chorister1','marsh_wight','Drowned chorister',-250,290,{level:28,rank:'Common',arch:'spirit',loot:[drop('custom_qa_hymn_leaf')],examine:'It is still holding its hymn book. The pages are kelp.'}),
 monster(A,4,'chorister2','marsh_wight','Drowned chorister',-256,296,{level:28,rank:'Common',arch:'spirit',loot:[drop('custom_qa_hymn_leaf')],examine:'It is still holding its hymn book. The pages are kelp.'}),
 monster(A,5,'chorister3','marsh_wight','Drowned chorister',-246,300,{level:28,rank:'Common',arch:'spirit',loot:[drop('custom_qa_hymn_leaf')],examine:'It is still holding its hymn book. The pages are kelp.'}),
 monster(A,6,'warden1','crypt_warden','Bell-warden of Corrow',3822,2998,{level:52,rank:'Veteran',arch:'bones',tint:0x6f8f8a,roam:1,respawn:45,examine:'It guards the bell-ropes. Nobody told it they were cut.'}),
 monster(A,7,'warden2','crypt_warden','Bell-warden of Corrow',3826,3004,{level:52,rank:'Veteran',arch:'bones',tint:0x6f8f8a,roam:1,respawn:45,examine:'It guards the bell-ropes. Nobody told it they were cut.'}),
 monster(A,8,'choirmistress','marsh_wight','The Choirmistress Below',3870,3002,{level:88,rank:'Boss',arch:'spirit',scale:2.1,tint:0x4f7f86,eyes:0xb8fff2,aura:0x7fe0d8,crown:true,roam:1,respawn:90,attackSpeed:3.6,
  loot:[drop('custom_qa_corrow_bell')],examine:'She rang the warning bell until the rope was cut. She has been ringing nothing ever since.'}),
 monster(A,9,'lament','marsh_wight','The Choirmistress’s Lament',3848,3400,{level:110,rank:'Legendary',arch:'spirit',scale:2.5,tint:0x3a6a72,eyes:0xffffff,aura:0x5fd8e8,crown:true,roam:1,respawn:300,attackSpeed:3.4,
  loot:[{item:'rawStormfin',min:2,max:5,chance:1,always:true},{item:'silverBar',min:2,max:6,chance:.5},{item:'cutGem',min:1,max:3,chance:.5}],examine:'Her grief, given a shape and a deeper room. Harder mode.'})
];
export const objects=[];
export const items=[
 item('custom_qa_hymn_leaf','Kelp hymn leaf','A page of the drowned choir’s hymn book, written on pressed kelp. Scholar Ilse can read it.'),
 item('custom_qa_corrow_bell','Corrow warning bell','A small silver hand-bell, green with two centuries of sea. It still rings true. Scholar Ilse is waiting for it.','gem'),
 item('custom_qa_tidebell','Tidebell of Corrow','A bell-shaped silver pendant that hums at low tide. Ring it to return to the Drowned Steps at Saltglass.','gem')
];
export const areas=[{
 id:'sunken_choir',name:'The Sunken Choir',theme:'crypt',band:[45,110],origin:{x:3800,z:3000},enabled:true,
 blurb:'The drowned chapel of Old Corrow under Saltglass Bay, where the choir still sings. Opened by “The Harbourmaster’s Ledger”.',
 levels:[
  {level:0,name:'The drowned nave',rooms:[room('steps',0,0,6,5),room('nave',24,0,11,8),room('alcoves',48,-6,10,8),room('apse',72,2,13,11)],
   tunnels:[tunnel(3,[0,0],[24,0]),tunnel(3,[24,0],[48,-6]),tunnel(3.2,[48,-6],[72,2])]},
  {level:1,name:'The bell loft',rooms:[room('landing',0,0,6,6),room('loft',22,0,12,9),room('lament',48,0,13,11)],tunnels:[tunnel(3.2,[0,0],[22,0]),tunnel(3.4,[22,0],[48,0])]}],
 entrances:[
  {id:'steps',kind:'crypt_door',x:322,z:360,yaw:180,name:'The Drowned Steps',to:{level:0,x:2,z:0},requires:{unlock:'area.tide-steps'}},
  {id:'loft',kind:'trapdoor',x:330,z:360,yaw:180,name:'The bell-loft hatch',to:{level:1,x:2,z:0},requires:{unlock:'area.tide-loft'}}],
 links:[],
 spawns:[{id:'wights',roster:'marsh_wight',count:3,level:0,room:'nave'}],
 lights:[{level:0,x:3,z:-3,kind:'torch'},{level:0,x:24,z:6,kind:'fungus'},{level:0,x:48,z:-12,kind:'crystal'},{level:0,x:66,z:8,kind:'fungus'},{level:0,x:78,z:-4,kind:'crystal'},
  {level:1,x:3,z:3,kind:'torch'},{level:1,x:22,z:7,kind:'fungus'},{level:1,x:48,z:8,kind:'crystal'}]}];

export const quests=[
{n:1,key:'arc-tide-1',name:'Bells Beneath the Tide',questPoints:1,difficulty:'Novice',length:'Short',giver:'@tide.tidewell',icon:'rawShrimp',
 description:'At low tide the nets of Saltglass come up torn, and the fishermen swear they hear bells under the bay. Harbourmaster Tidewell would like it to stop. Quietly.',
 dialogue:{
  offer:talk('Torn nets every low tide. My fishermen blame bells. Under the sea. Ringing.','There are no bells under the sea. There is a reef, and there are idiots. Find out which is tearing my nets.','> And if it is bells?','Then find out quietly. Bells are bad for business.'),
  progress:talk('Well? Reef or idiots?'),
  complete:talk('Bells. Under the bay. And a child who sings a hymn nobody has sung in two hundred years.','...Keep this to yourself, would you? Here. For your trouble. And your silence.')},
 stages:[
  {id:'agathe',journal:'Harbourmaster Tidewell asked me to find out what tears the Saltglass nets at low tide. Agathe the Net-Mender, by the net loft, sees every torn net in the harbour.',
   objectives:[{type:'talk',target:'@tide.agathe',amount:1,label:'Ask Agathe the Net-Mender about the torn nets',dialogue:talk('Reef? Pah. Reefs fray a net. These are cut clean, like something swung through them. Something metal.','Mend me this one and catch something with it, and you will see for yourself.')}]},
  {id:'mend',journal:'Agathe says the nets are cut clean, as if by swinging metal. She will lend me a net if I help her mend it with two lengths of thread.',
   npc:'@tide.agathe',
   objectives:[{type:'collect',target:'thread',amount:2,label:'Bring Agathe two lengths of thread'}],
   dialogue:{advance:talk('There. Good as new, or as good as anything is around here. Go and fish with it at low tide.')}},
  {id:'fish',journal:'Agathe mended the net. I should fish at Saltglass and see what comes up.',
   objectives:[{type:'event',event:'fishing',amount:3,label:'Fish in Saltglass Bay with Agathe’s net'}]},
  {id:'listen',journal:'Every catch came up with weed wrapped round a scrap of old bell-rope. At dusk the fishermen listen along the western shore. I should listen where the shore bends: at the cove, the point and the long strand.',
   onEnter:{cutscene:'bells'},
   objectives:[{type:'visit',x:284,z:370,radius:4,amount:1,label:'Listen at the cove by the landing'},{type:'visit',x:262,z:375,radius:4,amount:1,label:'Listen at the point'},{type:'visit',x:240,z:383,radius:4,amount:1,label:'Listen along the long strand'}]},
  {id:'tobin',journal:'I heard them: bells, far out and deep, ringing a tune I almost knew. A small boy called Tobin was humming the same tune on the landing.',
   objectives:[{type:'talk',target:'@tide.tobin',amount:1,label:'Ask Little Tobin about the tune',dialogue:talk('It is the bell song. I sing it in my sleep. Mum says I never learned it anywhere.','The bells are sad. They have been ringing for ages and nobody comes.')}]}],
 cutscenes:{
  bells:scene('Bells under the bay','Bells under the bay','Saltglass Landing, at dusk',[['@tide.tobin','There! Can you hear it? Under the water. Ding. Ding. Ding-dong. It is a song.','Little Tobin']]),
  quiet:scene('Quietly','A quiet word','Saltglass harbour',[['@tide.tidewell','Bells. Children singing dead hymns. If this gets out, nobody will fish here for a year. Quietly, I said.','Harbourmaster Corwen Tidewell']])},
 onComplete:{cutscene:'quiet'},
 journalDone:'The Saltglass nets are cut by swinging bells far under the bay; I heard them at dusk from the western shore. Little Tobin hums their tune in his sleep, though he never learned it. Harbourmaster Tidewell wants it kept quiet.',
 gold:150,xp:{fishing:1500,crafting:1000},lamps:[{perLevel:10,minLevel:5,label:'Low-tide lamp'}],
 unlocks:[
  {type:'flag',id:'tide.bells_heard',label:'Saltglass has heard the bells'},
  {type:'dialogue',id:'dialogue.tide-agathe-1',label:'Agathe saves the rope',npc:'@tide.agathe',lines:talk('I keep every scrap of bell-rope that comes up now. There is a lot of it. Somebody cut a great many ropes, a long time ago.')}]},

{n:2,key:'arc-tide-2',name:'The Fen Witch’s Price',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@tide.ilse',icon:'rawTrout',
 requirements:{quests:['arc-tide-1'],skills:{fishing:{level:25,boostable:false},herblore:{level:10,boostable:false}}},
 description:'Scholar Ilse Quillon has heard about the bells. The only person alive who might remember the drowning of Old Corrow is Grandmother Moss, who lives in the fens on the far side of Eldervale and charges for everything.',
 dialogue:{
  offer:talk('Bells under the bay! Old Corrow! I have waited my whole life for someone to say those words to me.','Corrow drowned two hundred years ago. Every record calls it a storm. Grandmother Moss, in the fens, calls it something else, and she is older than the records.','She charges for answers. Pay her, whatever it is. Within reason. Within most reasons.'),
  progress:talk('Did Moss talk? Did she charge you a tooth? She charged me a tooth.'),
  complete:talk('A bargain with the tide. A town that sang for its fish, and a warning bell that rang for nobody.','And Reedly will run the old Mirewater ferry for you? Between the fens and the bay? That has not run since my grandmother was a girl. Wonderful.')},
 branchDialogue:[{stage:'complete',ifFlags:{moss_charm:true},lines:talk('You took Moss’s charm. I can smell it from here. Peat and pondweed and something older.','Still, she told you the bargain, and Reedly will run the Mirewater ferry for you. Wonderful.')}],
 stages:[
  {id:'moss',journal:'Scholar Ilse Quillon sent me across Eldervale to the fens in the south-west, to ask Grandmother Moss about the drowning of Old Corrow.',
   objectives:[{type:'talk',target:'@tide.moss',amount:1,label:'Find Grandmother Moss in the fens',dialogue:talk('Corrow? Ha! Two hundred years and somebody finally asks properly.','Answers cost. First, my eel-traps. Two little thieves have been at them. Wearing my eels. Wearing them.')}]},
  {id:'eels',journal:'Grandmother Moss will talk about Corrow, for a price. First, two bog eel-thieves have been robbing her traps.',
   objectives:[{type:'event',event:'death',targets:['@tide.eel1','@tide.eel2'],amount:2,label:'Deal with the bog eel-thieves'}]},
  {id:'supper',journal:'The eel-thieves are gone. Moss wants a proper supper of three raw trout before she will tell me anything. She does her own cooking. “Nobody else does it right.”',
   npc:'@tide.moss',
   objectives:[{type:'collect',target:'rawTrout',amount:3,label:'Bring Grandmother Moss three raw trout'}],
   dialogue:{choice:talk('Corrow sang to the tide. Every year, a hymn, and the tide filled their nets. A bargain. Then one year the warning bell rang, the storm came in, and nobody climbed the hill.','Somebody had cut the bell-ropes, see. Nobody heard the warning. The choir sang all the way down.','Now. I can give you a charm that lets you hear what the drowned hear. It will cost you a little of your sleep. Or you can go with what you have.')},
   choices:[
    {id:'charm',label:'Take Moss’s charm and hear what the drowned hear.',flags:{moss_charm:true},dialogue:talk('Clever. Wear it on your ear and keep a candle by your bed. You will dream in hymns.')},
    {id:'refuse',label:'Thank her, and keep your sleep.',flags:{refused_charm:true},dialogue:talk('Sensible. Boring, but sensible. Off you go.')}]},
  {id:'ferry',journal:'Moss told me the truth of Corrow: the town sang to the tide for its catch, and drowned when someone cut the warning bell’s ropes. Ferryman Reedly, at the fen landing nearby, is the last who knows the old Mirewater channels to the bay.',
   objectives:[{type:'talk',target:'@tide.reedly',amount:1,label:'Ask Ferryman Reedly about the Mirewater channels',dialogue:talk('The Mirewater! Fens to the bay, under the old willows and out by the drowned dyke. Nobody has asked for it in forty years.','For a friend of Moss? I will run it whenever you ring for me.')}]}],
 cutscenes:{
  fens:scene('The fen witch','The fens','South-west Eldervale',[['@tide.moss','Wipe your boots. No, the other way. Now sit, and do not touch the jar with the face in it.','Grandmother Moss']]),
  ferry:scene('The Mirewater ferry','The Mirewater ferry','The fen landing',[['@tide.reedly','Fens to the bay in an afternoon, and back by supper. Ring the landing bell and I will come.','Ferryman Ambrose Reedly']])},
 onComplete:{cutscene:'ferry'},
 journalDone:'Grandmother Moss told me Old Corrow sang a yearly hymn to the tide for its catch, and drowned when someone cut the ropes of the warning bell. Ferryman Reedly will now run the old Mirewater ferry for me between the fens and Saltglass.',
 journalVariants:[{ifFlags:{moss_charm:true},text:'I took Moss’s charm. I dream in hymns now.'},{ifFlags:{refused_charm:true},text:'I refused Moss’s charm and kept my sleep.'}],
 gold:400,xp:{fishing:6000,herblore:4000,magic:3000},lamps:[{perLevel:10,minLevel:10,label:'Fen lamp'}],
 unlocks:[
  {type:'teleport',id:'teleport.ferry-fens',label:'Mirewater ferry: the fen landing',x:-176,z:254},
  {type:'teleport',id:'teleport.ferry-saltglass',label:'Mirewater ferry: Saltglass Landing',x:300,z:350},
  {type:'flag',id:'tide.corrow_bargain',label:'The Corrow bargain is remembered'},
  {type:'dialogue',id:'dialogue.tide-moss-charm',label:'Moss checks on her charm',npc:'@tide.moss',ifFlags:{moss_charm:true},lines:talk('Still dreaming in hymns? Good. Do not sing them out loud in the fens. Things answer.')},
  {type:'dialogue',id:'dialogue.tide-reedly-2',label:'Reedly’s ferry runs',npc:'@tide.reedly',lines:talk('The channels are deeper than I remember. Or I am shorter. One of the two.')}]},

{n:3,key:'arc-tide-3',name:'Hymn of Salt',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@tide.ilse',icon:'custom_qa_hymn_leaf',
 requirements:{quests:['arc-tide-2','arc-frontier-2'],skills:{crafting:{level:25,boostable:false},fishing:{level:30,boostable:false}}},
 description:'If Corrow sang to the tide, its hymn can be sung again. Scholar Ilse believes the drowned choristers wandering Gloomfen still carry pages of it.',
 dialogue:{
  offer:talk('The drowned do not all stay drowned. Some walk the fens, carrying what they carried when the sea took them.','The choristers of Corrow carried their hymn books. Pages of kelp, Moss says. Bring me three, and we can put the hymn back together.'),
  progress:talk('Three leaves. Kelp. Possibly damp. Definitely damp.'),
  complete:talk('The hymn of salt. Whole again. And shrouds for the choir, should they ever want to rest.','You have done something no scholar could. Thank you.')},
 stages:[
  {id:'chapel',journal:'Scholar Ilse believes the drowned choristers of Corrow wander Gloomfen carrying pages of their hymn. The old fen chapel on the edge of Gloomfen is where Moss says they gather.',
   objectives:[{type:'visit',x:-246,z:288,radius:5,amount:1,label:'Find the old fen chapel in Gloomfen'}]},
  {id:'choristers',journal:'Three drowned choristers circle the ruined fen chapel, singing with mouths full of water.',
   onEnter:{cutscene:'choir'},
   objectives:[{type:'event',event:'death',targets:['@tide.chorister1','@tide.chorister2','@tide.chorister3'],amount:3,label:'Lay the drowned choristers to rest'}]},
  {id:'leaves',journal:'Each chorister left a page of kelp. I should take all three hymn leaves back to Ilse at Saltglass.',
   npc:'@tide.ilse',
   objectives:[{type:'collect',target:'custom_qa_hymn_leaf',amount:3,label:'Bring Ilse three kelp hymn leaves'}],
   dialogue:{advance:talk('Three verses, out of order, of course. One is crusted with salt. One has a bell drawn in the margin. One is smudged with the words “still water”.','The hymn begins at sea and ends at rest. The bell is its heart. Put them in order for me.')}},
  {id:'order',journal:'The three verses are out of order: one crusted with salt, one with a bell in the margin, one smudged with “still water”. Ilse says the hymn begins at sea, ends at rest, and the bell is its heart.',
   npc:'@tide.ilse',
   objectives:[{type:'talk',target:'@tide.ilse',amount:1,label:'Tell Ilse the order of the verses'}],
   dialogue:{choice:talk('Well? Which order?')},
   choices:[
    {id:'right',label:'Salt, then bell, then still water.',flags:{hymn_ordered:true},next:'shrouds',dialogue:talk('Salt, bell, still water. Yes. Sea, heart, rest. Listen to it.')},
    {id:'bellfirst',label:'Bell, then salt, then still water.',next:'hum',dialogue:talk('It starts with a clang and goes nowhere. No. Ask Tobin; he sings it in his sleep.')},
    {id:'stillfirst',label:'Still water, then bell, then salt.',next:'hum',dialogue:talk('That is the hymn backwards, and it sounds like a curse. Ask Tobin; he sings it in his sleep.')}]},
  {id:'hum',journal:'My order was wrong. Ilse suggested I ask Little Tobin, who sings the hymn in his sleep, how it goes.',next:'order',
   objectives:[{type:'talk',target:'@tide.tobin',amount:1,label:'Ask Little Tobin how the bell song goes',dialogue:talk('It starts all salty, like the sea in your mouth. Then the bell bit, ding-dong. Then it goes quiet and calm. That is the end.')}]},
  {id:'shrouds',journal:'The hymn is whole: salt, bell, still water. Ilse asked me to bring two lengths of linen for shrouds, in case the choir ever wants to rest.',
   objectives:[{type:'collect',target:'linen',amount:2,label:'Bring Ilse two lengths of linen for shrouds'}]}],
 cutscenes:{
  choir:scene('The fen chapel','The drowned choristers','Gloomfen',[['@tide.moss','(Moss’s voice carries over the bog) Do not sing back to them! Whatever you do, do not sing back!','Grandmother Moss']]),
  hymn:scene('The hymn of salt','The hymn of salt','Saltglass Landing',[['@tide.ilse','Salt, bell, still water. Two hundred years, and it fits on three leaves of kelp.','Scholar Ilse Quillon']])},
 onComplete:{cutscene:'hymn'},
 journalDone:'I laid three drowned choristers of Corrow to rest in Gloomfen and brought their kelp hymn leaves to Scholar Ilse. Together we put the hymn of salt back in order, and I brought linen for the choir’s shrouds.',
 gold:600,xp:{crafting:7000,prayer:5000,fishing:4000},lamps:[{perLevel:10,minLevel:15,label:'Hymn lamp'}],
 unlocks:[
  {type:'flag',id:'tide.hymn_whole',label:'The hymn of salt is whole'},
  {type:'dialogue',id:'dialogue.tide-ilse-3',label:'Ilse hums the hymn',npc:'@tide.ilse',lines:talk('I hum it while I work. The gulls have gone very quiet. I think they know it.')},
  {type:'dialogue',id:'dialogue.tide-tobin-3',label:'Tobin sleeps sound',npc:'@tide.tobin',lines:talk('I did not sing in my sleep last night! Mum says I snored instead. That is better. Probably.')}]},

{n:4,key:'arc-tide-4',name:'The Harbourmaster’s Ledger',questPoints:3,difficulty:'Experienced',length:'Long',giver:'@tide.agathe',icon:'rope',
 requirements:{quests:['arc-tide-3'],qp:16,skills:{fishing:{level:40,boostable:false},crafting:{level:35,boostable:false},agility:{level:30,boostable:false}}},
 description:'Somebody cut the ropes of Corrow’s warning bell. Agathe has kept every scrap of rope the sea gave back, and every one was cut with the same blade. She thinks the answer is in Saltglass, not under it.',
 dialogue:{
  offer:talk('Look at these ends. Every rope cut the same, one stroke, a left-handed blade.','Harbourmaster Tidewell is left-handed. So was his father, and his father’s father. All harbourmasters, all the way back to Corrow.','I do not want it to be him. Find out, before I have to mend that net too.'),
  progress:talk('Well? Is it the Tidewells?'),
  complete:talk('Rope for the dive. And the truth, which is heavier.','The Drowned Steps are open; the low tide will hold for you. Go and give the choir its rest.')},
 branchDialogue:[{stage:'complete',ifFlags:{protected_tidewell:true},lines:talk('So he pays for the dive, the shrouds and the stones, and keeps his post. Hm. It is more than his family ever paid.','The Drowned Steps are open. Go and give the choir its rest.')}],
 stages:[
  {id:'dream',journal:'Agathe found that every bell-rope was cut by a left-handed blade, and the Tidewell harbourmasters, back to Corrow’s day, have all been left-handed. Little Tobin has been dreaming again.',
   objectives:[{type:'talk',target:'@tide.tobin',amount:1,label:'Ask Little Tobin about his dream',dialogue:talk('I dreamed about a man with the harbourmaster’s face. Old clothes. He cut the bell-ropes and took the silver bells away in a cart while it rained.','He kept a book. A big one, with a fish on the front.')}]},
  {id:'office',journal:'Tobin dreamed of a man with Tidewell’s face cutting the bell-ropes and carting off the silver bells, writing it all in a big book with a fish on the cover. The harbour books are kept in the back room of the tackle shop. I need to get in there unseen.',
   objectives:[{type:'visit',x:283,z:336,radius:3,amount:1,label:'Slip into the back room of the tackle shop'}]},
  {id:'ledger',journal:'In the back room I found the oldest harbour ledger, with a fish on its cover, written in a script I cannot read. Scholar Ilse can.',
   onEnter:{cutscene:'ledger'},
   objectives:[{type:'talk',target:'@tide.ilse',amount:1,label:'Have Ilse read the old harbour ledger',dialogue:talk('“Sold: nine silver bells of Corrow, to the Birchford mint. Ropes cut, that the bell not ring, that the town not climb, that the bells be ours.”','Signed Osric Tidewell, harbourmaster. Two hundred years ago. The Tidewells built Saltglass on drowned silver.')}]},
  {id:'confront',journal:'The ledger proves it: Osric Tidewell cut the warning bell’s ropes and sold Corrow’s silver bells while the town drowned. Corwen Tidewell, his descendant, is harbourmaster today. I should confront him.',
   npc:'@tide.tidewell',
   objectives:[{type:'talk',target:'@tide.tidewell',amount:1,label:'Confront Harbourmaster Tidewell with the ledger',dialogue:talk('I know what it says. Every Tidewell reads it on the day they take the harbour. And every one of us puts it back on the shelf.','I am not proud. I am also not Osric. What will you do?')}],
   dialogue:{choice:talk('Tell the whole landing, and I lose the harbour. Or let me pay for the dive, the shrouds and the stones, and make it right as best I can.')},
   choices:[
    {id:'expose',label:'Saltglass deserves the truth. Tell them.',flags:{exposed_tidewell:true},dialogue:talk('Then I will tell them myself, on the pier, tonight. It should come from a Tidewell.')},
    {id:'protect',label:'Pay for the dive and the burial. Keep your post.',flags:{protected_tidewell:true},dialogue:talk('Every coin. And the stones will have their names. I swear it on the ledger.')}]},
  {id:'ropes',journal:'Whatever becomes of Tidewell, the choir is still singing under the bay. Agathe will lower me down the Drowned Steps at low tide if I bring her three coils of rope.',
   objectives:[{type:'collect',target:'rope',amount:3,label:'Bring Agathe three coils of rope for the dive'}]}],
 cutscenes:{
  ledger:scene('The fish-backed ledger','The harbour ledger','Saltglass Landing',[['@tide.agathe','(Agathe, keeping watch by the door) Hurry. He counts the crates at the top of every hour. Every hour. The man is a clock.','Agathe the Net-Mender']]),
  steps:scene('The Drowned Steps','The Drowned Steps','Saltglass Bay, at the lowest tide',[['@tide.agathe','There they are. Steps going down into the bay, where there should not be any. The sea is letting you in.','Agathe the Net-Mender']])},
 onComplete:{cutscene:'steps'},
 journalDone:'Little Tobin’s dream led me to the oldest harbour ledger: Osric Tidewell cut the ropes of Corrow’s warning bell and sold its silver while the town drowned. I confronted his descendant, Harbourmaster Corwen Tidewell, and Agathe opened the Drowned Steps for a dive at the lowest tide.',
 journalVariants:[{ifFlags:{exposed_tidewell:true},text:'Tidewell told the whole landing the truth, on the pier.'},{ifFlags:{protected_tidewell:true},text:'Tidewell kept his post and paid for the dive, the shrouds and the stones.'}],
 gold:1200,xp:{fishing:20000,crafting:15000,agility:12000},lamps:[{amount:15000,minLevel:30,label:'Harbour lamp (any skill of level 30+)'}],
 unlocks:[
  {type:'area',id:'area.tide-steps',label:'The Drowned Steps, Saltglass Bay'},
  {type:'flag',id:'tide.ledger_read',label:'Saltglass knows who cut the ropes'},
  {type:'dialogue',id:'dialogue.tide-tidewell-exposed',label:'Tidewell, no longer harbourmaster',npc:'@tide.tidewell',ifFlags:{exposed_tidewell:true},lines:talk('They let me keep the uniform. Not the post. I mend nets for Agathe now. She is a harsh employer. It is fair.')},
  {type:'dialogue',id:'dialogue.tide-tidewell-protected',label:'Tidewell pays his debts',npc:'@tide.tidewell',ifFlags:{protected_tidewell:true},lines:talk('The stonemason starts the names next week. Two hundred and twelve of them. I am paying by the letter. It is the best money my family ever spent.')}]},

{n:5,key:'arc-tide-5',name:'The Drowned Choir',questPoints:5,difficulty:'Master',length:'Very long',giver:'@tide.ilse',icon:'custom_qa_tidebell',
 requirements:{quests:['arc-tide-1','arc-tide-2','arc-tide-3','arc-tide-4'],qp:36,skills:{fishing:{level:50,boostable:false},crafting:{level:45,boostable:false},prayer:{level:40,boostable:false},agility:{level:40,boostable:false}},combat:60},
 description:'At the lowest tide the Drowned Steps lead down into the chapel of Old Corrow, where the choir still sings and the Choirmistress still rings a bell with no rope. Scholar Ilse has the hymn. You have the nerve.',
 dialogue:{
  offer:talk('The hymn, the shrouds, the steps. Everything is ready except someone to carry it down.','The Choirmistress rang the warning bell until the rope was cut. She is still ringing it. If she hears the hymn, perhaps she will stop.','> And if she doesn’t?','Then she will not let you leave, and I will write a very sad book. Please do not make me write that book.'),
  progress:talk('The tide turns soon. Hurry, but do not drown.'),
  complete:talk('The warning bell of Corrow. It rings true. After two hundred years it rings true.','Keep this tidebell, cast from the same silver; it will take you back to the Drowned Steps. And this staff, which Corrow’s choir-priests carried. It answers the sea.')},
 branchDialogue:[
  {stage:'complete',ifFlags:{laid_to_rest:true},lines:talk('They are resting. I heard the bells stop at noon, one by one, like lamps going out.','Keep this tidebell, and this staff of Corrow’s choir-priests. It answers the sea, and the sea owes you now.')},
  {stage:'complete',ifFlags:{bells_broken:true},lines:talk('You broke the bells. The choir is free of them, and of the bay. The fishermen say the sea is very quiet. Too quiet, some say.','Keep this tidebell, and this staff of Corrow’s choir-priests. It answers the sea.')}],
 stages:[
  {id:'provisions',journal:'At the lowest tide the Drowned Steps lead down into Old Corrow’s chapel. Agathe will pack food for the dive if I bring her five cooked lobsters.',
   npc:'@tide.agathe',
   objectives:[{type:'collect',target:'lobster',amount:5,label:'Bring Agathe five cooked lobsters for the dive'}],
   dialogue:{advance:talk('Lobsters, shrouds, rope, hymn. And you. Down you go, and come back up, mind. I have run out of thread for mending people.')}},
  {id:'steps',journal:'Agathe packed for the dive. Time to go down the Drowned Steps into the nave of Old Corrow.',
   onEnter:{cutscene:'nave'},
   objectives:[{type:'visit',x:3824,z:3000,radius:7,amount:1,label:'Descend the Drowned Steps into the nave'}]},
  {id:'wardens',journal:'The nave is guarded by the bell-wardens of Corrow, who never heard that the ropes were cut.',
   objectives:[{type:'event',event:'death',targets:['@tide.warden1','@tide.warden2'],amount:2,label:'Lay the bell-wardens to rest'}]},
  {id:'alcoves',journal:'Past the wardens are three bell alcoves, their bells hanging silent. The hymn goes salt, bell, still water: the salt-crusted bell to the west, the great bell to the east, the still bell nearest the apse. I should ring them in the hymn’s order.',
   objectives:[{type:'visit',x:3844,z:2990,radius:2.5,amount:1,label:'Ring the salt-crusted bell'},{type:'visit',x:3852,z:2990,radius:2.5,amount:1,label:'Ring the great bell'},{type:'visit',x:3848,z:2999,radius:2.5,amount:1,label:'Ring the still bell'}]},
  {id:'choirmistress',journal:'The three bells rang the hymn, and the apse door opened. The Choirmistress is inside, ringing a bell with no rope, and she has noticed me.',
   onEnter:{cutscene:'choirmistress'},
   objectives:[{type:'kill',target:'@tide.choirmistress',amount:1,label:'Still the Choirmistress Below'},{type:'have',target:'custom_qa_corrow_bell',amount:1,label:'Take the Corrow warning bell'}]},
  {id:'rest',journal:'The Choirmistress is still. In the quiet, the voices of the whole drowned choir spoke at once from the apse, asking what comes next.',
   npc:'@tide.echo',
   objectives:[{type:'talk',target:'@tide.echo',amount:1,label:'Answer the Echo of Old Corrow',dialogue:talk('We sang to the tide, and the tide kept its bargain. Then the bell did not ring, and we sang all the way down.','We are tired. But the bells hold us. Ring us to sleep, or break the bells and let us go where we will.')}],
   dialogue:{choice:talk('Choose, warm one. We have waited long enough to be patient one moment more.')},
   choices:[
    {id:'rest',label:'Sing the hymn of salt to the end, and rest.',flags:{laid_to_rest:true},dialogue:talk('Salt... bell... still water. Yes. Still water. Thank you. Thank you. Thank...')},
    {id:'break',label:'Break the bells. Go where you will.',flags:{bells_broken:true},dialogue:talk('Free! The tide is wide and the sea is deep. Goodbye, warm one. Goodbye, Saltglass!')}]},
  {id:'surface',journal:'The choir has its answer. The Corrow warning bell should go back to Scholar Ilse at Saltglass Landing.',
   objectives:[{type:'collect',target:'custom_qa_corrow_bell',amount:1,label:'Give the warning bell to Scholar Ilse'}]}],
 cutscenes:{
  nave:scene('The drowned nave','The Sunken Choir','Under Saltglass Bay',[['@tide.ilse','(Ilse’s voice, from the top of the steps) If you hear singing, that is them. If you hear me singing, that is me panicking.','Scholar Ilse Quillon']]),
  choirmistress:scene('The Choirmistress Below','The Choirmistress Below','The apse of Old Corrow',[['@tide.echo','(Two hundred voices, singing the first line of the hymn of salt. One voice, higher than the rest, refuses to stop ringing.)','Echo of Old Corrow']]),
  quiet:scene('Still water','Still water','Saltglass Landing',[['@tide.tobin','The bells stopped. I can hear the sea now. Just the sea. It is nice.','Little Tobin']])},
 onComplete:{cutscene:'quiet'},
 journalDone:'I went down the Drowned Steps into the Sunken Choir, laid its bell-wardens to rest, rang the alcove bells in the order of the hymn of salt and stilled the Choirmistress Below. The drowned choir of Old Corrow has its answer. The Tidebell will always bring me back to the Drowned Steps.',
 journalVariants:[{ifFlags:{laid_to_rest:true},text:'I sang the choir to rest. The bells stopped at noon, one by one.'},{ifFlags:{bells_broken:true},text:'I broke the bells and the choir went out into the sea, free.'}],
 gold:5000,xp:{fishing:60000,crafting:40000,prayer:35000,magic:25000},items:{custom_qa_tidebell:1,'weapon:tidecallerStaff':1},
 lamps:[{amount:20000,minLevel:40,label:'Tidebell lamp (any skill of level 40+)'}],
 unlocks:[
  {type:'teleport',id:'teleport.drowned-steps',label:'Tidebell of Corrow: the Drowned Steps, Saltglass',x:322,z:356},
  {type:'area',id:'area.tide-loft',label:'The bell loft: Bell-Salvager Odile and the Choirmistress’s Lament (harder mode)'},
  {type:'area',id:'lair:gloomweb_nest',label:'Gloomweb Nest: with the choir silent, something in Gloom hollow wakes'},
  {type:'flag',id:'tide.choir_answered',label:'The drowned choir of Corrow is answered'},
  {type:'dialogue',id:'dialogue.tide-ilse-rest',label:'Ilse writes the happy book',npc:'@tide.ilse',ifFlags:{laid_to_rest:true},lines:talk('I am writing the book. It has a happy ending. I keep checking, in case it changes.')},
  {type:'dialogue',id:'dialogue.tide-ilse-free',label:'Ilse writes the strange book',npc:'@tide.ilse',ifFlags:{bells_broken:true},lines:talk('Fishermen swear they hear singing far out past the reef, going away. I am writing it all down. Nobody will believe it. I do.')},
  {type:'dialogue',id:'dialogue.tide-agathe-5',label:'Agathe’s nets come up whole',npc:'@tide.agathe',lines:talk('Not one torn net all month. I am bored stiff. It is wonderful.')},
  {type:'dialogue',id:'dialogue.tide-moss-5',label:'Moss heard the bells stop',npc:'@tide.moss',lines:talk('Heard it all the way out here: the bells, stopping. Then something in Gloom hollow stopped holding its breath. Mind the webs, now.')}]}
];
