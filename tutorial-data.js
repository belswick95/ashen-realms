// Castle training (tutorial) content: world additions and the quest chain.
// The server copy is generated from this file by scripts/build-castle-tutorial-seed.mjs
// into db/castle-tutorial-seed.sql. World references use '@castle:<blueprintKey>' for the
// original castle blueprint and '@tutorial:<key>' for the rows below; the seed resolves them.
export const TUTORIAL_BLUEPRINT='castle-tutorial-v1';
export const CASTLE_CENTRE={x:-340,z:-305};
export const CASTLE_INNER_HALF=47;
export const TUTORIAL_START={x:-340,z:-290};
export const AUDIENCE_SPOT={x:-340,z:-328.5};
export const GATE={x:-340,z:-256};
export const GATE_MESSAGE='You should finish your training before leaving the castle.';
export const tutorialId=key=>'c7a5e000-0000-4000-8000-'+String(key).padStart(12,'0');
export const questId=order=>'c7a5e000-0000-4000-8000-'+String(100+order).padStart(12,'0');

const base={level:1,hp:1,damage:0,attackSpeed:2.4,roam:0,respawn:0,attackable:false,hostile:false,scale:1,yaw:0};
const npc=(name,template,role,x,z,extra={})=>({...base,kind:'npc',template,name,role,x,z,level:5,hp:45,damage:4,respawn:30,attackType:'punch',weapon:null,tutor:true,...extra});
const object=(name,template,x,z,extra={})=>({...base,kind:'object',template,name,x,z,...extra});

// key -> entity data (key doubles as blueprintKey). The King holds court in the Keep's hall,
// in front of the high-table dais; Royal Archivist Iven steps aside to make room (see seed).
export const tutorialEntities={
 1:npc('King Oswin the Steadfast','villager','king',-340,-333.2,{color:0x6b2d8c,scale:1.05,look:{sex:'male',beard:'Short beard'},dialogue:'Train well, adventurer. Eldervale has need of you.'}),
 2:object('Throne of Eldervale','throne',-340,-335.3),
 3:npc('Sergeant Brannoc','knight','soldier',-369,-267,{weapon:'longsword',attackType:'slash',color:0x53687a,dialogue:'Stab for Attack, Slash for Strength, Lunge for a bit of everything.'}),
 4:{...base,kind:'monster',template:'training_dummy',species:'dummy',name:'Training dummy',x:-381,z:-262.5,level:1,hp:5000,damage:0,attackSpeed:6,respawn:5,attackable:true,attackType:'punch',loot:[]},
 5:{...base,kind:'monster',template:'training_dummy',species:'dummy',name:'Training dummy',x:-377,z:-262.5,level:1,hp:5000,damage:0,attackSpeed:6,respawn:5,attackable:true,attackType:'punch',loot:[]},
 6:{...base,kind:'monster',template:'training_dummy',species:'dummy',name:'Training dummy',x:-373,z:-262.5,level:1,hp:5000,damage:0,attackSpeed:6,respawn:5,attackable:true,attackType:'punch',loot:[]},
 7:{...base,kind:'monster',template:'rat',species:'rat',name:'Cellar rat',x:-385,z:-270,level:1,hp:8,damage:1,attackSpeed:2.6,roam:2,respawn:20,attackable:true,attackType:'bite',scale:.7},
 8:{...base,kind:'monster',template:'rat',species:'rat',name:'Cellar rat',x:-384,z:-274,level:1,hp:8,damage:1,attackSpeed:2.6,roam:2,respawn:20,attackable:true,attackType:'bite',scale:.7},
 9:npc('Forester Wynn','farmer','forester',-381,-296,{weapon:'axe',attackType:'slash',color:0x546d42,dialogue:'Chop, then burn. The clearing by my trees is safe for fires.'}),
 10:object('Young oak','tree',-385.5,-303,{scale:.8}),
 11:object('Young oak','tree',-385.5,-290,{scale:.8}),
 12:npc('Old Nettie','villager','fisher',-365,-341,{color:0x4f6f7d,dialogue:'Shrimp love the castle pond. Net them, cook them, eat them.'}),
 13:object('Training pond','training_pond',-373,-343.5),
 14:object('Pond shrimp','fishing_spot',-373,-343.5,{waterHeight:.3}),
 15:object('Copper rock','rock',-298,-301,{resource:'copperOre',scale:.8}),
 16:object('Tin rock','rock',-298,-307,{resource:'tinOre',scale:.8}),
 17:npc('Steward Harlan','villager','steward',-346,-265,{color:0x8a6d3b,dialogue:'The gates open for those who finish their training.'}),
};

