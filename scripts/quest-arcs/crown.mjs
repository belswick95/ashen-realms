// Arc 1 — The Tallow Crown (Birchford, the royal capital). Original Eldervale story.
// Forged royal writs lead from a candle-maker's boy to a blind forger, a stolen granary, the
// Queen's own Mistress of Ceremonies and a wax effigy-king animated beneath the Keep.
import {npc,monster,shortcut,item,drop,talk,scene,room,tunnel} from './common.mjs';

const A='crown';
export const arc={key:A,name:'The Tallow Crown',region:'Birchford, the royal capital',chain:'arc-crown'};

export const npcs=[
 npc(A,1,'odo','villager','Odo Penwhistle',-214.4,136,{yaw:180,dialogue:'Under-Clerk of the Chancery. Nine ledgers, eleven pens, and not one honest minute to myself.'}),
 npc(A,2,'marta','merchant','Marta Kell the Sealwright',-191,159.5,{yaw:0,dialogue:'Seals, signets, wax and ribbon.\nA good seal is a promise you can hold in your hand.'}),
 npc(A,3,'fenn','villager','Fenn Dunlow',-197,147,{yaw:90,dialogue:'Dunlow’s Chandlery. Twice-rendered tallow, smokeless, nearly.'}),
 npc(A,4,'varn','knight','Captain Isolde Varn',-229,168,{yaw:-90,dialogue:'The Keep Watch serves the Queen, not the Queen’s favourites.\nMind the court; it has ears.'}),
 npc(A,5,'merrow','mage','Lady Merrow Ashgrove',-235.5,174,{yaw:90,dialogue:'Mistress of Ceremonies to Her Majesty.\nEvery feast is a little war, darling. I simply win them.'}),
 npc(A,6,'sable','villager','Old Sable',-152,136.5,{yaw:-90,dialogue:'My eyes went years ago. My fingers still read paper better than yours.'}),
 npc(A,7,'ivy','villager','Ivy Sable',-209,184,{yaw:180,dialogue:'I mend letters for people who cannot write. That is all I do now.'}),
 npc(A,8,'merrow_vault','mage','Lady Merrow Ashgrove',1462,3006,{yaw:-90,dialogue:'The wax is cooling. So is everything I built.'}),
 npc(A,9,'quartermaster','merchant','Royal Quartermaster Bede',1422,3404,{yaw:180,dialogue:'The Treasury Arcade serves friends of the Crown.\nThe prices are fair. The company is better.',
  shop:{adamantBar:{buy:960,sell:290,stock:20},runiteBar:{buy:3200,sell:960,stock:6},healingPotion:{buy:180,sell:50,stock:30},steelArrows:{buy:12,sell:3,stock:500},silverBar:{buy:150,sell:45,stock:30}}}),
 npc(A,10,'hobb','farmer','Hobb Wainright the Drover',-282,150,{yaw:90,dialogue:'Oxen, carts and grain. Ask me about any of the three. Not the weather.'})
];
export const monsters=[
 monster(A,1,'jack','wayside_footpad','Gutter-Jack',-128,142,{level:16,rank:'Veteran',arch:'swift',loot:[drop('custom_qa_wax_ledger')],examine:'He smells of lime and lies.'}),
 monster(A,2,'cutthroat1','hedge_brigand','Varrow cutthroat',-298,134,{level:24,rank:'Common',arch:'swift',examine:'An old crown is stitched inside his collar.'}),
 monster(A,3,'cutthroat2','hedge_brigand','Varrow cutthroat',-302,140,{level:24,rank:'Common',arch:'swift',examine:'An old crown is stitched inside his collar.'}),
 monster(A,4,'cutthroat3','hedge_brigand','Varrow cutthroat',-296,145,{level:24,rank:'Common',arch:'swift',examine:'An old crown is stitched inside his collar.'}),
 monster(A,5,'sentry1','basalt_golem','Tallow sentry',1424,2997,{level:48,rank:'Veteran',arch:'stone',tint:0xe8d9a8,eyes:0xffd27a,accent:0xffb347,scale:1.3,roam:1,respawn:45,examine:'A guardsman made of candle-ends. It drips when it marches.'}),
 monster(A,6,'sentry2','basalt_golem','Tallow sentry',1426,3004,{level:48,rank:'Veteran',arch:'stone',tint:0xe8d9a8,eyes:0xffd27a,accent:0xffb347,scale:1.3,roam:1,respawn:45,examine:'A guardsman made of candle-ends. It drips when it marches.'}),
 monster(A,7,'regent','basalt_golem','The Tallow Regent',1452,3000,{level:86,rank:'Boss',arch:'stone',tint:0xf1e3b6,eyes:0xffe08a,accent:0xffc04a,crown:true,aura:0xffc04a,scale:2.3,roam:1,respawn:90,attackSpeed:4,
  loot:[drop('custom_qa_varrow_crown')],examine:'A king of wax, crowned in a crown that outlived its kingdom.'}),
 monster(A,8,'gilded','basalt_golem','The Gilded Regent',1446,3400,{level:108,rank:'Legendary',arch:'stone',tint:0xd9b44a,eyes:0xfff1a8,accent:0xffd24a,crown:true,aura:0xffe27a,scale:2.6,roam:1,respawn:300,attackSpeed:3.8,
  loot:[{item:'runiteBar',min:1,max:3,chance:.4},{item:'goldBar',min:3,max:8,chance:1,always:true},{item:'cutGem',min:1,max:3,chance:.5}],examine:'The Regent, recast in gold leaf by someone who should have known better. Harder mode.'})
];
export const objects=[
 shortcut(A,1,{id:'sables_climb',template:'wall_climb',name:'Sable’s Old Climb',level:18,xp:16,fail:.15,failDamage:25,ticks:4,ends:[[-212,83.6],[-212,76.2]],unlock:'shortcut.crown-sables-climb'})
];
export const items=[
 item('custom_qa_forged_writ','Forged royal writ','A grain writ with the Queen’s seal: crisp, perfect and false. Odo Penwhistle gave it to you as evidence.'),
 item('custom_qa_wax_ledger','Wax-stained ledger','A forger’s book of commissions, its pages sealed with drips of tallow. Someone paid a great deal for silence.'),
 item('custom_qa_varrow_crown','Melted Varrow crown','The old crown of House Varrow, slumped by the heat of its last wearer. Captain Varn will want it.','gem'),
 item('custom_qa_tallow_signet','Signet of the Lamplit Court','A small gold signet stamped with a candle flame. Rub it to return to Crown Court in Birchford.','gem')
];
export const areas=[{
 id:'crown_undervault',name:'The Undervault',theme:'crypt',band:[45,108],origin:{x:1400,z:3000},enabled:true,
 blurb:'Wax cellars below Birchford Keep where House Varrow kept its candles, its secrets and finally its king. Opened by “The Mistress of Ceremonies”.',
 levels:[
  {level:0,name:'Wax cellars',rooms:[room('stair',0,0,6,5),room('hall',25,0,10,7),room('chapel',52,2,13,11)],tunnels:[tunnel(3,[0,0],[25,0]),tunnel(3.2,[25,0],[52,2])]},
  {level:1,name:'Treasury Arcade',rooms:[room('landing',0,0,6,6),room('arcade',22,4,11,8),room('gilded',46,0,13,11)],tunnels:[tunnel(3.2,[0,0],[22,4]),tunnel(3.4,[22,4],[46,0])]}],
 entrances:[
  {id:'hatch',kind:'trapdoor',x:-240,z:165,yaw:0,name:'Undervault hatch',to:{level:0,x:2,z:0},requires:{unlock:'area.crown-undervault'}},
  {id:'treasury',kind:'stairs_down',x:-221,z:171.5,yaw:0,name:'Treasury stair',to:{level:1,x:2,z:0},requires:{unlock:'area.crown-arcade'}}],
 links:[],
 spawns:[{id:'knights',roster:'cairnbound_knight',count:2,level:0,room:'hall'}],
 lights:[{level:0,x:3,z:-3,kind:'torch'},{level:0,x:25,z:6,kind:'brazier'},{level:0,x:44,z:-6,kind:'brazier'},{level:0,x:60,z:9,kind:'brazier'},
  {level:1,x:3,z:3,kind:'torch'},{level:1,x:22,z:10,kind:'brazier'},{level:1,x:46,z:8,kind:'crystal'},{level:1,x:38,z:-6,kind:'brazier'}]}];

