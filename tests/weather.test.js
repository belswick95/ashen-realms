import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {weatherHash,weatherSettings,slotWeather,publicWeather,regionWeather,weatherRegionWeights,weatherRegionAt,weatherLook,weatherAt,blendLooks,lightningAt,thunderFor,weatherLabel,weatherForecast,
 WEATHER_KINDS,REGION_IDS,DEFAULT_WEIGHTS,LOOK_FIELDS} from '../weather.js';
import {weatherFog,soak,flashLevel,weatherTier} from '../weather-effects.js';
import {ambienceMix,ambienceFilters,ambienceRates} from '../ambience.js';
import {weightShares,readWeights,scheduleForm,forceForm,regionNow} from '../admin-weather.js';
import {makeWorldPlan} from '../procedural-world.js';

const T0=Date.UTC(2026,10,6,12,0,0);
const seedOf=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url))).config.seed;

test('weather hash is a fixed 32-bit integer function (vectors checked against Postgres in scripts/weather-db)',()=>{
 assert.deepEqual([[7331,1,1500000,0],[0,5,0,1],[2147483647,3,99999999,12],[42,2,1,11]].map(a=>weatherHash(...a)),[625915496,2874220851,3049643718,1474738870]);
 for(let i=0;i<200;i++){const h=weatherHash(i*7919,i%5+1,i*104729,i%13);assert.ok(Number.isInteger(h)&&h>=0&&h<2**32)}
});

test('the schedule is deterministic: same seed and time give the same weather everywhere',()=>{
 const a=publicWeather({},T0),b=publicWeather({},T0+5000);assert.deepEqual(a,b,'same slot, same summary');
 assert.equal(a.on,true);assert.equal(a.slot,1200);assert.equal(a.fade,120);assert.equal(a.start%1200000,0);assert.ok(a.start<=T0&&T0<a.start+1200000);
 assert.deepEqual(Object.keys(a.regions),REGION_IDS);
 for(const r of REGION_IDS){const x=a.regions[r];assert.ok(WEATHER_KINDS.includes(x.k)&&WEATHER_KINDS.includes(x.pk)&&WEATHER_KINDS.includes(x.nk));assert.ok(x.i>=.45&&x.i<=1)}
 const next=publicWeather({},T0+1200000);for(const r of REGION_IDS){assert.equal(next.regions[r].pk,a.regions[r].k,'previous of the next slot is this slot');assert.equal(next.regions[r].k,a.regions[r].nk)}
 assert.notDeepEqual(publicWeather({seed:1},T0).regions,publicWeather({seed:2},T0).regions,'the seed reshuffles');
 assert.ok(JSON.stringify(a).length<700,'small payload');
});

test('slot changes fade smoothly from the previous weather, and a stale summary carries on',()=>{
 const pub=publicWeather({},T0),r='fens',x=pub.regions[r];
 const start=regionWeather(pub,r,pub.start),mid=regionWeather(pub,r,pub.start+60000),done=regionWeather(pub,r,pub.start+200000);
 assert.equal(start.mix,0);assert.equal(start.from.kind,x.pk);assert.equal(start.kind,x.k);assert.ok(Math.abs(mid.mix-.5)<1e-9);assert.equal(done.mix,1);
 const stale=regionWeather(pub,r,pub.start+1200000+30000);assert.equal(stale.kind,x.nk);assert.equal(stale.from.kind,x.k);assert.equal(stale.mix,.25);
 // The look itself never jumps across the fade.
 const pub2={...pub,regions:{...pub.regions,fens:{...x,pk:'clear',pi:.5,k:'storm',i:1}}};let prev=null;
 for(let t=0;t<=130;t+=1){const s=regionWeather(pub2,'fens',pub.start+t*1000),look=blendLooks([[1,weatherLook(s.from.kind,s.from.intensity)]]),cur=s.mix>=1?weatherLook(s.kind,s.intensity):null;const v=weatherAt(pub2,FEN.x,FEN.z,pub.start+t*1000,{seed:seedOf}).look.rain;if(prev!==null)assert.ok(Math.abs(v-prev)<.05,'rain eases in at '+t+'s');prev=v;void look;void cur}
 assert.ok(prev>.9);
});
const FEN={x:-270,z:300};

