import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {GEAR_TIERS,tierById,maxHit,effectiveLevel,attackRoll,defenceRoll,hitChance,HIT_SCALE,monsterStats,playerAttackProfile,rollPlayerHit,rollMonsterHit,requirementError,spellMaxHit,bestArrow,arrowSupply,attackPeriod,TICK_SECONDS,styleLabels,bonuses} from '../gear-tiers.js';
import {weaponCatalog} from '../weapons.js';import {shieldCatalog} from '../shields.js';import {outfitItems} from '../outfits.js';
import {armorCatalog,equipmentBonuses,equipRefusal,gearDetails} from '../melee-stats.js';
import {professionRecipes,professionItems} from '../profession-data.js';import {goods} from '../economy.js';
import {XP_TABLE} from '../combat-level.js';
import {equipmentStats} from '../equipment-stats.js';

test('gear tiers follow the OSRS level ladder with Eldervale metals and distinct colours',()=>{
 assert.deepEqual(GEAR_TIERS.map(t=>[t.name,t.level]),[['Bronze',1],['Iron',1],['Steel',5],['Blacksteel',10],['Moonsilver',20],['Verdite',30],['Tidesteel',40],['Embersteel',60],['Eldersteel',70]]);
 assert.equal(new Set(GEAR_TIERS.map(t=>t.color)).size,GEAR_TIERS.length);
 for(const name of ['mithril','adamant','rune','dragon','barrows'])assert.ok(!GEAR_TIERS.some(t=>t.name.toLowerCase().includes(name)),name);
 for(let i=1;i<GEAR_TIERS.length;i++){assert.ok(GEAR_TIERS[i].weapon>GEAR_TIERS[i-1].weapon);assert.ok(GEAR_TIERS[i].armour>GEAR_TIERS[i-1].armour)}
 // Every metal weapon type exists in every tier with the tier's Attack requirement and rising bonuses.
 for(const piece of ['dagger','scimitar','longsword','hammer','battleaxe','twohand','spear']){let last=-1;for(const t of GEAR_TIERS){const key=t.id==='iron'?piece:t.id+piece[0].toUpperCase()+piece.slice(1),w=weaponCatalog[key];assert.ok(w,key);assert.equal(w.req.attack||1,t.level,key);assert.ok(w.bonuses.str>last,key);last=w.bonuses.str}}
 for(const t of ['bronze','steel','moonsilver','verdite','tidesteel','embersteel','eldersteel']){assert.equal(outfitItems[t+'Breastplate'].req.defence||1,tierById[t].level);assert.equal(outfitItems[t+'Breastplate'].tint,tierById[t].color);assert.equal(shieldCatalog[t+'Kiteshield'].req.defence||1,tierById[t].level)}
 assert.equal(outfitItems.knightBreastplate3.req.defence,10,'the blacksteel colour variant is the blacksteel tier');
 assert.equal(weaponCatalog.yewShortbow.req.ranged,40);assert.equal(weaponCatalog.amethystStaff.req.magic,30);assert.equal(outfitItems.wizardRobeTop3.req.magic,40);
});

test('OSRS formulas: effective level, max hit, rolls and hit chance',()=>{
 assert.equal(effectiveLevel(1,0),9);assert.equal(effectiveLevel(99,3),110);
 assert.equal(maxHit(9,0),1);assert.equal(maxHit(110,0),11);assert.equal(maxHit(118,140),38,'99 Str + 3 + 8 with +140 strength bonus (ignoring prayer, void) → 38');
 assert.equal(maxHit(12,6,HIT_SCALE),13,'Eldervale damage is 10x OSRS resolution');
 assert.equal(attackRoll(110,100),110*164);assert.equal(defenceRoll(9,0),576);
 assert.equal(hitChance(1000,500),1-502/2002);assert.equal(hitChance(500,1000),500/2002);assert.ok(hitChance(10,10)<.5);
 assert.equal(spellMaxHit(1,'wave'),2);assert.equal(spellMaxHit(35,'strike'),8);assert.equal(spellMaxHit(35,'bolt'),12);assert.equal(spellMaxHit(99,'wave'),20);
 const p=playerAttackProfile({levels:{},bonuses:bonuses(),weapon:null,style:'slash'});assert.equal(p.type,'crush','unarmed punches crush');assert.equal(p.osrsMaxHit,1);
});

