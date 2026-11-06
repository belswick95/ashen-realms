// Pure rules behind the owner console's full-control tabs (admin-full.js). No DOM here, so
// tests/admin-full-control.test.js exercises them directly. Server twins live in
// db/admin-full-control.sql; keep the limits in step.

export const SKILLS=['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'];
export const skillLabel=s=>s[0].toUpperCase()+s.slice(1);
// Save keys: woodcutting and mining XP live in stats as woodXP / miningXP; the rest in skills.
export const xpKey=s=>s==='woodcutting'?'woodXP':s+'XP';
export const XP_KEYS=SKILLS.map(xpKey);
export const statsXpKey=k=>k==='woodXP'||k==='miningXP';

// ------------------------------------------------------------------ catalog
// Every editable field is a path into the item's JSON. Groups are rendered in order; any key not
// listed (now or in future migrations) stays editable in the Advanced JSON box.
const num=(path,label,min,max,step=1)=>({path,label,type:'number',min,max,step});
const bool=(path,label,defaultTrue=false)=>({path,label,type:'bool',defaultTrue});
const text=(path,label,max=80)=>({path,label,type:'text',max});
const STYLES=['stab','slash','crush','ranged','magic'];
export const EQUIP_FIELDS=[['','Not equipment'],['weaponsOwned','Weapon'],['armorOwned','Armour'],['shieldsOwned','Shield'],['jewelryOwned','Jewellery'],['mountsOwned','Mount']];
export const CATALOG_GROUPS=[
 {title:'General',fields:[text(['name'],'Name'),{path:['examine'],label:'Examine text',type:'textarea',max:600,examine:true},text(['category'],'Category'),text(['icon'],'Icon key'),text(['model'],'World model'),text(['tier'],'Tier (e.g. bronze, iron, rune)'),text(['color'],'Tier colour (#hex or number)')]},
 {title:'Value & trading',fields:[num(['buy'],'Value / shop buy price',0,2000000000),num(['sell'],'Shop sell price',0,2000000000),bool(['stackable'],'Stackable'),bool(['notable'],'Can be banked as notes',true),bool(['unique'],'Unique (one per player)'),bool(['tradeable'],'Tradeable between players',true),bool(['members'],'Members item')]},
 {title:'Consumable',fields:[num(['heal'],'Heals HP',0,10000),num(['healPct'],'Heals % of max HP',0,100)]},
 {title:'Equipment',fields:[{path:['field'],label:'Equipment type',type:'select',options:EQUIP_FIELDS},text(['key'],'Equipment key'),text(['slot'],'Equip slot'),num(['attackSpeed'],'Attack speed (ticks)',1,20),bool(['twoHanded'],'Two-handed'),bool(['ranged'],'Ranged weapon'),bool(['magic'],'Magic weapon')]},
 {title:'Requirements (level 1–99)',fields:['attack','strength','defence','ranged','magic','prayer'].map(s=>num(['requirements',s],skillLabel(s),1,99))},
 {title:'Attack bonuses',fields:STYLES.map(s=>num(['bonuses','attack',s],skillLabel(s),-1000,1000))},
 {title:'Defence bonuses',fields:STYLES.map(s=>num(['bonuses','defence',s],skillLabel(s),-1000,1000))},
 {title:'Other bonuses',fields:[num(['bonuses','strength'],'Melee strength',-1000,1000),num(['bonuses','rangedStrength'],'Ranged strength',-1000,1000),num(['bonuses','magicDamage'],'Magic damage %',-1000,1000),num(['bonuses','prayer'],'Prayer',-1000,1000)]},
 {title:'Legacy combat stats',fields:[num(['attack'],'Accuracy (legacy attack)',-1000,1000),num(['damage'],'Damage',0,10000),num(['speed'],'Seconds per swing',0.6,30,0.1),num(['reach'],'Reach (m)',0,40,0.1),num(['defence'],'Defence',-1000,1000),num(['reduction'],'Damage reduction',0,1000)]},
];
export const CATALOG_FIELDS=CATALOG_GROUPS.flatMap(g=>g.fields);
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const getPath=(o,p)=>p.reduce((v,k)=>isObj(v)?v[k]:undefined,o);
function setPath(o,p,v){let t=o;for(const k of p.slice(0,-1)){if(!isObj(t[k]))t[k]={};t=t[k]}t[p.at(-1)]=v}
function unsetPath(o,p){const stack=[];let t=o;for(const k of p.slice(0,-1)){if(!isObj(t?.[k]))return;stack.push([t,k]);t=t[k]}delete t[p.at(-1)];for(const [parent,k] of stack.reverse())if(isObj(parent[k])&&!Object.keys(parent[k]).length)delete parent[k]}
// Weapons, armour and shields keep their examine text in `desc`; inventory items in `description`.
export const examineKey=(id,data={})=>'desc' in data&&!('description' in data)?'desc':'description' in data?'description':String(id).startsWith('item:')?'description':'desc';

