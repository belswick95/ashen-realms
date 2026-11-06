import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SIGN_ICONS,SIGN_PAINTS,signIconFor,defaultBuildingSign,cleanSign,applySignOverride,defaultSignposts,customPosts,signTier,wrapSignText,SIGN_TEXT_DISTANCE,SIGN_ICON_DISTANCE} from '../building-signs.js';
import {capital,capitalBlueprint,inwardNormal,insideWalls} from '../capital-layout.js';
import {castleBlueprint} from '../castle-layout.js';
import {signFormData} from '../admin-signs.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const typeOf=d=>d.template==='cottage'?(d.room||'cottage'):d.template;

test('every Birchford trade building gets the right trade icon; homes get no sign',()=>{
 const expect={'Crumb & Crust Bakery':'loaf','Mortar & Mint Apothecary':'potion','Edgewright’s Blades':'sword','Hollin’s Plate & Mail':'shield','Fletch & Flight Archery':'bow','The Gilded Rune':'staff','Birchford West Bank':'coin','Birchford East Bank':'coin','The Gilded Antler':'mug','Threadneedle Tailors':'needle','Deepvein Tools & Ores':'pickaxe','Temple of the Morning Bell':'bell','Birchford Keep':'crown','Warriors’ Guild':'sword','Crafters’ Guild & Smithy':'hammer'};
 const buildings=capitalBlueprint().filter(d=>['cottage','bank','inn','forge'].includes(d.template));
 for(const d of buildings){const sign=defaultBuildingSign({type:typeOf(d),name:d.name});
  if(d.room==='home'){assert.equal(sign.enabled,false,d.name+' is a home');continue}
  assert.equal(sign.enabled,true,d.name);assert.equal(sign.icon,expect[d.name],d.name);assert.ok(SIGN_ICONS.includes(sign.icon));assert.ok(sign.text.length<=40)}
 for(const n of Object.keys(expect))assert.ok(buildings.some(d=>d.name===n),n+' still exists in the capital layout');
});

test('civic buildings carry wall plaques, shops and inns hang boards; castle buildings are covered too',()=>{
 for(const [name,type]of [['Birchford Keep','hall'],['Warriors’ Guild','hall'],['Temple of the Morning Bell','chapel'],['Birchford West Bank','bank']])assert.equal(defaultBuildingSign({type,name}).style,'plaque',name);
 for(const [name,type]of [['Crumb & Crust Bakery','shop'],['The Gilded Antler','inn']])assert.equal(defaultBuildingSign({type,name}).style,'hanging',name);
 const castle=castleBlueprint().filter(d=>['cottage','bank','inn','forge'].includes(d.template)).map(d=>[d.name,defaultBuildingSign({type:typeOf(d),name:d.name})]);
 const icons=Object.fromEntries(castle.map(([n,s])=>[n,s.icon]));
 assert.equal(icons['Royal Smithy'],'anvil');assert.equal(icons['Castle Kitchen & Refectory'],'loaf');assert.equal(icons['Royal Treasury & Bank'],'coin');assert.equal(icons['Chapel of the Dawn'],'bell');assert.equal(icons['Eldervale Great Hall'],'crown');
 assert.equal(defaultBuildingSign({type:'armory',name:'Armory'}).enabled,false);
 assert.equal(signIconFor({type:'forge',name:'Winterwatch Workshop'}),'anvil');
 assert.equal(signIconFor({type:'inn',name:'Emberspire Lodge'}),'mug');
});