test('region rules: snow in the north, ash and haze only near Emberspire, rain and fog most in the fens',()=>{
 const cfg=weatherSettings({}),count=r=>{const c=Object.fromEntries(WEATHER_KINDS.map(k=>[k,0]));for(let n=0;n<4000;n++)c[slotWeather(cfg,r,1460000+n).k]++;return c};
 const ww=count('winterwatch'),es=count('emberspire'),fens=count('fens'),bf=count('birchford'),hl=count('heartlands');
 assert.ok(ww.snow>4000*.28,'Winterwatch snows often: '+ww.snow);assert.equal(bf.snow+fens.snow+es.snow,0,'no snow in the south');assert.ok(hl.snow>0&&hl.snow<ww.snow/5);
 assert.ok(es.ash>300&&es.haze>300);assert.equal(es.fog+es.snow,0);for(const c of [ww,fens,bf,hl])assert.equal(c.ash+c.haze,0,'ash and haze only at Emberspire');
 assert.ok(fens.rain+fens.fog>(bf.rain+bf.fog)*1.4,'the fens are wetter');assert.ok(es.rain<4000*.03,'Emberspire is dry');
 // Custom weights: a region set to rain only always rains; all zero means clear.
 const c2=weatherSettings({weights:{fens:{clear:0,cloudy:0,rain:100,storm:0,fog:0}}});for(let n=0;n<50;n++)assert.equal(slotWeather(c2,'fens',n).k,'rain');
 const c3=weatherSettings({weights:{fens:Object.fromEntries(WEATHER_KINDS.map(k=>[k,0]))}});assert.equal(slotWeather(c3,'fens',5).k,'clear');
});

test('regions follow the biomes: Winterwatch, Emberspire, Birchford, the castle and the fens',()=>{
 const plan=makeWorldPlan(seedOf),town=n=>plan.towns.find(t=>t.name===n);
 assert.equal(weatherRegionAt(town('Winterwatch').x,town('Winterwatch').z,seedOf),'winterwatch');assert.equal(weatherRegionAt(town('Emberspire').x,town('Emberspire').z,seedOf),'emberspire');
 assert.equal(weatherRegionAt(town('Birchford').x,town('Birchford').z,seedOf),'birchford');assert.equal(weatherRegionAt(-340,-300,seedOf),'heartlands');assert.equal(weatherRegionAt(FEN.x,FEN.z,seedOf),'fens');
 for(let i=0;i<300;i++){const x=(i*37%800)-400,z=(i*91%800)-400,w=weatherRegionWeights(x,z,seedOf),sum=Object.values(w).reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<1e-9,'weights sum to 1 at '+x+','+z);for(const v of Object.values(w))assert.ok(v>=0)}
 // Region borders blend: walking 2 m never changes the look by much.
 const pub=publicWeather({},T0);let prev=null;for(let x=-400;x<=400;x+=2){const look=weatherAt(pub,x,-120,T0+600000,{seed:seedOf}).look;if(prev)for(const f of LOOK_FIELDS)assert.ok(Math.abs(look[f]-prev[f])<.35,f+' at x='+x);prev=look}
});

test('forced weather overrides the schedule until it expires; disabled weather is clear',()=>{
 const until=new Date(T0+600000).toISOString().replace(/\.\d+Z$/,'Z'),stored={force:{winterwatch:{kind:'storm',intensity:.9,until}}};
 const pub=publicWeather(stored,T0);assert.equal(pub.regions.winterwatch.fk,'storm');assert.equal(pub.regions.winterwatch.fu,T0+600000);assert.ok(!pub.regions.fens.fk);
 const s=regionWeather(pub,'winterwatch',T0+1000);assert.equal(s.kind,'storm');assert.equal(s.forced,true);assert.equal(s.mix,1);
 assert.equal(regionWeather(pub,'winterwatch',T0+600001).forced,false,'expires on the client too');
 assert.ok(!publicWeather(stored,T0+700000).regions.winterwatch.fk,'and on the server');
 assert.ok(!publicWeather({force:{fens:{kind:'rain',until:'tomorrow'}}},T0).regions.fens.fk,'damaged entries are ignored');
 assert.deepEqual(publicWeather({enabled:false},T0),{on:false});assert.equal(weatherAt({on:false},0,0,T0).look.rain,0);
 assert.equal(weatherAt(null,0,0,T0).look.cloud,0,'no server config: clear');
 const preview=weatherAt(pub,0,0,T0,{preview:{kind:'snow',intensity:1}});assert.equal(preview.kind,'snow');assert.equal(preview.look.snow,1);
});