// Split a catalog row into form values (by field path) and the leftover JSON shown as Advanced.
export function catalogForm(id,data={}){
 const extra=structuredClone(data),values={},ek=examineKey(id,data);
 for(const f of CATALOG_FIELDS){const path=f.examine?[ek]:f.path,v=getPath(data,path);
  if(f.type==='bool')values[f.path.join('.')]=v===undefined?!!f.defaultTrue:!!v;else values[f.path.join('.')]=v??'';
  unsetPath(extra,path)}
 for(const k of ['ownerEdited'])delete extra[k];
 return {values,extra,examineKey:ek};
}
// Rebuild the row: Advanced JSON first, then every form field on top. Empty numbers and default
// booleans are left out so the stored JSON stays as small as the original.
export function buildCatalogData(id,values,extra={},ek=examineKey(id,extra)){
 if(!isObj(extra))throw Error('Advanced JSON must be an object');
 const out=structuredClone(extra);
 for(const f of CATALOG_FIELDS){const key=f.path.join('.'),raw=values[key],path=f.examine?[ek]:f.path;
  if(f.type==='bool'){if(!!raw===!!f.defaultTrue)unsetPath(out,path);else setPath(out,path,!!raw);continue}
  if(raw===''||raw===undefined||raw===null){unsetPath(out,path);continue}
  if(f.type==='number'){const n=Number(raw);if(!Number.isFinite(n))throw Error(f.label+' must be a number');setPath(out,path,n)}
  else if(f.path[0]==='color'&&/^\d+$/.test(String(raw)))setPath(out,path,Number(raw));
  else setPath(out,path,String(raw).trim())}
 return out;
}
export const CATALOG_ID=/^[a-z]{2,16}(:[A-Za-z0-9_]{1,60}){1,2}$/;
export function validateCatalogDraft(id,data,{create=false,existing=new Set()}={}){
 const errors=[];
 if(!CATALOG_ID.test(id||''))errors.push('ID must look like prefix:name, e.g. item:custom_royal_bread');
 else if(/^item:note:/.test(id))errors.push('Bank notes follow their original item; edit that instead.');
 else if(![...existing].some(e=>e.split(':')[0]===id.split(':')[0]))errors.push('Unknown prefix '+id.split(':')[0]+': use one that already exists (item, weapon, armor, shield…).');
 if(create&&existing.has(id))errors.push('ID '+id+' already exists.');
 if(!create&&!existing.has(id))errors.push('Item '+id+' not found.');
 const name=String(data?.name||'').trim();if(name.length<1||name.length>80)errors.push('Name must be 1–80 characters.');
 for(const f of CATALOG_FIELDS){if(f.type!=='number')continue;const v=getPath(data,f.path);if(v===undefined)continue;if(typeof v!=='number'||v<f.min||v>f.max)errors.push(f.label+' must be '+f.min+'–'+f.max+'.')}
 for(const [k,v] of Object.entries(data?.requirements||{}))if(!Number.isInteger(v)||v<1||v>99)errors.push('Requirement '+k+' must be a level 1–99.');
 if(JSON.stringify(data||{}).length>16000)errors.push('Item definition too large.');
 return errors;
}
export function catalogKind(id,data={}){
 if(data.noteOf||/^item:note:/.test(id))return 'Notes';
 if(id.startsWith('item:')&&data.field)return 'Equipment';
 if(id.startsWith('item:'))return 'Items';
 const p=id.split(':')[0];return p==='weapon'?'Weapons':p==='armor'?'Armour':p==='shield'?'Shields':'Other';
}
export function duplicateId(id,existing=new Set()){
 const base=id.replace(/_copy\d*$/,'');for(let i=1;i<1000;i++){const next=base+'_copy'+(i>1?i:'');if(!existing.has(next))return next}
 throw Error('No free copy ID');
}
export function catalogMatches(row,query='',chip=''){
 const d=row.data||{};
 if(chip==='Custom'&&!d.custom)return false;if(chip==='Edited'&&!d.ownerEdited)return false;if(chip==='Disabled'&&!d.disabled)return false;
 if(chip&&!['Custom','Edited','Disabled'].includes(chip)&&catalogKind(row.id,d)!==chip)return false;
 const hay=(row.id+' '+(d.name||'')+' '+(d.category||'')+' '+(d.tier||'')).toLowerCase();
 return String(query).toLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));
}

