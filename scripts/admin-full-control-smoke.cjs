// Offline smoke of the owner console's full-control tabs with mocked RPCs (no game boot, no
// production data). Renders every console tab on desktop, iPad and phone, checks the fc_* commands
// the editors send, and writes screenshots.
// Usage: node scripts/admin-full-control-smoke.cjs [screenshotDir]
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=process.argv[2]||path.join(root,'test-results','admin-full-control');fs.mkdirSync(out,{recursive:true});
const three=path.join(root,'node_modules/three').replace(/\/$/,'');const threeDir=fs.existsSync(three)?three:path.resolve(root,'../../../node_modules/three');
const harness=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<style>body{margin:0;background:#22312b;font-family:Georgia,serif;min-height:100vh}</style></head><body>
<script type="module">
const OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d',P='22222222-2222-4222-8222-222222222222';
const commands=[];window.fcCommands=commands;
const catalog=[{id:'item:wood',data:{name:'Logs',buy:6,sell:3}},{id:'item:bread',data:{name:'Bread',buy:12,sell:4,heal:12,ownerEdited:true}},{id:'item:weapon:bronzeSword',data:{key:'bronzeSword',name:'Bronze sword',buy:35,sell:10,field:'weaponsOwned'}},
 {id:'weapon:runeScimitar',data:{name:'Rune scimitar',kind:'weapon',desc:'A vicious, curved sword.',tier:'rune',color:'#4fb6c9',attackSpeed:4,requirements:{attack:40},bonuses:{attack:{stab:7,slash:45,crush:-2,ranged:0,magic:0},defence:{stab:0,slash:1,crush:0,ranged:0,magic:0},strength:44,rangedStrength:0,prayer:0},attack:30,damage:22,speed:2.4,reach:2.4,ownerEdited:true,futureFlag:'kept'}},
 {id:'armor:helm',data:{name:'Iron armet helm',slot:'Head',defence:4,reduction:1,desc:'Knight outfit · iron armet helm.'}},{id:'item:custom_royal_bread',data:{name:'Royal bread',buy:12,sell:4,heal:10,icon:'bread',custom:true,tradeable:false,ownerEdited:true}},{id:'item:note:wood',data:{name:'Logs (noted)',noteOf:'wood'}}];
const actors=[{id:'base:bob',data:{kind:'npc',name:'Steward Harlan',hp:20,level:3},x:0,z:0,hp:20},{id:'base:rat',data:{kind:'monster',name:'Cellar rat',hp:10,level:2,attackable:true,xpReward:8,goldReward:2,loot:[{item:'bread',min:1,max:1,chance:0.25,rare:true}]},x:4,z:5,hp:10}];
const quest={id:'c7a5e000-0000-4000-8000-000000000101',version:3,data:{name:'Rats in the cellar',description:'Harlan needs the cellar cleared before the feast.',giver:'base:bob',key:'cellar-rats',chain:'castle',order:2,questPoints:1,published:true,icon:'bread',objectives:[{type:'kill',target:'base:rat',amount:3,label:'Defeat 3 cellar rats'},{type:'visit',x:-322,z:-301,radius:3,amount:1},{type:'xp',skill:'cooking',amount:25}],gold:50,items:{bread:2},xp:{attack:200,cooking:62.5},dialogue:{offer:[{who:'npc',text:'Rats! Everywhere!'}],progress:[],complete:[{who:'player',text:'The cellar is clear.'}]}}};
const save={user_id:P,character_name:'Wren',level:24,gold:1520,skills:{attackXP:7842,strengthXP:5018,defenceXP:3115,hitpointsXP:9730.5,cookingXP:1358,fishingXP:801},stats:{woodXP:2746.25,miningXP:512,wood:7,bread:3,kills:40},inventory:{bank:{wood:120,bread:9},weaponsOwned:['bronzeSword','bronzeSword']},equipment:{weapon:'bronzeSword',helm:true}};
const rpc=async(name,args={})=>{if(name==='world_admin_overview')return {players:[{user_id:P,character_name:'Wren',level:24,staff_role:'player'},{user_id:OWNER,character_name:'Owner',level:126,staff_role:'player'}],actors,reports:[],chat:[],audit:[]};
 if(name!=='world_admin')throw Error('unexpected '+name);const {command,payload}=args;
 switch(command){
  case 'console_live':return {players:[{userId:P,name:'Wren',level:24,health:18,maxHealth:24,x:12,z:-4,gold:1520}],actors:actors.map(a=>({id:a.id,name:a.data.name,kind:a.data.kind,level:a.data.level,x:a.x,z:a.z,hp:a.hp,maxHp:a.data.hp})),drops:3};
  case 'fc_catalog_list':return catalog;
  case 'fc_settings_get':return {multipliers:{xp:2,skills:{cooking:1.5},dropRate:1,respawn:.5,shopPrice:1},world:{timeOverride:19},skills:[]};
  case 'quest_list':return [quest];
  case 'fc_backup_list':return [{name:'Before castle rebuild',createdAt:'2026-11-05T19:12:00Z',entities:1402,actors:79,catalog:12,quests:9}];
  case 'fc_audit':return {rows:[{id:9,action:'fc_catalog_save',target:'weapon:runeScimitar',actor:OWNER,created_at:'2026-11-06T10:00:00Z',before_data:{name:'Rune scimitar'},after_data:{name:'Rune scimitar',tier:'rune'}},{id:8,action:'fc_moderate',target:P,actor:OWNER,created_at:'2026-11-06T09:00:00Z',before_data:null,after_data:{op:'mute',reason:'spam'}}],actions:['fc_catalog_save','fc_moderate','give']};
  case 'fc_player_get':return {save,position:{x:12,z:-4,floor:0,online:true},moderation:null,role:'player',username:'wren',combatLevel:24,audit:[{id:8,action:'fc_moderate',created_at:'2026-11-06T09:00:00Z',before_data:null,after_data:{op:'mute'}}]};
  case 'tutorial_status':return {tutorial:{done:true},locked:false};
 }
 return action(command,payload)};
const action=async(command,payload={})=>{commands.push({command,payload});
 if(command==='fc_catalog_save')return {id:payload.id,data:{...payload.data,ownerEdited:true},created:!!payload.create};
 if(command==='fc_quest_save')return {id:payload.id||'new-quest',version:4,data:payload.data};
 return {ok:true,count:1}};
const bridge={position:()=>({x:12.3,z:-4.1,yaw:0,floor:0}),highlight(){},notice(){},preview(){}};
const rows=[{id:'e1',deleted:false,data:{kind:'monster',template:'wolf',name:'Grey wolf',x:20,z:4,level:8,hp:40,damage:4,hostile:true,respawn:30,loot:[{item:'bread',min:1,max:1,chance:.5,always:true}]}},{id:'e2',deleted:false,data:{kind:'npc',template:'villager',name:'Mira',x:2,z:3,role:'merchant',level:1,hp:20}}];
const {createAdminPanel}=await import('/admin-panel.js');
window.panel=createAdminPanel({userId:OWNER,rpc,action,refresh:async()=>{},snapshot:{owner:true,settings:{revision:1,welcome:'Welcome',maintenance:false,spawn_x:0,spawn_z:5},entities:rows},bridge,storage:null,auth:{resetPasswordForEmail:async()=>({error:null})}});
document.querySelector('#owner-studio-toggle').click();window.harnessReady=true;
</script></body></html>`;
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;if(p==='/harness.html'){res.setHeader('content-type','text/html');return res.end(harness)}
 const file=p.startsWith('/three/')?path.join(threeDir,p.slice(7)):path.join(root,p);try{res.setHeader('content-type',/\.js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':/\.svg$/.test(file)?'image/svg+xml':/\.png$/.test(file)?'image/png':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
 const errors=[];
 try{
  for(const [device,viewport,tabs] of [['desktop',{width:1440,height:900},null],['ipad',{width:1024,height:1366},['Catalog','Quests','Players','Economy']],['phone',{width:390,height:844},['Catalog','Players','Spawn']]]){
   const page=await (await browser.newContext({viewport,userAgent:device==='desktop'?UA:undefined,isMobile:device!=='desktop',hasTouch:device!=='desktop'})).newPage();
   page.on('pageerror',e=>{errors.push(device+': '+e.message);console.error(device,e.message)});
   await page.goto(base+'/harness.html');await page.waitForFunction(()=>window.harnessReady,null,{timeout:60000});
   const names=tabs||await page.$$eval('#owner-studio nav button',b=>b.map(x=>x.textContent.trim()));
   for(const name of names){
    await page.evaluate(n=>[...document.querySelectorAll('#owner-studio nav button')].find(b=>b.textContent.trim()===n).click(),name);
    await page.waitForTimeout(250);
    // Open a detail on list/detail tabs so the editors are visible in the screenshot.
    const pick={Catalog:'Rune scimitar',Quests:'Rats in the cellar',Players:'Wren',Monsters:'Grey wolf',NPCs:'Mira',Spawn:null}[name];
    if(pick)await page.evaluate(t=>{const b=[...document.querySelectorAll('#owner-studio .console-row')].find(r=>r.textContent.includes(t));b?.click()},pick);
    if(name==='Spawn'){await page.evaluate(()=>{[...document.querySelectorAll('#owner-studio .console-chip')].find(c=>c.textContent.trim()==='All')?.click()});await page.waitForTimeout(150);await page.evaluate(()=>{const s=document.querySelector('#owner-studio .console-search');s.value='wolf';s.dispatchEvent(new Event('input'))});await page.waitForTimeout(150);await page.evaluate(()=>[...document.querySelectorAll('#owner-studio .console-tile-card')].find(c=>/wolf/i.test(c.textContent))?.click());await page.waitForTimeout(200);await page.evaluate(()=>{for(const d of document.querySelectorAll('#owner-studio .console-detail details'))d.open=true})}
    await page.waitForTimeout(400);
    const overflow=await page.evaluate(()=>document.querySelector('#owner-studio .studio-workspace').scrollWidth-document.querySelector('#owner-studio .studio-workspace').clientWidth);
    assert.ok(overflow<=2,device+' '+name+' has no horizontal scroll ('+overflow+')');
    await page.screenshot({path:path.join(out,device+'-'+name.toLowerCase()+'.png')});
   }
   if(device==='desktop'){
    // Catalog edit sends generic data and keeps unknown keys.
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio nav button')].find(b=>b.textContent.trim()==='Catalog').click());await page.waitForTimeout(200);
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio .console-row')].find(r=>r.textContent.includes('Rune scimitar')).click());await page.waitForTimeout(200);
    await page.fill('[name="cf_bonuses.attack.slash"]','47');await page.evaluate(()=>[...document.querySelectorAll('#owner-studio .console-detail button')].find(b=>b.textContent==='Save item').click());await page.waitForTimeout(300);
    let cmd=await page.evaluate(()=>window.fcCommands.at(-1));assert.equal(cmd.command,'fc_catalog_save');assert.equal(cmd.payload.data.bonuses.attack.slash,47);assert.equal(cmd.payload.data.futureFlag,'kept');assert.equal(cmd.payload.data.requirements.attack,40);
    // Economy saves multipliers.
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio nav button')].find(b=>b.textContent.trim()==='Economy').click());await page.waitForTimeout(300);
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio button')].find(b=>b.textContent==='Save multipliers').click());await page.waitForTimeout(200);
    cmd=await page.evaluate(()=>window.fcCommands.at(-1));assert.equal(cmd.command,'fc_settings_save');assert.equal(cmd.payload.value.xp,2);assert.equal(cmd.payload.value.skills.cooking,1.5);
    // Quest save sends the extended objectives.
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio nav button')].find(b=>b.textContent.trim()==='Quests').click());await page.waitForTimeout(300);
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio .console-row')].find(r=>r.textContent.includes('Rats')).click());await page.waitForTimeout(200);
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio button')].find(b=>b.textContent==='Validate & preview').click());await page.waitForTimeout(200);
    await page.screenshot({path:path.join(out,'desktop-quests-preview.png')});
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio button')].find(b=>b.textContent==='Save quest').click());await page.waitForTimeout(300);
    cmd=await page.evaluate(()=>window.fcCommands.at(-1));assert.equal(cmd.command,'fc_quest_save');assert.deepEqual(cmd.payload.data.objectives.map(o=>o.type),['kill','visit','xp']);assert.equal(cmd.payload.data.xp.cooking,62.5);
    // Player inspector sets XP with decimals.
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio nav button')].find(b=>b.textContent.trim()==='Players').click());await page.waitForTimeout(300);
    await page.evaluate(()=>[...document.querySelectorAll('#owner-studio .console-row')].find(r=>r.textContent.includes('Wren')).click());await page.waitForTimeout(400);
    await page.evaluate(()=>{for(const d of document.querySelectorAll('.console-inspector details'))d.open=true});await page.waitForTimeout(100);
    await page.screenshot({path:path.join(out,'desktop-players-inspector.png'),fullPage:false});
    await page.evaluate(()=>{document.querySelector('.console-inspector').scrollIntoView()});await page.screenshot({path:path.join(out,'desktop-players-inspector-2.png')});
    await page.fill('[aria-label="Woodcutting XP"]','2800.5');await page.evaluate(()=>document.querySelector('[aria-label="Woodcutting XP"]').parentElement.querySelector('button').click());await page.waitForTimeout(300);
    cmd=await page.evaluate(()=>window.fcCommands.find(c=>c.command==='fc_player_set_xp'));assert.deepEqual(cmd.payload,{userId:'22222222-2222-4222-8222-222222222222',skill:'woodXP',xp:2800.5});
    // Tab finder.
    await page.fill('.console-nav-search','back');const visible=await page.$$eval('#owner-studio nav button:not([hidden])',b=>b.map(x=>x.textContent.trim()));assert.deepEqual(visible,['Backup']);
    console.log('ok desktop editors send fc_* commands:',[...new Set((await page.evaluate(()=>window.fcCommands)).map(c=>c.command))].join(', '));
   }
   console.log('ok',device,names.length,'tabs');
  }
  assert.deepEqual(errors,[]);console.log('screenshots in',out);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