test('settings are clamped and strictly typed like the server',()=>{
 const s=weatherSettings({seed:'12',slotMinutes:1,fadeSeconds:9999,enabled:'no',weights:{fens:{rain:250,fog:'7'}},force:[]});
 assert.equal(s.seed,7331);assert.equal(s.slotMinutes,5);assert.equal(s.fadeSeconds,600);assert.equal(s.enabled,true);assert.equal(s.weights.fens.rain,100);assert.equal(s.weights.fens.fog,DEFAULT_WEIGHTS.fens.fog);assert.deepEqual(s.force,{});
 assert.deepEqual(weatherForecast({},T0,4).fens.map(x=>x.start),[0,1,2,3].map(j=>publicWeather({},T0).start+j*1200000));
});

test('looks: storms are dark, windy and thunderous; snow covers; ash is warm grey',()=>{
 const storm=weatherLook('storm',1),rain=weatherLook('rain',.5),fog=weatherLook('fog',1),snow=weatherLook('snow',1),clear=weatherLook('clear',1);
 assert.ok(storm.dark>rain.dark&&storm.wind>rain.wind&&storm.thunder>3&&rain.thunder===0);assert.ok(fog.fog>.9&&fog.rain===0);assert.ok(snow.cover===1&&snow.snow===1&&snow.rain===0);
 assert.equal(clear.cloud+clear.rain+clear.fog+clear.thunder,0);assert.ok(weatherLook('ash',1).tint[0]>weatherLook('ash',1).tint[2]);
 const half=blendLooks([[1,clear],[1,storm]]);assert.ok(Math.abs(half.rain-storm.rain/2)<1e-9);
 assert.equal(weatherLabel('rain',.5),'Light rain');assert.equal(weatherLabel('rain',.95),'Heavy rain');assert.equal(weatherLabel('storm',.5),'Thunderstorm');assert.equal(weatherLabel('clear'),'');
});

test('lightning is deterministic per second and thunder follows the distance',()=>{
 let n=0;for(let s=0;s<6000;s++){const a=lightningAt(7,'fens',s,4),b=lightningAt(7,'fens',s,4);assert.deepEqual(a,b);if(a){n++;assert.ok(a.distance>=.4&&a.distance<6&&a.bearing>=0&&a.bearing<Math.PI*2)}}
 assert.ok(n>300&&n<500,'about 4 strikes a minute: '+n);assert.equal(lightningAt(7,'fens',5,0),null);
 const near=thunderFor(.5),far=thunderFor(5);assert.ok(near.delay<far.delay&&near.gain>far.gain&&near.cutoff>far.cutoff&&near.crack&&!far.crack);
 assert.ok(flashLevel(0,2)===1&&flashLevel(.05,1)<1&&flashLevel(2,2)===0&&flashLevel(.14,2)>.5);
});

test('effects: fog closes in, wetness soaks and dries slowly, tiers trade particles for speed',()=>{
 assert.deepEqual(weatherFog(150,330,0),{near:150,far:330});const thick=weatherFog(150,330,1);assert.ok(thick.far<=46&&thick.near<5);const light=weatherFog(150,330,.25);assert.ok(light.far<330&&light.far>200);
 let w=0;for(let i=0;i<10;i++)w=soak(w,1,1);assert.ok(Math.abs(w-10/30)<1e-9);for(let i=0;i<10;i++)w=soak(w,0,1);assert.ok(w>.27,'dries slower than it soaks');assert.equal(soak(.5,.5,1),.5);
 const low=weatherTier('low'),high=weatherTier('high'),classic=weatherTier('high',true);
 assert.ok(low.rain<high.rain/3&&!low.wetShading&&!low.ripples&&!low.materials&&high.wetShading&&high.ripples>0);assert.ok(classic.rain<high.rain&&!classic.materials);
});