const say=(text,who='npc')=>({who,text});
// Ordered quest chain. giver/targets/hints are resolved to entity ids by the seed.
export const tutorialQuests=[
 {key:'tutorial-combat',name:'Arms Drill',giver:'@tutorial:3',
  description:'Sergeant Brannoc drills every new recruit in the training yard: wield your gear, learn the three attack styles on the dummies, then face a real cellar rat.',
  startItems:{'weapon:bronzeSword':1,'shield:woodenShield':1,bread:2},
  objectives:[
   {type:'equip',target:'weapon',amount:1,label:'Wield the bronze sword (Inventory → Wield)'},
   {type:'equip',target:'shield',amount:1,label:'Equip the wooden buckler'},
   {type:'xp',skill:'attack',amount:8,label:'Stab a training dummy (Stab trains Attack)',hint:'@tutorial:5'},
   {type:'xp',skill:'strength',amount:8,label:'Slash a training dummy (Slash trains Strength)',hint:'@tutorial:5'},
   {type:'xp',skill:'defence',amount:3,label:'Lunge at a dummy (Lunge shares Attack, Strength and Defence)',hint:'@tutorial:5'},
   {type:'event',event:'death',targets:['@tutorial:7','@tutorial:8'],amount:1,label:'Defeat a cellar rat',hint:'@tutorial:7'},
   {type:'event',event:'eat',amount:1,label:'Eat food to restore your Hitpoints'}],
  giverName:'Sergeant Brannoc',icon:'weapon:bronzeSword',xp:{attack:200,strength:200,defence:200,hitpoints:150},items:{'weapon:dagger':1},
  dialogue:{
   offer:[say('So you\'re the King\'s new recruit. Good. Nobody leaves this castle until I say they can hold a blade.'),
    say('Four skills make up your combat level. Attack decides how often you hit. Strength decides how hard. Defence decides how often you get hit.'),
    say('Hitpoints is your life. It earns experience from every blow you land, and your most Hitpoints are ten times your Hitpoints level.'),
    say('Your attack style picks which skill you train: Stab trains Attack, Slash trains Strength, and Lunge splits the experience across all three.'),
    say('Here\'s a bronze sword, a wooden buckler and some bread. Wield them from your inventory, then try each style on the dummies. They won\'t fight back.'),
    say('Once you\'ve the feel of it, kill one of the rats in the corner. They bite! Eat your bread if you get hurt.')],
   progress:[say('Open the combat options to switch between Stab, Slash and Lunge. The dummies never fall, so hit them as much as you like.'),
    say('Then kill a cellar rat, and eat something to heal. Right-click food and choose Eat.')],
   complete:[say('Not bad at all! Every hit earns experience, and the level-up fireworks tell you when a skill rises.'),
    say('Take this iron dagger too. A quick blade for a quick recruit.'),
    say('Your combat level grows as those skills do. Now go and see Forester Wynn by the trees to the north. A fighter still needs a fire.')]}},
 {key:'tutorial-woodcutting',requires:'tutorial-combat',name:'Timber and Flame',giver:'@tutorial:9',
  description:'Forester Wynn teaches you to fell trees for logs and to light a fire with a tinderbox.',
  startItems:{'weapon:axe':1,tinderbox:1},
  objectives:[
   {type:'event',event:'woodcut',amount:2,label:'Chop logs from a young oak',hint:'@tutorial:10'},
   {type:'xp',skill:'firemaking',amount:1,label:'Light a fire in the clearing (use the tinderbox with your logs)',hint:{x:-382,z:-295}}],
  giverName:'Forester Wynn',icon:'wood',xp:{woodcutting:200,firemaking:200},items:{wood:3},
  dialogue:{
   offer:[say('Ah, the Sergeant sent you. Every adventurer should know how to make a camp.'),
    say('Take this hatchet and tinderbox. Click a tree to chop it. When your inventory has logs, light them with the tinderbox.'),
    say('Light fires out here in my clearing, away from the castle buildings, or the guards will stamp them out.')],
   progress:[say('Chop a couple of logs from the young oaks behind me, then use the tinderbox on them right here in the clearing.')],
   complete:[say('A fine little blaze. A fire lets you cook anywhere in the wilds. Keep these spare logs for your next camp.'),
    say('Old Nettie keeps the pond by the north tower. She\'ll show you how to catch your supper.')]}},
 {key:'tutorial-fishing',requires:'tutorial-woodcutting',name:'Nets at the Pond',giver:'@tutorial:12',
  description:'Old Nettie lends you a small net so you can catch shrimp in the castle pond.',
  startItems:{fishingNet:1},
  objectives:[{type:'event',event:'fishing',amount:2,label:'Net two shrimp at the castle pond',hint:'@tutorial:14'}],
  giverName:'Old Nettie',icon:'fishingNet',xp:{fishing:200},items:{rawShrimp:3},
  dialogue:{
   offer:[say('Hungry? Then learn to feed yourself, dearie.'),
    say('Here\'s a small fishing net. Click the ripples in the pond and you\'ll net shrimp. Fishing level 1 is all it takes.')],
   progress:[say('Stand at the water\'s edge and click the ripples. Net two shrimp.')],
   complete:[say('Lovely catch! Have three more shrimp from my own basket.'),
    say('Raw shrimp won\'t do you much good, mind. Take them to Cook Rowan in the castle kitchen, the building with the smoking chimney to the south.')]}},
 {key:'tutorial-cooking',requires:'tutorial-fishing',name:'Supper at the Range',giver:'@castle:49',
  description:'Cook Rowan shows you how to cook raw food on the range or a fire, and how eating heals you.',
  objectives:[
   {type:'xp',skill:'cooking',amount:1,label:'Cook a raw shrimp on the range (or on a fire)',hint:'@castle:28'},
   {type:'event',event:'eat',match:{item:'shrimp'},amount:1,label:'Eat a cooked shrimp'}],
  giverName:'Cook Rowan',icon:'shrimp',xp:{cooking:200},items:{bread:1,berryPie:1},
  dialogue:{
   offer:[say('Shrimp! Lovely. Use them on the range behind me. Click the range and choose what to cook.'),
    say('Low levels burn food now and then. That\'s normal. Your Cooking level makes it rarer.'),
    say('Once it\'s cooked, eat one. Food restores Hitpoints, and better food heals more.')],
   progress:[say('Cook a shrimp on the range, then eat it from your inventory.')],
   complete:[say('Delicious, eh? Always carry food when you travel. Here, a fresh loaf and one of my berry pies.'),
    say('Master Smith Torren is waiting at the Royal Smithy, east of the courtyard.')]}},
 {key:'tutorial-smithing',requires:'tutorial-cooking',name:'Ore and Anvil',giver:'@castle:50',
  description:'Master Smith Torren teaches mining copper and tin, smelting bronze and working it at the anvil.',
  startItems:{'weapon:pickaxe':1,hammer:1},
  objectives:[
   {type:'have',target:'copperOre',amount:1,label:'Mine copper ore',hint:'@tutorial:15'},
   {type:'have',target:'tinOre',amount:1,label:'Mine tin ore',hint:'@tutorial:16'},
   {type:'xp',skill:'smithing',amount:6,label:'Smelt a bronze bar at the furnace',hint:{x:-314.6,z:-283.4}},
   {type:'have',target:'nails',amount:1,label:'Hammer the bar into nails at the anvil',hint:{x:-310,z:-281}}],
  giverName:'Master Smith Torren',icon:'bronzeBar',xp:{mining:200,smithing:200},items:{copperOre:2,tinOre:2},
  dialogue:{
   offer:[say('A new pair of hands. Take this pickaxe and hammer.'),
    say('Mine one copper and one tin from the rocks by the east wall. Smelt them together in my furnace for a bronze bar.'),
    say('Then use the bar on the anvil with your hammer. Nails are a good first job.')],
   progress:[say('Copper and tin from the rocks by the east wall, smelt at the furnace, then hammer at the anvil.')],
   complete:[say('Proper work! Higher Smithing lets you forge weapons and armour. Take some ore from my pile and practise.'),
    say('Off you go to Maelin at the Royal Treasury. She\'ll explain your bank and coins.')]}},
 {key:'tutorial-banking',requires:'tutorial-smithing',name:'Coins and Vaults',giver:'@castle:47',
  description:'Maelin the Royal Banker explains your bank, coins and the general store.',
  startItems:{gold:25},
  objectives:[
   {type:'bank',target:'*',amount:1,label:'Deposit any item into your bank',hint:'@castle:47'},
   {type:'visit',x:-322,z:-301.5,radius:4,amount:1,label:'Visit Bren the Provisioner\'s stall',hint:'@castle:54'}],
  giverName:'Maelin the Royal Banker',icon:'coins',gold:100,items:{'armor:peasantShirt3':1},
  dialogue:{
   offer:[say('Welcome to the Royal Treasury. Your bank keeps items safe. Anything in it survives death, and every bank branch shares it.'),
    say('Here are 25 coins to start. Talk to me and choose Bank, then deposit anything you don\'t need to carry.'),
    say('Coins buy supplies from merchants. Visit Bren the Provisioner\'s stall in the courtyard. Right-click a merchant and choose Trade.'),
    say('You can also trade with other adventurers. Right-click a player and choose Trade with.')],
   progress:[say('Deposit something in your bank, then take a look at Bren\'s stall in the courtyard.')],
   complete:[say('Here are 100 coins for your trouble, and a good blue shirt from the royal wardrobe. Spend wisely!'),
    say('Sister Adeline in the Chapel of the Dawn has some sober words for every adventurer.')]}},
 {key:'tutorial-prayer',requires:'tutorial-banking',name:'Dawn and Dusk',giver:'@castle:48',
  description:'Sister Adeline explains what happens when you die, and how prayer works.',
  objectives:[{type:'visit',x:-313,z:-317,radius:3,amount:1,label:'Kneel at the Altar of the Dawn',hint:'@castle:27'}],
  giverName:'Sister Adeline',icon:'candle',xp:{prayer:250},items:{candle:1},
  dialogue:{
   offer:[say('Every adventurer falls sometime, child. When your Hitpoints reach zero, you die.'),
    say('You keep your three most valuable items. Everything else drops where you fell. Hurry back for it before others take it.'),
    say('While you train here, you wake again in the castle courtyard. Out in the world, you return to Birchford.'),
    say('Kneel at the altar behind me. Praying restores your Prayer points.')],
   progress:[say('The altar is just behind me. Kneel and pray.')],
   complete:[say('May the Dawn watch over you. Carry this candle; let it remind you that dawn always follows dusk.'),
    say('You\'re ready. Steward Harlan waits by the Great Gate to send you on your way.')]}},
 {key:'tutorial-graduation',requires:'tutorial-prayer',name:'Through the Great Gate',giver:'@tutorial:17',finishes:'tutorial',
  description:'Receive the King\'s blessing in the Keep, then return to Steward Harlan to have the Great Gate opened.',
  objectives:[{type:'talk',target:'@tutorial:1',amount:1,label:'Receive King Oswin\'s blessing in the Keep',hint:'@tutorial:1',
   dialogue:[say('So, the Sergeant tells me you\'ve finished your training. Splendid.'),say('Go with my blessing. Return to Steward Harlan and he\'ll open the gates for you.')]}],
  giverName:'Steward Harlan',icon:'armor:cape',gold:150,items:{bread:3,shrimp:3,'armor:cape':1},
  dialogue:{
   offer:[say('Every graduate gets the King\'s blessing before the gates open. His Majesty is in the Keep, at the north end of the courtyard.')],
   progress:[say('The King awaits you in the Keep.')],
   complete:[say('Blessed by the King himself! Here are 150 coins, food for the road and a crimson cape, so every gate guard knows you trained at Eldervale Castle.'),
    say('Open the Great Gate!'),
    say('The road south leads to Birchford, where most adventurers begin. The castle is always open to you now.')]}},
];

export function tutorialQuestRows(){
 return tutorialQuests.map((q,i)=>({id:questId(i+1),data:{...q,chain:'tutorial',order:i+1,published:true}}));
}