test('owner overrides are cleaned; an emptied override falls back to the default',()=>{
 const base=defaultBuildingSign({type:'shop',name:'Crumb & Crust Bakery'});
 const s=cleanSign({text:'  Crumb   & Crust  ',icon:'fish',style:'plaque',paint:'red',enabled:false,evil:'<script>'},base);
 assert.deepEqual([s.text,s.icon,s.style,s.paint,s.enabled],['Crumb & Crust','fish','plaque','red',false]);assert.equal(s.evil,undefined);
 const bad=cleanSign({icon:'skull',style:'floating',paint:'neon',enabled:'yes',text:'x'.repeat(90)},base);
 assert.equal(bad.icon,base.icon);assert.equal(bad.style,base.style);assert.equal(bad.paint,base.paint);assert.equal(bad.enabled,true);assert.equal(bad.text.length,40);
 assert.equal(applySignOverride(base,{}),base);assert.equal(applySignOverride(base,null),base);
 assert.equal(applySignOverride(base,{enabled:false}).enabled,false);
 for(const p of Object.keys(SIGN_PAINTS))assert.match(SIGN_PAINTS[p][0],/^#[0-9a-f]{6}$/);
});

test('signposts stand just outside every Birchford gate and at Winterwatch, Emberspire and the castle',()=>{
 const posts=defaultSignposts(capital.gates,{inward:inwardNormal});
 assert.equal(posts.length,capital.gates.length+3);
 for(const p of posts){assert.equal(p.style,'post');assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(p.arms.length>=1&&p.arms.length<=3,p.id);assert.match(p.id,/^post:[a-z-]+$/)}
 for(const g of capital.gates){const p=posts.find(x=>x.id==='post:birchford-'+g.key);assert.ok(p,g.key);assert.equal(insideWalls(p.x,p.z),false,g.key+' post stands outside the wall');
  assert.ok(Math.hypot(p.x-g.x,p.z-g.z)<9,'next to its gate');assert.equal(p.arms[0].text,'Birchford')}
 assert.ok(posts.find(p=>p.id==='post:castle').arms.some(a=>a.text==='Birchford'));
 const custom=customPosts(posts,{'post:custom-1':{x:5,z:6,text:'Old Mill',arms:[{text:'Old Mill',icon:'loaf',toX:9,toZ:6}]},'post:castle':{text:'Castle'},'capital:x':{x:1,z:1}});
 assert.equal(custom.length,posts.length+1);assert.equal(custom.at(-1).arms[0].text,'Old Mill');
 assert.equal(customPosts(posts,{'post:custom-2':{text:'no position'}}).length,posts.length,'a custom post needs a position');
});

test('lettering near, icon only further out, hidden past the view range (scaled by the LOD preset)',()=>{
 assert.equal(signTier(5),'text');assert.equal(signTier(SIGN_TEXT_DISTANCE+1),'icon');assert.equal(signTier(SIGN_ICON_DISTANCE+1),'hidden');
 assert.equal(signTier(SIGN_ICON_DISTANCE*.6,.55),'hidden','low preset culls sooner');assert.equal(signTier(SIGN_ICON_DISTANCE*1.1,1.25),'icon','ultra keeps them longer');
 assert.deepEqual(wrapSignText('The Gilded Antler',16),['The Gilded','Antler']);assert.deepEqual(wrapSignText('Bakery',16),['Bakery']);assert.deepEqual(wrapSignText('',16),[]);
});

test('signs replace the floating green name labels and stay cheap: instanced, one atlas, LOD culled',()=>{
 const game=read('game.js'),signs=read('building-signs.js');
 assert.doesNotMatch(game,/function buildingLabel\(|#28372e/,'old green label plates are gone');
 assert.match(game,/signsSystem\(\)\.addBuilding\(houseRecord\)/);assert.match(game,/signsSystem\(\)\.frame\(camera\)/);
 assert.match(signs,/new T\.InstancedMesh/);assert.equal((signs.match(/atlas=createSignAtlas\(T\)/g)||[]).length,1,'one shared atlas');
 assert.match(signs,/ATLAS_W=2048,ATLAS_H=1024/,'one 2048x1024 atlas');assert.match(signs,/signTier\(d,k\)/);
 assert.match(signs,/castShadow=false/,'signs never add shadow casters');
 assert.match(read('world-client.js'),/db\.rpc\('building_signs'\)/,'owner overrides are loaded with the world');
});

test('owner console: Signs tab under Build, writes through world_admin commands',()=>{
 const panel=read('admin-panel.js'),tab=read('admin-signs.js');
 assert.match(panel,/\['Build',\['Spawn','Placed','Editor','Signs'\]\]/);assert.match(panel,/createSignTabs\(ctx\)/);assert.match(read('admin-console.js'),/Signs:svg\(/);
 for(const c of ['sign_list','sign_save','sign_reset'])assert.match(tab,new RegExp("'"+c+"'"));
 assert.deepEqual(signFormData({text:' Bakery ',icon:'loaf',style:'hanging',paint:'green',enabled:true}),{text:'Bakery',icon:'loaf',style:'hanging',paint:'green',enabled:true});
 const post=signFormData({text:'Mill',icon:'none',style:'post',paint:'oak',enabled:true,x:'12.345',z:'-4',name:'Mill post',arms:[{text:'Mill',icon:'loaf',toX:'20',toZ:'1'},{text:'  ',icon:'none',toX:'',toZ:''}]});
 assert.deepEqual(post,{text:'Mill',icon:'none',style:'post',paint:'oak',enabled:true,x:12.35,z:-4,arms:[{text:'Mill',icon:'loaf',toX:20,toZ:1}],name:'Mill post'});
});

test('building-signs.sql: idempotent, non-destructive, owner-checked, audited, validated',()=>{
 const sql=read('db/building-signs.sql');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i,'no destructive keywords anywhere');
 assert.doesNotMatch(sql,/^\s*create\s+(function|table|trigger)\b(?!.*if not exists)/im,'creates are create or replace / if not exists');
 assert.match(sql,/create table if not exists eldervale_private\.building_signs/);
 assert.match(sql,/admin_building_signs[\s\S]*is_owner\(\)/);assert.match(sql,/insert into eldervale_private\.audit/);
 assert.match(sql,/grant execute on function public\.building_signs\(\) to authenticated/);
 assert.match(sql,/soft_patch\('eldervale_private\.admin_action\(text,jsonb\)','admin_building_signs'/);
 for(const m of sql.matchAll(/\b(?:if|elsif)\b([^;]*?)\bthen\b/gi))if(/\bcase\b/i.test(m[1]))assert.match(m[1],/\(\s*case\b/i);
 // Server and client agree on the icon list and paints.
 const icons=sql.match(/icons constant text\[\]:=array\[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map(s=>s.slice(1,-1));
 assert.deepEqual(icons.filter(i=>i!=='none').sort(),[...SIGN_ICONS].sort());
 for(const p of Object.keys(SIGN_PAINTS))assert.match(sql,new RegExp("'"+p+"'"));
});