test('equipment bonuses add up and show in the stats panel and tooltips',()=>{
 const state={equippedWeapon:'scimitar',equippedShield:'kite',equipped:{chest:true,helm:true}};
 const b=equipmentBonuses(state);assert.equal(b.aslash,weaponCatalog.scimitar.bonuses.aslash);assert.equal(b.dslash,armorCatalog.chest.bonuses.dslash+armorCatalog.helm.bonuses.dslash+shieldCatalog.kite.bonuses.dslash);
 assert.ok(b.amagic<0,'plate has a magic attack penalty');
 assert.equal(equipmentBonuses({equippedWeapon:'twohand',equippedShield:'kite',equipped:{}}).dslash,weaponCatalog.twohand.bonuses.dslash,'no shield with a two-handed weapon');
 const s=equipmentStats({...state,attackXP:0,strengthXP:0},'slash');assert.equal(s.profile.type,'slash');assert.equal(s.speedTicks,4);assert.ok(s.profile.maxHit>0);
 assert.match(gearDetails('weapon:moonsilverScimitar'),/Requires Attack 20 · Att Stab \+\d+ · Att Slash \+\d+.*Speed 4 ticks/);
 assert.match(gearDetails('armor:tidesteelGreaves'),/^Requires Defence 40/);
 assert.equal(goods['weapon:verditeLongsword'].req.attack,30);
});

test('equipping above your level is refused with the OSRS message; removing never is',()=>{
 const fresh={attackXP:0,defenceXP:0,rangedXP:0,magicXP:0,equipped:{}};
 assert.equal(equipRefusal(fresh,'weapon:moonsilverScimitar'),'You need an Attack level of 20 to wield this.');
 assert.equal(equipRefusal(fresh,'armor:verditeBreastplate'),'You need a Defence level of 30 to wear this.');
 assert.equal(equipRefusal(fresh,'weapon:willowShortbow'),'You need a Ranged level of 20 to wield this.');
 assert.equal(equipRefusal(fresh,'weapon:emberStaff'),'You need a Magic level of 40 to wield this.');
 assert.equal(equipRefusal(fresh,'armor:rangerTunic2'),'You need a Defence level of 40 to wear this.');
 assert.equal(equipRefusal({...fresh,defenceXP:XP_TABLE[40]},'armor:rangerTunic2'),'You need a Ranged level of 40 to wear this.');
 for(const id of ['weapon:dagger','weapon:bronzeScimitar','armor:chest','shield:kite','weapon:woodenBow','weapon:apprenticeStaff','armor:cape'])assert.equal(equipRefusal(fresh,id),null,id);
 assert.equal(equipRefusal({...fresh,attackXP:XP_TABLE[20]},'weapon:moonsilverScimitar'),null);
 assert.equal(requirementError({attack:5},{attack:4}),'You need an Attack level of 5 to wield this.');
 // The server mirrors this in the equip command; the migration only blocks putting gear on.
 const sql=readFileSync(new URL('../db/osrs-equipment-combat.sql',import.meta.url),'utf8');
 assert.match(sql,/equip_blocked\(s\.equipment,s\.skills,slot,key,c\)/);assert.match(sql,/You need %s %s level of %s to %s this\./);
});