// ------------------------------------------------------------------ multipliers
export const MULTIPLIER_LIMITS={xp:[0,100],dropRate:[0,100],respawn:[0.05,20],shopPrice:[0.05,20]};
export function normalizeMultipliers(v={}){
 const out={xp:1,dropRate:1,respawn:1,shopPrice:1,skills:{}};
 for(const [k,[lo,hi]] of Object.entries(MULTIPLIER_LIMITS)){const n=Number(v[k]??1);if(!Number.isFinite(n)||n<lo||n>hi)throw Error(k+' multiplier must be '+lo+'–'+hi);out[k]=n}
 for(const [s,n] of Object.entries(v.skills||{})){if(!SKILLS.includes(s))throw Error('Unknown skill '+s);const m=Number(n);if(!Number.isFinite(m)||m<0||m>100)throw Error(s+' multiplier must be 0–100');if(m!==1)out.skills[s]=m}
 return out;
}
export const effectiveXp=(m,skill)=>Math.round(100*(m.xp??1)*(m.skills?.[skill]??1))/100;
export function validateTimeOverride(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>24)throw Error('Hour must be 0–24 or empty');return n}

// ------------------------------------------------------------------ quests
export const OBJECTIVE_TYPES={
 talk:{label:'Talk to an NPC',fields:['target']},
 kill:{label:'Defeat enemies',fields:['target']},
 collect:{label:'Collect and hand in items',fields:['target']},
 have:{label:'Carry an item',fields:['target']},
 bank:{label:'Deposit in the bank',fields:['target']},
 equip:{label:'Equip something',fields:['target','item']},
 xp:{label:'Gain skill XP',fields:['skill']},
 event:{label:'Game event',fields:['event','match','targets']},
 visit:{label:'Visit a place',fields:['x','z','radius','floor']},
};
export const QUEST_EVENTS=['interaction','death','woodcut','fishing','eat','player_death','player_respawn','door','skill_complete','gather_start'];
export const DIALOGUE_STAGES=['offer','progress','complete'];
// ctx: {npcs:Set, actors:Set, attackable:Set, items:Set (original item ids), keys:Set (other quests' keys)}
export function validateQuestDraft(d={},ctx={}){
 const e=[],has=(set,v)=>!set||set.has(v),n=v=>typeof v==='number'&&Number.isFinite(v);
 const name=String(d.name||'').trim(),desc=String(d.description||'').trim();
 if(name.length<2||name.length>80)e.push('Name must be 2–80 characters.');
 if(desc.length<1||desc.length>2000)e.push('Description must be 1–2000 characters.');
 if(!d.giver||!has(ctx.npcs,d.giver))e.push('Choose an existing NPC as quest giver.');
 if(d.key&&!/^[a-z0-9_-]{2,40}$/.test(d.key))e.push('Key: 2–40 lowercase letters, digits, - or _.');
 if(d.key&&ctx.keys?.has(d.key))e.push('Another quest already uses key '+d.key+'.');
 if(d.requires&&d.requires===d.key)e.push('A quest cannot require itself.');
 if(d.requires&&ctx.keys&&!ctx.keys.has(d.requires))e.push('Required quest key '+d.requires+' does not exist.');
 if(d.chain&&!/^[a-z0-9_-]{0,40}$/.test(d.chain))e.push('Chain: lowercase letters, digits, - or _.');
 if(d.questPoints!==undefined&&!(Number.isInteger(d.questPoints)&&d.questPoints>=0&&d.questPoints<=50))e.push('Quest points must be 0–50.');
 if(d.icon&&d.icon!=='coins'&&!has(ctx.items,d.icon))e.push('Quest icon must be coins or an item.');
 const objectives=Array.isArray(d.objectives)?d.objectives:[];
 if(objectives.length<1||objectives.length>12)e.push('Add 1–12 objectives.');
 objectives.forEach((o,i)=>{const at='Objective '+(i+1)+': ';
  if(!OBJECTIVE_TYPES[o.type]){e.push(at+'unknown type.');return}
  if(!Number.isInteger(o.amount)||o.amount<1||o.amount>(o.type==='xp'?13034431:100000))e.push(at+'amount out of range.');
  if(String(o.label||'').length>200)e.push(at+'label is limited to 200 characters.');
  if(['collect','have'].includes(o.type)&&!has(ctx.items,o.target))e.push(at+'choose an original item.');
  if(o.type==='bank'&&o.target!=='*'&&!has(ctx.items,o.target))e.push(at+'bank target must be * or an item.');
  if(o.type==='talk'&&!has(ctx.npcs,o.target))e.push(at+'choose an NPC.');
  if(o.type==='kill'){const list=Array.isArray(o.targets)?o.targets:[o.target];if(!list.length||list.some(t=>!has(ctx.actors,t)))e.push(at+'choose an enemy.')}
  if(o.type==='event'&&!QUEST_EVENTS.includes(o.event))e.push(at+'choose an event.');
  if(o.type==='xp'&&!SKILLS.includes(o.skill))e.push(at+'choose a skill.');
  if(o.type==='equip'&&!/^[A-Za-z0-9_]{1,40}$/.test(o.target||''))e.push(at+'choose an equipment slot.');
  if(o.type==='visit'&&(!n(o.x)||!n(o.z)||Math.abs(o.x)>4500||Math.abs(o.z)>4500||(o.radius!==undefined&&!(o.radius>=.5&&o.radius<=50))))e.push(at+'visit needs x, z and a 0.5–50 m radius.');
 });
 const collects=objectives.filter(o=>o.type==='collect').map(o=>o.target);if(new Set(collects).size!==collects.length)e.push('Combine duplicate item objectives.');
 if(d.gold!==undefined&&!(n(d.gold)&&d.gold>=0&&d.gold<=1e6))e.push('Gold reward must be 0–1,000,000.');
 for(const k of ['items','startItems']){const list=Object.entries(d[k]||{});if(list.length>8)e.push(k+': up to eight items.');for(const [id,q] of list)if(!has(ctx.items,id)||!(Number.isInteger(q)&&q>=1&&q<=1000))e.push(k+': invalid '+id+'.')}
 for(const [s,q] of Object.entries(d.xp||{}))if(!SKILLS.includes(s)||!(n(q)&&q>=1&&q<=1e6))e.push('XP reward '+s+' must be 1–1,000,000.');
 for(const stage of DIALOGUE_STAGES){const lines=d.dialogue?.[stage]||[];if(lines.length>20)e.push(stage+' dialogue: up to 20 lines.');lines.forEach(l=>{if(!['npc','player'].includes(l.who)||!String(l.text||'').trim()||String(l.text).length>400)e.push(stage+' dialogue lines need a speaker and 1–400 characters.')})}
 return [...new Set(e)];
}
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
export function objectiveText(o,names={}){
 const nm=id=>names[id]||id;
 if(o.label)return o.label;
 switch(o.type){
  case 'talk':return 'Talk to '+nm(o.target);
  case 'kill':return 'Defeat '+o.amount+' × '+(Array.isArray(o.targets)?o.targets.map(nm).join(' / '):nm(o.target));
  case 'collect':return 'Bring '+o.amount+' × '+nm(o.target);
  case 'have':return 'Carry '+o.amount+' × '+nm(o.target);
  case 'bank':return 'Bank '+(o.target==='*'?plural(o.amount,'item'):o.amount+' × '+nm(o.target));
  case 'equip':return 'Equip '+(o.item?nm(o.item):'something')+' in the '+o.target+' slot';
  case 'xp':return 'Gain '+o.amount+' '+skillLabel(o.skill||'')+' XP';
  case 'event':return 'Event "'+o.event+'" × '+o.amount;
  case 'visit':return 'Visit '+o.x+', '+o.z+(o.radius?' (within '+o.radius+' m)':'');
  default:return o.type;
 }
}
export function questPreview(d={},names={}){
 const lines=[d.name||'Untitled quest','Giver: '+(names[d.giver]||d.giver||'—')+(d.requires?' · requires '+d.requires:'')+(d.chain?' · chain '+d.chain+' #'+(d.order??0):''),'',d.description||''];
 for(const stage of DIALOGUE_STAGES){const list=d.dialogue?.[stage]||[];if(list.length){lines.push('',stage[0].toUpperCase()+stage.slice(1)+':');for(const l of list)lines.push('  '+(l.who==='player'?'You':names[d.giver]||'NPC')+': '+l.text)}}
 lines.push('','Objectives:',...(d.objectives||[]).map((o,i)=>' '+(i+1)+'. '+objectiveText(o,names)));
 const rewards=[(d.questPoints??1)+' quest point'+((d.questPoints??1)===1?'':'s'),...Object.entries(d.xp||{}).map(([s,q])=>q+' '+skillLabel(s)+' XP'),...Object.entries(d.items||{}).map(([id,q])=>q+' × '+(names[id]||id)),...(d.gold?[d.gold+' coins']:[])];
 lines.push('','Rewards: '+rewards.join(', '));
 if(Object.keys(d.startItems||{}).length)lines.push('Start items: '+Object.entries(d.startItems).map(([id,q])=>q+' × '+(names[id]||id)).join(', '));
 return lines.join('\n');
}