test('weather sounds: rain beds crossfade light to heavy, muffle indoors and fall silent underground',()=>{
 const light=ambienceMix({day:1,weather:{rain:.4}}),heavy=ambienceMix({day:1,weather:{rain:1}}),dry=ambienceMix({day:1});
 assert.ok(light.rainLight>.15&&light.rainHeavy<.02);assert.ok(heavy.rainHeavy>.5&&heavy.rainHeavy>heavy.rainLight);assert.equal(dry.rainLight+dry.rainHeavy,0);
 assert.ok(heavy.birds<dry.birds/4,'birds shelter from the rain');assert.ok(ambienceMix({day:1,weather:{wind:1}}).wind>dry.wind*2,'storm wind');
 const inside=ambienceMix({day:1,indoors:1,weather:{rain:1}});assert.ok(inside.rainHeavy<heavy.rainHeavy&&inside.rainHeavy>0);assert.ok(ambienceFilters({indoors:1,weather:{rain:1}}).rainHeavy<1000,'muffled by the roof');
 const under=ambienceMix({day:1,weather:{rain:1,wind:1,underground:1}});assert.equal(under.rainLight+under.rainHeavy,0);
 assert.ok(ambienceFilters({weather:{snow:1}}).wind<4000,'snow hushes the wind');assert.ok(ambienceRates({day:1,forest:1,weather:{rain:1}}).bird<ambienceRates({day:1,forest:1}).bird/3);
});

test('console helpers validate the weather forms',()=>{
 assert.deepEqual(weightShares({clear:1,rain:3}),{clear:25,rain:75});assert.deepEqual(weightShares({}),{clear:100});
 const w=readWeights(Object.fromEntries(REGION_IDS.map(r=>[r,{rain:'10',clear:''}])));assert.equal(w.fens.rain,10);assert.equal(w.fens.clear,0);
 assert.throws(()=>readWeights({fens:{rain:'500'}}),/0–100/);
 assert.deepEqual(scheduleForm({enabled:true,seed:'5',slotMinutes:'30',fadeSeconds:'90'}),{enabled:true,seed:5,slotMinutes:30,fadeSeconds:90});assert.throws(()=>scheduleForm({seed:'1.5',slotMinutes:30,fadeSeconds:90}),/Seed/);
 assert.deepEqual(forceForm({region:'fens',kind:'storm',intensity:'85',minutes:'60'}),{region:'fens',kind:'storm',intensity:.85,minutes:60});assert.throws(()=>forceForm({region:'mordor',kind:'rain',intensity:50,minutes:5}),/region/);
 const pub=publicWeather({force:{fens:{kind:'snow',intensity:.5,until:new Date(T0+60000).toISOString().replace(/\.\d+Z$/,'Z')}}},T0);assert.match(regionNow(pub,'fens',T0).forced,/Forced until/);assert.match(regionNow(pub,'fens',T0).now,/Snow/);
 assert.equal(regionNow({on:false},'fens',T0).now,'Off (clear)');
});

test('db/weather.sql follows the migration rules and patches only through soft_patch',()=>{
 const sql=fs.readFileSync(new URL('../db/weather.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);assert.match(sql,/^begin;/m);assert.match(sql,/^commit;/m);
 assert.match(sql,/soft_patch\('eldervale_private\.public_game_config\(\)','weather_public'/);assert.match(sql,/soft_patch\('eldervale_private\.admin_action\(text,jsonb\)','admin_weather'/);
 assert.match(sql,/on conflict\(key\) do nothing/);assert.match(sql,/is_owner\(\)/);assert.match(sql,/insert into eldervale_private\.audit/);
 for(const r of REGION_IDS)assert.ok(sql.includes('"'+r+'":{'),'default weights for '+r);
 for(const [r,w] of Object.entries(DEFAULT_WEIGHTS))for(const [k,v] of Object.entries(w))assert.ok(sql.includes('"'+k+'":'+v),r+' '+k);
});