test('monsters get OSRS stat blocks that keep the castle tutorial winnable',()=>{
 const dummy=monsterStats({species:'dummy',template:'training_dummy',level:1,hp:5000,damage:0});assert.equal(dummy.maxHit,0);assert.equal(dummy.dummy,true);
 const fresh=playerAttackProfile({levels:{},bonuses:equipmentBonuses({equippedWeapon:'bronzeSword',equipped:{}}),weapon:weaponCatalog.bronzeSword,style:'stab'});
 let rng=0;const seq=()=>(rng=(rng*9301+49297)%233280)/233280;
 for(let i=0;i<200;i++)assert.ok(rollPlayerHit(fresh,{species:'dummy',level:1},seq)>=1,'every dummy swing lands and trains');
 assert.equal(rollMonsterHit({species:'dummy',level:1},{},seq),0);
 // A fresh player beats a cellar rat (8 hp) comfortably: expected damage per swing vs per rat bite.
 const rat={name:'Cellar rat',level:1,hp:8,damage:1,attackType:'bite'},rs=monsterStats(rat);
 let dealt=0,taken=0;for(let i=0;i<4000;i++){dealt+=rollPlayerHit(fresh,rat,seq);taken+=rollMonsterHit(rat,{},seq)}
 const swingsToKill=8/(dealt/4000),damageTaken=swingsToKill*taken/4000;assert.ok(swingsToKill<4,'rat dies in a few swings: '+swingsToKill);assert.ok(damageTaken<25,'and costs little of 100 health: '+damageTaken);
 assert.ok(rs.maxHit<=20);
 // Hit sizes track the old damage values: max hit ≈ 2 × the old average hit.
 for(const [level,damage] of [[6,4],[24,15],[75,38],[100,55]]){const m=monsterStats({level,damage});assert.ok(Math.abs(m.maxHit-2*(6+damage)*Math.max(1,1+(level-20)/80))<=2,level)}
 assert.equal(monsterStats({attackType:'fire',level:75}).attackStyle,'magic');assert.equal(monsterStats({attackType:'arrow'}).attackStyle,'ranged');
});

test('arrows and bows: tiers, caps and Rapid',()=>{
 assert.equal(bestArrow({arrows:3,steelArrows:2,moonsilverArrows:1},'oakShortbow'),'steelArrows');assert.equal(bestArrow({steelArrows:2},'woodenBow'),null);
 assert.equal(arrowSupply({arrows:3,steelArrows:2,moonsilverArrows:1},'oakShortbow'),5);
 const s=equipmentBonuses({equippedWeapon:'mapleShortbow',equipped:{},verditeArrows:5,arrows:9});assert.equal(s.arrow,'verditeArrows');assert.equal(s.rstr,31);
 assert.equal(attackPeriod(weaponCatalog.oakShortbow,'slash'),weaponCatalog.oakShortbow.speed-TICK_SECONDS);assert.equal(attackPeriod(weaponCatalog.scimitar,'slash'),weaponCatalog.scimitar.speed);
 assert.equal(styleLabels(weaponCatalog.oakShortbow).slash[0],'Rapid');assert.match(styleLabels(weaponCatalog.scimitar).stab[0],/Accurate \(Slash\)/);
});

test('tier gear is obtainable: smithing, fletching and Eldervale metal names',()=>{
 for(const t of ['bronze','steel','moonsilver','verdite','tidesteel'])for(const out of ['weapon:'+t+'Scimitar','armor:'+t+'Breastplate','shield:'+t+'Kiteshield'])assert.ok(Object.values(professionRecipes).some(r=>r.outputs[out]),out);
 assert.ok(Object.values(professionRecipes).some(r=>r.outputs['armor:knightBreastplate3']),'blacksteel plate is smithable');
 const scim=Object.values(professionRecipes).find(r=>r.outputs['weapon:tidesteelScimitar']);assert.equal(scim.inputs.runiteBar,2);assert.equal(scim.level,90);
 assert.equal(professionItems.mithrilBar.name,'Moonsilver bar');assert.equal(professionItems.runiteOre.name,'Tidestone ore');
 assert.ok(professionRecipes.fletch_yewShortbow&&professionRecipes.fletch_tidesteelArrows);
 assert.equal(weaponCatalog.moonsilverScimitar.model,'scimitar');assert.equal(weaponCatalog.moonsilverScimitar.tint,tierById.moonsilver.color);
});