// ------------------------------------------------------------------ spawning & loot
// Uniform scatter inside a disc (sqrt keeps density even); rounded to 0.1 m like other placements.
export function scatterPositions(count,x,z,radius,rand=Math.random){
 const n=Math.max(1,Math.min(80,Math.floor(count)||1)),r=Math.max(0,Math.min(60,Number(radius)||0)),out=[];
 for(let i=0;i<n;i++){const a=rand()*Math.PI*2,d=r*Math.sqrt(rand());out.push({x:Math.round((x+Math.cos(a)*d)*10)/10,z:Math.round((z+Math.sin(a)*d)*10)/10})}
 return out;
}
// Spawn-time stat overrides: blank keeps the template value.
export function applyOverrides(entity,o={}){
 const e={...entity};
 for(const [k,lo,hi] of [['hp',1,100000],['damage',0,10000],['respawn',0,86400],['xpReward',0,100000],['goldReward',0,1000000],['attackSpeed',1.3,30],['roam',0,50]]){
  if(o[k]===''||o[k]===undefined||o[k]===null)continue;const v=Number(o[k]);if(!Number.isFinite(v)||v<lo||v>hi)throw Error(k+' must be '+lo+'–'+hi);e[k]=['attackSpeed'].includes(k)?v:Math.round(v)}
 if(o.hostile==='yes')e.hostile=true;else if(o.hostile==='no')e.hostile=false;
 if(Array.isArray(o.loot))e.loot=o.loot;
 return e;
}
// Text loot editor for base actors: "itemId,min,max,chance%[,always|rare]" per line.
export function parseLootLines(text,known=()=>true){
 const rows=String(text||'').split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{const [item,min,max,chance,flag]=line.split(',').map(s=>s.trim());
  if(!known(item))throw Error('Unknown loot item: '+item);const lo=Math.floor(Number(min)),hi=Math.floor(Number(max??min)),c=Number(chance)/100;
  if(!(lo>=1&&hi>=lo&&hi<=1000))throw Error('Loot quantities must be 1–1000 ('+item+')');if(!(c>0&&c<=1))throw Error('Chance must be above 0% and at most 100% ('+item+')');
  return {item,min:lo,max:hi,chance:Math.round(c*1000)/1000,...(flag==='always'?{always:true}:flag==='rare'?{rare:true}:{})}});
 if(rows.length>8)throw Error('Up to eight loot rows');return rows;
}
export const formatLootLines=(rows=[])=>rows.map(r=>[r.item,r.min,r.max,Math.round(r.chance*1000)/10,...(r.always?['always']:r.rare?['rare']:[])].join(',')).join('\n');

// ------------------------------------------------------------------ audit & backups
export function auditLine(r){return r.action+' · '+(r.target||'world')+' · '+new Date(r.created_at).toLocaleString()}
export function backupStats(doc){
 if(!doc||doc.format!=='eldervale-backup-v1'||!Array.isArray(doc.entities))throw Error('Not an eldervale-backup-v1 file');
 return {entities:doc.entities.length,deleted:doc.entities.filter(e=>e.deleted).length,actors:(doc.actors||[]).length,catalog:(doc.catalog||[]).length,quests:(doc.quests||[]).length};
}
export const MODERATION_PRESETS=[[10,'10 minutes'],[60,'1 hour'],[1440,'1 day'],[10080,'1 week'],[43200,'30 days'],[525600,'1 year']];

// OSRS experience table (level 1–99) for the player inspector.
export const XP_TABLE=(()=>{const t=[0];let points=0;for(let l=1;l<99;l++){points+=Math.floor(l+300*2**(l/7));t.push(Math.floor(points/4))}return t})();
export const levelForXp=xp=>{let l=1;for(let i=1;i<XP_TABLE.length;i++)if((Number(xp)||0)>=XP_TABLE[i])l=i+1;return l};