const COURT='Crown Court, Birchford';
export const quests=[
{n:1,key:'arc-crown-1',name:'Wax and Whispers',questPoints:1,difficulty:'Novice',length:'Short',giver:'@crown.odo',icon:'custom_qa_forged_writ',
 description:'Under-Clerk Odo Penwhistle has found royal grain writs bearing the Queen’s seal that the Queen never signed. He would like someone without a reputation to lose to ask a few questions.',
 startItems:{custom_qa_forged_writ:1},
 dialogue:{
  offer:talk('Psst. You. Yes, you, the one without a quill behind your ear.','Three writs came through the Chancery this week ordering royal grain carted out of the Frost Gate. Each one wears Her Majesty’s seal.','Her Majesty was in bed with a fever all week. She sealed nothing but her own soup.','> So someone forged her seal?','Someone forged it beautifully. Take this one to Marta Kell, the sealwright in the Grand Market. If anyone can tell how it was done, she can.'),
  progress:talk('Any news? I have started sealing my lunch, just in case.'),
  complete:talk('A cast seal, a chandler’s boy, and coins of a house that died before I was born. Oh, I do not like this at all.','Thank you. Captain Varn has the matter now, which means I can go back to being ignored. Bliss.')},
 branchDialogue:[{stage:'complete',ifFlags:{fenn_informant:true},lines:talk('So the boy keeps his apron and you keep an ear in the market. Clever. I shall pretend I did not hear that.','Captain Varn has the writs now. Thank you, truly.')}],
 stages:[
  {id:'sealwright',journal:'Odo Penwhistle, Under-Clerk of the Chancery, showed me grain writs sealed in the Queen’s name while she lay sick. He asked me to show one to Marta Kell, the sealwright in the Grand Market.',
   objectives:[{type:'talk',target:'@crown.marta',amount:1,label:'Show the forged writ to Marta Kell in the Grand Market',
    dialogue:talk('Let me see. Hm. Hmmm. Too crisp.','A seal pressed by hand blurs at the rim. This one is sharp as a coin: it was cast in a mould, then warmed on.','A mould needs fine wax that holds an edge. Twice-rendered tallow. Only Dunlow’s Chandlery renders it twice, off Market Lane.')}]},
  {id:'chandlery',journal:'Marta said the seal was cast from a mould of twice-rendered tallow, which only Dunlow’s Chandlery makes. I should look around the chandlery yard at the end of Market Lane before anyone tidies it.',
   objectives:[{type:'visit',x:-197.5,z:152.5,radius:3,amount:1,label:'Search the chandlery yard at the end of Market Lane'}]},
  {id:'boy',journal:'Among the tallow barrels I found broken plaster moulds still smelling of the Queen’s seal-wax. The chandler’s boy, Fenn Dunlow, was watching me from the doorway.',
   npc:'@crown.fenn',onEnter:{cutscene:'moulds'},
   objectives:[{type:'talk',target:'@crown.fenn',amount:1,label:'Talk to Fenn Dunlow',dialogue:talk('Those are just... rubbish. Old moulds. For candles.','> Candles shaped like the Queen’s seal?','...Fine! A veiled lady paid me to cast them. She paid in these. Old coins, heavy ones, with a crown nobody uses any more.')}],
   dialogue:{choice:talk('Please. If the Watch takes me, my father loses the shop. I did not know what they were for, I swear on my wick.')},
   choices:[
    {id:'report',label:'I’m sorry, Fenn. The Watch has to hear this from you.',flags:{reported_fenn:true},dialogue:talk('...All right. I will tell them everything. I hope she was worth it, whoever she is.')},
    {id:'informant',label:'Keep your apron on. You’ll be my eyes in the market instead.',flags:{fenn_informant:true},dialogue:talk('Your eyes? I can do that. I see everything from the dipping vats. Everything.')}]},
  {id:'captain',journal:'Fenn admitted casting the moulds for a veiled lady who paid in old crowns of House Varrow, the family that lost the throne two generations ago. Odo will want the Keep Watch told, and he has asked for two honest candles so he can seal his own reports properly from now on.',
   objectives:[{type:'talk',target:'@crown.varn',amount:1,label:'Tell Captain Isolde Varn at Crown Court',dialogue:talk('Varrow crowns? Those were melted down after the Long Dusk. All of them. Supposedly.','I will put a quiet watch on the Frost Gate carts. Tell Odo he did right to whisper.')},
    {type:'collect',target:'candle',amount:2,label:'Bring Odo two honest candles'}]}],
 cutscenes:{
  moulds:scene('The broken moulds','Dunlow’s Chandlery','Market Lane, Birchford',[['@crown.fenn','Oh. You found those. I was going to bury them. Honestly. Today. Probably.','Fenn Dunlow']]),
  writs:scene('Out of the Frost Gate','A quiet watch','Crown Court, Birchford',[['@crown.varn','Whoever paid in Varrow coin wants the old house remembered. I would rather know why before the whole city does.','Captain Isolde Varn']])},
 onComplete:{cutscene:'writs'},
 journalDone:'I traced the Queen’s forged seal to wax moulds cast at Dunlow’s Chandlery and paid for in coins of the fallen House Varrow. Captain Varn of the Keep Watch is watching the Frost Gate carts.',
 journalVariants:[{ifFlags:{reported_fenn:true},text:'Fenn Dunlow confessed to the Watch.'},{ifFlags:{fenn_informant:true},text:'Fenn Dunlow kept his apron and now listens in the market for me.'}],
 gold:150,xp:{crafting:1500},lamps:[{perLevel:10,minLevel:5,label:'Chancery lamp'}],
 unlocks:[
  {type:'flag',id:'crown.varrow_coin_found',label:'Birchford whispers about Varrow coin'},
  {type:'dialogue',id:'dialogue.crown-odo-1',label:'Odo trusts you',npc:'@crown.odo',lines:talk('My honest candles burn beautifully. I seal everything now. Everything. My landlady is alarmed.')},
  {type:'dialogue',id:'dialogue.crown-fenn-report',label:'Fenn remembers the Watch',npc:'@crown.fenn',ifFlags:{reported_fenn:true},lines:talk('The Watch let me off with a fine and a lecture. The lecture was worse.')},
  {type:'dialogue',id:'dialogue.crown-fenn-eyes',label:'Fenn, your eyes in the market',npc:'@crown.fenn',ifFlags:{fenn_informant:true},lines:talk('Nothing new at the vats. Well. A man bought nine candles and cried. Unrelated, I think.')}]},

{n:2,key:'arc-crown-2',name:'The Forger’s Hand',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@crown.varn',icon:'custom_qa_wax_ledger',
 requirements:{quests:['arc-crown-1'],skills:{cooking:{level:15,boostable:false}}},
 description:'Captain Varn knows of one man who could have taught anyone to forge a royal seal: Old Sable, who lives outside the Ember Gate and swears he has retired.',
 dialogue:{
  offer:talk('Only one forger in living memory could fool the Chancery. Old Sable. He forged the pardon that ended the Long Dusk, and the Crown has paid his rent ever since to keep his hands still.','He lives in a lime-washed hut past the Ember Gate. He hates the Watch. He might not hate you.','> I’ll pay him a visit.','Mind his temper. And his teeth. He still has three.'),
  progress:talk('Well? Did Sable bite?'),
  complete:talk('A ledger of every seal that was forged, and who paid. That is a noose woven out of ink.','You have done the Crown a real service. Take this, and do not spend it on candles.')},
 branchDialogue:[{stage:'complete',ifFlags:{spared_ivy:true},lines:talk('One page has been torn out of this ledger. Neatly, too.','I will not ask. I suspect I would not like either answer. Thank you, all the same.')}],
 stages:[
  {id:'sable',journal:'Captain Varn sent me to Old Sable, the retired forger who lives in a hut past the Ember Gate. The Crown pays his rent to keep his hands still.',
   npc:'@crown.sable',
   objectives:[{type:'talk',target:'@crown.sable',amount:1,label:'Find Old Sable past the Ember Gate',dialogue:talk('Footsteps like a clerk and a sword-belt that squeaks. Watch business?','> Someone is forging the Queen’s seal. Cast seals, Varrow coin.','Cast seals. Clumsy. I am blind, friend, so it was not me.','But I will feel the work, if you feed me first. Nobody has brought me a hot supper since the old king died.')}],
   dialogue:{advance:talk('Two trout, cooked properly. Not burnt. I can smell burnt from the river.')}},
  {id:'supper',journal:'Old Sable is blind, so he cannot be the forger, but he offered to read the forged seal with his fingers if I brought him a proper supper: two cooked trout.',
   npc:'@crown.sable',
   objectives:[{type:'collect',target:'trout',amount:2,label:'Bring Old Sable two cooked trout'}],
   dialogue:{advance:talk('Mm. Now, the writ.','...Oh. Oh, no. This rim, this little tallow flame hidden in the crest. That is my mark, taught to one pupil only.','My pupil keeps a book of every commission. Always did. If it exists, it is in the old lime kiln down the road, and the brute who guards the kiln is called Gutter-Jack.')}},
  {id:'kiln',journal:'Sable recognised a tiny tallow flame hidden in the seal: the mark he taught to a single pupil. That pupil keeps a ledger of commissions in the old lime kiln east along the Emberspire Road, guarded by a thug named Gutter-Jack.',
   onEnter:{cutscene:'kiln'},
   objectives:[{type:'kill',target:'@crown.jack',amount:1,label:'Deal with Gutter-Jack at the lime kiln'},{type:'have',target:'custom_qa_wax_ledger',amount:1,label:'Take the wax-stained ledger back to Old Sable'}],
   npc:'@crown.sable',
   dialogue:{choice:talk('You have it? Read me the last page. ...No. Read me the name on it.','> “Commissions taken by I. Sable.”','Ivy. My granddaughter. I taught her when she was nine, so she would never need to beg.','She would not do this for money. Somebody owns her. Please. Tear the page out. Let me find her before the Watch does.')},
   choices:[
    {id:'name',label:'The Captain gets the whole ledger, Ivy’s name included.',flags:{named_ivy:true},dialogue:talk('Then the Watch will have her by nightfall. Be kind to her in your report. She was a kind child.')},
    {id:'spare',label:'I’ll tear out her page. Find her first.',flags:{spared_ivy:true},dialogue:talk('Thank you. I will not forget this, and neither will she, if I have anything to do with it.')}]},
  {id:'report',journal:'Gutter-Jack is dealt with and I have the forger’s ledger. Its commissions were all taken by Ivy Sable, the old man’s granddaughter. I should take the ledger to Captain Varn at Crown Court.',
   objectives:[{type:'collect',target:'custom_qa_wax_ledger',amount:1,label:'Give the ledger to Captain Varn'}]}],
 cutscenes:{
  kiln:scene('The lime kiln','Kilnside','East of the Ember Gate',[['@crown.sable','Gutter-Jack used to carry my ink. Now he carries a club. Some men only get worse with practice.','Old Sable']]),
  ledger:scene('Ink and a noose','The Forger’s Ledger','Crown Court, Birchford',[['@crown.varn','Every payment signed “M.A.”. Whoever M.A. is, they are inside the Keep. That narrows it to about two hundred people.','Captain Isolde Varn']])},
 onComplete:{cutscene:'ledger'},
 journalDone:'Old Sable read the forged seal by touch and named the mark of his only pupil. I took the forger’s ledger from Gutter-Jack and gave it to Captain Varn: every commission was paid by someone signing as “M.A.”.',
 journalVariants:[{ifFlags:{named_ivy:true},text:'I gave the Captain the whole ledger, Ivy Sable’s name included.'},{ifFlags:{spared_ivy:true},text:'I tore out Ivy Sable’s page so her grandfather could find her first.'}],
 gold:400,xp:{crafting:6000,cooking:3000,agility:2500},lamps:[{perLevel:10,minLevel:10,label:'Forger’s lamp'}],
 unlocks:[
  {type:'shortcut',id:'shortcut.crown-sables-climb',label:'Sable’s Old Climb: over the north wall by the bakery (Agility 18)'},
  {type:'flag',id:'crown.forgers_ledger',label:'The Watch holds the forger’s ledger'},
  {type:'dialogue',id:'dialogue.crown-sable-named',label:'Sable is grieving',npc:'@crown.sable',ifFlags:{named_ivy:true},lines:talk('They have my Ivy in a cell. She sends word that the bread is stale and the guards are kind. Small mercies.')},
  {type:'dialogue',id:'dialogue.crown-sable-spared',label:'Sable is grateful',npc:'@crown.sable',ifFlags:{spared_ivy:true},lines:talk('Ivy is safe with me. She will not say who owns her yet. But she is safe.','My old climb over the north wall still holds, by the bakery. Use it. I owe you that much.')}]},

{n:3,key:'arc-crown-3',name:'Grain for the Frost Gate',questPoints:2,difficulty:'Intermediate',length:'Medium',giver:'@crown.varn',icon:'wheat',
 requirements:{quests:['arc-crown-2','arc-frontier-2'],skills:{agility:{level:20,boostable:false}},combat:25},
 description:'The forged writs emptied the royal granary at the Farm Gate while Winterwatch went hungry. Captain Varn wants to know where the grain really went, and who loaded it.',
 dialogue:{
  offer:talk('Winterwatch starved this winter. You may have heard. You may have fed some of them.','The writs said the grain went north through the Frost Gate. The Frost Gate wardens never saw it.','So it left by the Farm Gate, at night, past my own granary. Talk to Hobb Wainright, the drover. Gently. He frightens easily and kicks harder.'),
  progress:talk('The granary will not count itself. Unfortunately.'),
  complete:talk('My hand? My hand on the loading orders?','...It is a good copy. A very good copy. Thank you for bringing it to me and not to the court.')},
 branchDialogue:[{stage:'complete',ifFlags:{told_odo:true},lines:talk('Odo came to me first, trembling like a leaf in a gale, and told me someone was copying my hand. You trusted the right clerk.','Whoever M.A. is, they want me blamed. Thank you for not obliging them.')}],
 stages:[
  {id:'drover',journal:'Captain Varn believes the stolen grain left Birchford by the Farm Gate at night. Hobb Wainright, the drover outside the Farm Gate, might have seen the carts.',
   objectives:[{type:'talk',target:'@crown.hobb',amount:1,label:'Ask Hobb Wainright the drover about night carts',dialogue:talk('Night carts? Every third night, Watch orders, very proper. Varrow-looking lads driving.','They load at the old tithe yard west of the farm. Go after dark, keep low, and mind the dogs. There are no dogs. That is what worries me.')}]},
  {id:'yard',journal:'Hobb said the night carts load at the old tithe yard west of the farm, under proper-looking Watch orders. I should creep up on the yard and see what is being loaded.',
   objectives:[{type:'visit',x:-292,z:138,radius:4,amount:1,label:'Sneak up to the tithe yard west of the farm'}]},
  {id:'ambush',journal:'The tithe yard was full of sacks stamped for Winterwatch, and full of men wearing old Varrow crowns stitched inside their collars. They saw me.',
   onEnter:{cutscene:'ambush'},
   objectives:[{type:'event',event:'death',targets:['@crown.cutthroat1','@crown.cutthroat2','@crown.cutthroat3'],amount:3,label:'Fight off the Varrow cutthroats'}]},
  {id:'orders',journal:'I beat off the cutthroats. In the foreman’s strongbox I found the loading orders — signed, it seems, in Captain Varn’s own hand. Before I decide whom to tell, Hobb wants the honest weight back: five sacks of wheat for Winterwatch.',
   npc:'@crown.hobb',
   objectives:[{type:'collect',target:'wheat',amount:5,label:'Bring Hobb five bundles of wheat for the Winterwatch cart'}],
   dialogue:{choice:talk('Five bundles. The first honest grain to go north all year.','That paper in your hand. Is that the Captain’s writing? Then who do you tell, friend? I would not want to be you.')},
   choices:[
    {id:'confront',label:'I’ll show Captain Varn the orders to her face.',flags:{confronted_varn:true},dialogue:talk('Brave. Or daft. Same thing, mostly, at the Keep.')},
    {id:'odo',label:'I’ll take them to Odo first. Quietly.',flags:{told_odo:true},dialogue:talk('The little clerk? Hah. He is smarter than he looks. He would have to be.')}]},
  {id:'handover',journal:'The orders bear Captain Varn’s handwriting. I have decided how to handle it; now I must hand the loading orders to the Captain and watch her face.',
   objectives:[{type:'talk',target:'@crown.varn',amount:1,label:'Show Captain Varn the loading orders',dialogue:talk('These are mine. Or they look mine. Look at the “V”, though. I have never closed a “V” in my life.')}]}],
 cutscenes:{
  ambush:scene('The tithe yard','Varrow’s men','West of the Farm Gate',[['@crown.hobb','Told you there were no dogs. There are worse than dogs.','Hobb Wainright']]),
  framed:scene('A good copy','Someone wants a culprit','Crown Court, Birchford',[['@crown.varn','Someone has been practising my signature. In the same ink Old Sable’s pupil uses. I think I am meant to hang for this.','Captain Isolde Varn']])},
 onComplete:{cutscene:'framed'},
 journalDone:'The royal grain left by the Farm Gate on forged Watch orders and was loaded by Varrow cutthroats. The orders are in a copy of Captain Varn’s hand: someone wants her blamed. Five honest bundles of wheat went north to Winterwatch.',
 journalVariants:[{ifFlags:{confronted_varn:true},text:'I showed the Captain the orders to her face.'},{ifFlags:{told_odo:true},text:'I went to Odo first, quietly, and he warned the Captain.'}],
 gold:600,xp:{agility:7000,strength:5000,farming:3000},lamps:[{perLevel:10,minLevel:15,label:'Drover’s lamp'}],
 unlocks:[
  {type:'flag',id:'crown.granary_saved',label:'Birchford’s granary sends grain north again'},
  {type:'dialogue',id:'dialogue.crown-hobb-3',label:'Hobb drives honest carts',npc:'@crown.hobb',lines:talk('Twelve carts went north this week. Real ones. With dogs.')},
  {type:'dialogue',id:'dialogue.crown-odo-3',label:'Odo is now brave (slightly)',npc:'@crown.odo',ifFlags:{told_odo:true},lines:talk('I walked into the Captain’s office without knocking. I have never felt so alive. I had to sit down afterwards.')}]},

{n:4,key:'arc-crown-4',name:'The Mistress of Ceremonies',questPoints:3,difficulty:'Experienced',length:'Long',giver:'@crown.odo',icon:'candle',
 requirements:{quests:['arc-crown-3'],qp:16,skills:{crafting:{level:30,boostable:false},smithing:{level:20,boostable:false},agility:{level:25,boostable:false}}},
 description:'Captain Varn has been arrested on the word of Lady Merrow Ashgrove, the Queen’s Mistress of Ceremonies. Odo is beside himself, and the Feast of Lamps is in three days.',
 dialogue:{
  offer:talk('They took her. The Captain. In chains, in the middle of Crown Court, on the say-so of Lady Merrow Ashgrove!','Lady Merrow plans the Feast of Lamps. Lady Merrow plans everything. M.A., you said? Merrow Ashgrove. I feel faint.','> We need proof the Queen will believe.','Then we need the forger herself. Ivy Sable. Find her, please, before Lady Merrow does.'),
  progress:talk('The Feast is coming and the Captain is in a cell. I have sealed my door twice.'),
  complete:talk('The Captain is free! On the strength of a writ sealed with an honest seal cast by Marta herself. Beautiful. Legal. Nearly.','And Lady Merrow has gone very quiet, and very quietly asked for the keys to the old Undervault. Here, take these. If she goes down there, so do we.')},
 stages:[
  {id:'ivy',journal:'Lady Merrow Ashgrove — M.A. — had Captain Varn arrested. Odo begged me to find Ivy Sable, the forger, before Merrow does. Ivy writes letters for people near the Gilded Antler on Southgate Row.',
   objectives:[{type:'talk',target:'@crown.ivy',amount:1,label:'Find Ivy Sable on Southgate Row',dialogue:talk('You are the one who found Grandfather’s mark.','She found me when I was fifteen. Paid our debts, gave me a room, gave me orders. Lady Merrow does not hire people. She owns them.','She is a Varrow, on her mother’s side. She does not want the throne. She wants a Varrow king on it, and she has made one.','> Made one?','Out of wax. Out of my moulds and the Varrow crown she kept. She will light it at the Feast of Lamps. The ceremony is written in her cipher. I can read it, if you can find the lamps.')}]},
  {id:'first-lamp',journal:'Ivy says Merrow is a Varrow and means to crown a king made of wax at the Feast of Lamps. Merrow’s ceremony is hidden in a lamp-lighter’s cipher: “Where the bell was quiet, first.” That sounds like the top of Bell Lane.',
   onEnter:{cutscene:'cipher'},
   objectives:[{type:'visit',x:-226.8,z:95,radius:3,amount:1,label:'Find the first lamp of the cipher'}]},
  {id:'second-lamp',journal:'At the top of Bell Lane a lamp-post had a candle-flame scratched into it, and a second line: “Then where the prayers walk west.” The little lane west of the temple of the Morning Bell runs that way.',
   objectives:[{type:'visit',x:-250,z:118,radius:3,amount:1,label:'Find the second lamp of the cipher'}]},
  {id:'third-lamp',journal:'The end of Chapel Lane held the second mark: “Last where the market meets the dawn.” Market Street runs east towards the Ember Gate and the sunrise.',
   objectives:[{type:'visit',x:-176,z:133.5,radius:3,amount:1,label:'Find the third lamp of the cipher'}]},
  {id:'chancellor',journal:'With the three marks, Ivy read the cipher: the ceremony’s instructions are kept in the old Chancellor’s House by Crown Court, which Merrow uses as her dressing rooms. I need to slip in without being seen.',
   objectives:[{type:'visit',x:-246.5,z:190.5,radius:3,amount:1,label:'Slip into the Chancellor’s House by Crown Court'}]},
  {id:'true-seal',journal:'Merrow’s instructions name the Undervault below the Keep, where the wax king waits. To free Captain Varn in time, Odo needs a release writ sealed with a true seal. Marta Kell can cast one if I bring her a silver bar.',
   npc:'@crown.marta',
   objectives:[{type:'collect',target:'silverBar',amount:1,label:'Bring Marta Kell a silver bar for a true seal'}],
   dialogue:{advance:talk('Silver for a royal seal. Pressed, not cast, as the old rules say. Watch.','There. Now Odo can write the release and nobody in Birchford can say it is false.')}},
  {id:'release',journal:'Marta pressed a true royal seal. I should take it to Captain Varn in the Keep cells by Crown Court so the release can be made in her presence, then report to Odo.',
   objectives:[{type:'talk',target:'@crown.varn',amount:1,label:'Free Captain Varn',dialogue:talk('A true seal, Marta’s pressing. Odo’s handwriting. And you.','The Feast of Lamps. Merrow means to light her king in the Undervault. Get the keys from Odo. I will gather the Watch.')}]}],
 cutscenes:{
  cipher:scene('The lamp-lighter’s cipher','Merrow’s cipher','Southgate Row, Birchford',[['@crown.ivy','Three lamps, three lines. Lamplighters used to mark the old routes this way. Merrow loves anything old.','Ivy Sable']]),
  keys:scene('The Undervault keys','Below the Keep','Crown Court, Birchford',[['@crown.merrow','How kind of you all to fuss. The Feast will be unforgettable. I have seen to that.','Lady Merrow Ashgrove']])},
 onComplete:{cutscene:'keys'},
 journalDone:'Ivy Sable revealed that Lady Merrow Ashgrove is a Varrow who has made a king of wax to crown at the Feast of Lamps. I followed her lamp cipher, read her instructions in the Chancellor’s House, and freed Captain Varn with a true seal. Odo gave me the keys to the Undervault.',
 gold:1200,xp:{crafting:20000,agility:15000,smithing:12000},lamps:[{amount:15000,minLevel:30,label:'Lamplighter’s lamp (any skill of level 30+)'}],
 unlocks:[
  {type:'area',id:'area.crown-undervault',label:'The Undervault hatch at Crown Court'},
  {type:'flag',id:'crown.varn_freed',label:'Captain Varn is free'},
  {type:'dialogue',id:'dialogue.crown-marta-4',label:'Marta presses true seals',npc:'@crown.marta',lines:talk('I press every royal seal by hand now. My wrists ache. My conscience does not.')},
  {type:'dialogue',id:'dialogue.crown-ivy-4',label:'Ivy is free of Merrow',npc:'@crown.ivy',lines:talk('I write letters for people who cannot. Honest ones. They pay in turnips. I have never been happier.')}]},

{n:5,key:'arc-crown-5',name:'The Tallow Crown',questPoints:5,difficulty:'Master',length:'Very long',giver:'@crown.varn',icon:'custom_qa_tallow_signet',
 requirements:{quests:['arc-crown-1','arc-crown-2','arc-crown-3','arc-crown-4'],qp:34,skills:{crafting:{level:40,boostable:false},agility:{level:35,boostable:false},smithing:{level:30,boostable:false}},combat:55},
 description:'The Feast of Lamps has come. Lady Merrow Ashgrove means to crown a king of wax in the Undervault below Birchford Keep. Captain Varn means to stop her. So do you.',
 dialogue:{
  offer:talk('The Feast starts at dusk. Merrow will play the gracious host up here while her wax king waits below.','We light the Feast honestly, we unmask her in front of the whole court, and when she runs, we follow her down.','> Then let’s light some lamps.','Odo wants candles. Of course he does. Go on.'),
  progress:talk('The Watch holds the court. The Undervault is yours.'),
  complete:talk('The Varrow crown, melted. And the wax king is a puddle on a chapel floor.','Her Majesty asked me to give you this signet, and her thanks, and the freedom of the Treasury stair. You have earned more. These are what we have.')},
 branchDialogue:[
  {stage:'complete',ifFlags:{exiled_merrow:true},lines:talk('Exile. You showed her mercy she never showed anyone. Her Majesty approves, which surprised me.','Take this signet, her thanks, and the freedom of the Treasury stair.')},
  {stage:'complete',ifFlags:{tried_merrow:true},lines:talk('Merrow will stand trial before the whole court, as the law wants. It will be ugly. It will be fair.','Take this signet, Her Majesty’s thanks, and the freedom of the Treasury stair.')}],
 stages:[
  {id:'candles',journal:'Tonight is the Feast of Lamps. Captain Varn will unmask Lady Merrow before the court. First, Odo wants the Feast lit honestly: four candles from someone he trusts.',
   npc:'@crown.odo',onEnter:{cutscene:'feast'},
   objectives:[{type:'collect',target:'candle',amount:4,label:'Bring Odo four candles for the Feast of Lamps'}],
   dialogue:{advance:talk('Four honest flames. If she wanted ceremony, she shall have it, and all of it true.')}},
  {id:'unmask',journal:'The Feast candles are lit. Captain Varn is waiting at Crown Court for the moment to read Merrow’s cipher aloud before the court.',
   objectives:[{type:'visit',x:-232,z:170,radius:5,amount:1,label:'Stand with Captain Varn at the Feast in Crown Court'}]},
  {id:'descend',journal:'Captain Varn read Merrow’s cipher before the whole court. Merrow laughed, threw her goblet into a brazier, and fled through the Undervault hatch. I must follow her into the Undervault.',
   onEnter:{cutscene:'unmasked'},
   objectives:[{type:'visit',x:1425,z:3000,radius:7,amount:1,label:'Follow Merrow into the Undervault’s wax cellars'}]},
  {id:'sentries',journal:'The wax cellars are guarded by sentries poured from candle-ends. They have noticed me.',
   objectives:[{type:'event',event:'death',targets:['@crown.sentry1','@crown.sentry2'],amount:2,label:'Break the Tallow sentries'}]},
  {id:'regent',journal:'Past the sentries, in the old Varrow chapel, the wax king has woken: the Tallow Regent, wearing the Varrow crown. Merrow is singing to it.',
   onEnter:{cutscene:'regent'},
   objectives:[{type:'kill',target:'@crown.regent',amount:1,label:'Defeat the Tallow Regent'},{type:'have',target:'custom_qa_varrow_crown',amount:1,label:'Take the melted Varrow crown'}]},
  {id:'judgement',journal:'The Tallow Regent is a puddle and the Varrow crown has slumped in the heat. Lady Merrow is cornered in the chapel. Her fate is in my hands.',
   npc:'@crown.merrow_vault',
   objectives:[{type:'talk',target:'@crown.merrow_vault',amount:1,label:'Confront Lady Merrow in the chapel',dialogue:talk('Do you know what it is to be the last of something? Every portrait in the Keep was once my family.','I did not want the throne. I wanted someone in it who remembered us.')}],
   dialogue:{choice:talk('Well? The Watch is coming down the stair. Decide, hero.')},
   choices:[
    {id:'exile',label:'Go. Take the river road and never come back to Birchford.',flags:{exiled_merrow:true},dialogue:talk('Mercy. How terribly unfashionable. ...Thank you.')},
    {id:'trial',label:'You’ll stand trial before the court you lied to.',flags:{tried_merrow:true},dialogue:talk('Then I shall wear my best gown. If I must lose, I will lose beautifully.')}]},
  {id:'crown',journal:'I have decided Lady Merrow’s fate. The melted Varrow crown should go to Captain Varn at Crown Court.',
   objectives:[{type:'collect',target:'custom_qa_varrow_crown',amount:1,label:'Give the melted Varrow crown to Captain Varn'}]}],
 cutscenes:{
  feast:scene('The Feast of Lamps','The Feast of Lamps','Birchford Keep, at dusk',[['@crown.varn','Merrow will toast the Queen’s health in a minute. She does it beautifully. Let her finish. Then we begin.','Captain Isolde Varn']]),
  unmasked:scene('Unmasked','The Mistress unmasked','Crown Court, Birchford',[['@crown.merrow','A cipher read aloud at my own feast? How dreadfully rude. Do excuse me. I have a king to wake.','Lady Merrow Ashgrove']]),
  regent:scene('The Tallow Regent','The Tallow Regent','The Undervault chapel',[['@crown.merrow_vault','Rise, Your Majesty. The Varrow line has waited long enough.','Lady Merrow Ashgrove']]),
  dawn:scene('Dawn over the Keep','The Lamplit Court','Birchford, the morning after',[['@crown.odo','The Treasury stair is open to you now, and the Quartermaster sends his compliments. And a bill. For the chapel floor.','Odo Penwhistle']])},
 onComplete:{cutscene:'dawn'},
 journalDone:'At the Feast of Lamps, Captain Varn unmasked Lady Merrow Ashgrove. I followed her into the Undervault, broke her tallow sentries and melted the Tallow Regent, the wax king of House Varrow. Birchford is safe, the Treasury stair is open to me, and Her Majesty sent a signet that brings me back to Crown Court.',
 journalVariants:[{ifFlags:{exiled_merrow:true},text:'I let Merrow go into exile. Some say she sings in a river inn now.'},{ifFlags:{tried_merrow:true},text:'Merrow stood trial before the court. She wore her best gown.'}],
 gold:5000,xp:{crafting:60000,agility:40000,defence:35000,strength:30000},items:{custom_qa_tallow_signet:1,'armor:crownwardenSigil':1},
 lamps:[{amount:20000,minLevel:40,label:'Crown lamp (any skill of level 40+)'}],
 unlocks:[
  {type:'teleport',id:'teleport.crown-court',label:'Signet of the Lamplit Court: Crown Court, Birchford',x:-232,z:168},
  {type:'area',id:'area.crown-arcade',label:'Treasury stair: the Royal Quartermaster and the Gilded Regent (harder mode)'},
  {type:'area',id:'lair:hollow_throne',label:'The Hollow Throne: the first Varrow king sleeps below Hollowmere'},
  {type:'flag',id:'crown.lamplit_court',label:'Birchford honours the Lamplit Court'},
  {type:'dialogue',id:'dialogue.crown-varn-5',label:'Captain Varn salutes you',npc:'@crown.varn',lines:talk('Captain of the Watch, thanks to you, and not hanged, thanks to you. I count both.','Merrow’s papers name one more Varrow: the first king, the Hollow one, in the crypts below Hollowmere. Go carefully if you go.')},
  {type:'dialogue',id:'dialogue.crown-odo-5',label:'Odo, Chancery hero',npc:'@crown.odo',lines:talk('They promoted me to Clerk. Not under. Just Clerk. I had a cake made. It was sealed.')},
  {type:'dialogue',id:'dialogue.crown-merrow-exile',label:'Merrow’s empty chair',npc:'@crown.merrow',ifFlags:{exiled_merrow:true},lines:talk('(Lady Merrow’s chair stands empty. Someone has left a single candle on it, unlit.)')},
  {type:'dialogue',id:'dialogue.crown-merrow-trial',label:'Merrow awaits judgement',npc:'@crown.merrow',ifFlags:{tried_merrow:true},lines:talk('My trial is on Thursday. I have chosen the gown. Do come; the court has never looked so alive.')},
  {type:'dialogue',id:'dialogue.crown-fenn-5',label:'Fenn’s commemorative candles',npc:'@crown.fenn',lines:talk('Feast of Lamps souvenir candles! Shaped like the Tallow Regent! Too soon? Too soon.')}]}
];
