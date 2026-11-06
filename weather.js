// Shared weather (server: db/weather.sql). The world is split into five weather
// regions; each changes on a fixed schedule picked from region weights by an
// integer hash of (seed, region, slot), so every client and the server agree on
// the same weather at the same time without any traffic beyond a small summary
// in the snapshot's gameConfig. This module is pure (no THREE, no DOM):
// - weatherHash / slotWeather / regionWeather / publicWeather mirror the SQL
//   functions exactly (tests check the vectors);
// - weatherRegionWeights blends the regions by position (biome + fen zone);
// - weatherLook turns a kind + intensity into visual/audio parameters, and
//   weatherAt blends them for a player position (schedule transitions and
//   region borders both fade smoothly).
import {biomeWeights} from './procedural-world.js?v=release-20261106-osrswalk124';

export const WEATHER_KINDS=['clear','cloudy','rain','storm','fog','snow','ash','haze'];
export const WEATHER_LABELS={clear:'Clear',cloudy:'Cloudy',rain:'Rain',storm:'Thunderstorm',fog:'Fog',snow:'Snow',ash:'Ashfall',haze:'Heat haze'};
// Region ids and their hash index (fixed: changing an index reshuffles its schedule).
export const WEATHER_REGIONS=[
 {id:'heartlands',index:1,name:'Royal Heartlands',about:'The castle and the north-west'},
 {id:'birchford',index:2,name:'Birchford & the Verdant Wilds',about:'Birchford and the green south-west'},
 {id:'fens',index:3,name:'Willow fen & Gloomfen',about:'Marshes in the far south-west: rain and fog'},
 {id:'winterwatch',index:4,name:'Winterwatch & the Frostbound north',about:'Snowy highlands around Winterwatch'},
 {id:'emberspire',index:5,name:'Emberspire & the Amber Expanse',about:'Hot, dry south-east: ashfall and heat haze'}
];
export const REGION_IDS=WEATHER_REGIONS.map(r=>r.id);
// Default schedule weights (integers 0–100, relative). Snow mostly in the north,
// ash and haze only near Emberspire, rain and fog most often in the fens.
export const DEFAULT_WEIGHTS={
 heartlands:{clear:40,cloudy:24,rain:16,storm:5,fog:12,snow:3,ash:0,haze:0},
 birchford:{clear:38,cloudy:24,rain:20,storm:6,fog:12,snow:0,ash:0,haze:0},
 fens:{clear:16,cloudy:22,rain:28,storm:8,fog:26,snow:0,ash:0,haze:0},
 winterwatch:{clear:24,cloudy:24,rain:3,storm:4,fog:10,snow:35,ash:0,haze:0},
 emberspire:{clear:44,cloudy:16,rain:2,storm:6,fog:0,snow:0,ash:16,haze:16}
};
export const DEFAULT_WEATHER={enabled:true,seed:7331,slotMinutes:20,fadeSeconds:120,weights:{},force:{}};
export const WEATHER_LIMITS={slotMinutes:[5,240],fadeSeconds:[10,600],seed:[0,2147483647],intensity:[.1,1],forceMinutes:[1,1440]};

// 32-bit integer hash; identical to eldervale_private.weather_hash (bigint maths mod 2^32).
export function weatherHash(seed,region,slot,salt){
 let h=(Math.imul(seed>>>0,73856093)+Math.imul(region,19349663)+Math.imul(slot,83492791)+Math.imul(salt,2654435))>>>0;
 h=Math.imul((h^(h>>>16))>>>0,73244475)>>>0;h=Math.imul((h^(h>>>16))>>>0,73244475)>>>0;return (h^(h>>>16))>>>0;
}
const int=(v,lo,hi,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):fallback;
// Stored settings merged over the defaults (same rules as eldervale_private.weather_settings).
export function weatherSettings(stored={}){
 const s=stored&&typeof stored==='object'?stored:{},weights={};
 for(const id of REGION_IDS){const w={...DEFAULT_WEIGHTS[id]},o=s.weights?.[id];if(o&&typeof o==='object')for(const k of WEATHER_KINDS)w[k]=int(o[k],0,100,w[k]);weights[id]=w}
 return {enabled:typeof s.enabled==='boolean'?s.enabled:true,seed:int(s.seed,...WEATHER_LIMITS.seed,DEFAULT_WEATHER.seed),slotMinutes:int(s.slotMinutes,...WEATHER_LIMITS.slotMinutes,DEFAULT_WEATHER.slotMinutes),
  fadeSeconds:int(s.fadeSeconds,...WEATHER_LIMITS.fadeSeconds,DEFAULT_WEATHER.fadeSeconds),weights,force:s.force&&typeof s.force==='object'&&!Array.isArray(s.force)?s.force:{}};
}
const regionIndex=id=>WEATHER_REGIONS.find(r=>r.id===id)?.index||0;
// Scheduled weather of one region in one slot: {k: kind, i: intensity 0.45–1}.
export function slotWeather(cfg,region,slot){
 const w=cfg.weights[region]||DEFAULT_WEIGHTS[region]||{clear:1},total=WEATHER_KINDS.reduce((s,k)=>s+(w[k]||0),0),ri=regionIndex(region);
 if(!total)return {k:'clear',i:1};
 let r=weatherHash(cfg.seed,ri,slot,0)%total,k='clear';for(const kind of WEATHER_KINDS){const n=w[kind]||0;if(r<n){k=kind;break}r-=n}
 return {k,i:(45+weatherHash(cfg.seed,ri,slot,1)%56)/100};
}
export const slotIndex=(cfg,ms)=>Math.floor(ms/1000/(cfg.slotMinutes*60));
// The summary the server publishes as gameConfig.weather (eldervale_private.weather_public).
export function publicWeather(stored,ms){
 const cfg=weatherSettings(stored);if(!cfg.enabled)return {on:false};
 const span=cfg.slotMinutes*60,n=slotIndex(cfg,ms),regions={};
 for(const id of REGION_IDS){const c=slotWeather(cfg,id,n),p=slotWeather(cfg,id,n-1),x=slotWeather(cfg,id,n+1),out={k:c.k,i:c.i,pk:p.k,pi:p.i,nk:x.k,ni:x.i};
  const f=cfg.force[id],until=f&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(f.until||'')?Date.parse(f.until):NaN;if(f&&WEATHER_KINDS.includes(f.kind)&&until>ms){out.fk=f.kind;out.fi=Math.max(.1,Math.min(1,Number(f.intensity)||.8));out.fu=until}
  regions[id]=out}
 return {on:true,seed:cfg.seed,slot:span,fade:cfg.fadeSeconds,start:n*span*1000,regions};
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
// One region's weather at time `ms` from the published summary: the current kind,
// the kind it is fading from, and the fade progress (1 = fully arrived).
export function regionWeather(pub,region,ms){
 const r=pub?.on&&pub.regions?.[region];if(!r)return {kind:'clear',intensity:0,from:{kind:'clear',intensity:0},mix:1,forced:false};
 if(r.fk&&ms<r.fu)return {kind:r.fk,intensity:r.fi,from:{kind:r.fk,intensity:r.fi},mix:1,forced:true,until:r.fu};
 const slot=pub.slot*1000,fade=Math.max(1,pub.fade*1000),t=ms-pub.start;
 // A summary that is a slot old (no fresh snapshot yet) carries on to the next slot.
 if(t>=slot)return {kind:r.nk,intensity:r.ni,from:{kind:r.k,intensity:r.i},mix:Math.min(1,(t-slot)/fade),forced:false};
 return {kind:r.k,intensity:r.i,from:{kind:r.pk,intensity:r.pi},mix:Math.max(0,Math.min(1,t/fade)),forced:false};
}

// --- Regions by position -----------------------------------------------------
// Willow fen and Gloomfen sit in the far south-west of the green biome.
export const FEN_ZONE={x:-195,z:285,inner:75,outer:155};
export function fenFactor(x,z){const d=Math.hypot(x-FEN_ZONE.x,z-FEN_ZONE.z);return 1-smooth((d-FEN_ZONE.inner)/(FEN_ZONE.outer-FEN_ZONE.inner))}
export function weatherRegionWeights(x,z,seed=1){
 const b=biomeWeights(x,z,seed),f=fenFactor(x,z);
 return {heartlands:b.castle*(1-f),birchford:b.grass*(1-f),fens:f*(b.grass+b.castle),winterwatch:b.snow,emberspire:b.dry};
}
export function weatherRegionAt(x,z,seed=1){const w=weatherRegionWeights(x,z,seed);return REGION_IDS.reduce((a,b)=>w[b]>w[a]?b:a)}

// --- Looks ---------------------------------------------------------------------
// Every field is 0..1 except thunder (strikes per minute). tint is the sRGB fog /
// overcast colour the sky leans toward ([r,g,b] 0..1).
const ZERO={cloud:0,dark:0,rain:0,snow:0,ash:0,fog:0,wind:.12,wet:0,cover:0,thunder:0,haze:0,tint:[.62,.68,.74]};
export const LOOK_FIELDS=['cloud','dark','rain','snow','ash','fog','wind','wet','cover','thunder','haze'];
export function weatherLook(kind,intensity=1){
 const i=Math.max(0,Math.min(1,Number(intensity)||0)),L={...ZERO,tint:[...ZERO.tint]};
 switch(kind){
  case 'cloudy':Object.assign(L,{cloud:.55+.4*i,dark:.1+.12*i,fog:.06+.08*i,wind:.25+.15*i,tint:[.64,.68,.72]});break;
  case 'rain':Object.assign(L,{cloud:.85+.15*i,dark:.22+.16*i,rain:.3+.6*i,fog:.18+.16*i,wind:.3+.2*i,wet:1,tint:[.52,.57,.62]});break;
  case 'storm':Object.assign(L,{cloud:1,dark:.42+.18*i,rain:.75+.25*i,fog:.28+.12*i,wind:.7+.3*i,wet:1,thunder:1.5+4*i,tint:[.36,.4,.46]});break;
  case 'fog':Object.assign(L,{cloud:.45,dark:.08+.08*i,fog:.55+.4*i,wind:.04,wet:.3,tint:[.74,.77,.78]});break;
  case 'snow':Object.assign(L,{cloud:.8+.2*i,dark:.12+.1*i,snow:.3+.7*i,fog:.25+.25*i,wind:.25+.25*i,cover:1,tint:[.8,.83,.87]});break;
  case 'ash':Object.assign(L,{cloud:.5+.2*i,dark:.18+.14*i,ash:.3+.7*i,fog:.25+.2*i,wind:.2+.15*i,tint:[.48,.4,.34]});break;
  case 'haze':Object.assign(L,{cloud:.05,fog:.18+.2*i,haze:.6+.4*i,wind:.08,tint:[.86,.74,.56]});break;
 }
 return L;
}
export function blendLooks(parts){
 const out={...ZERO,tint:[0,0,0],wind:0};let total=0;
 for(const [w,look] of parts){if(!(w>0))continue;total+=w;for(const f of LOOK_FIELDS)out[f]+=look[f]*w;for(let c=0;c<3;c++)out.tint[c]+=look.tint[c]*w}
 if(!total)return {...ZERO,tint:[...ZERO.tint]};
 for(const f of LOOK_FIELDS)out[f]/=total;for(let c=0;c<3;c++)out.tint[c]/=total;return out;
}
export function regionLook(state){const to=weatherLook(state.kind,state.intensity);if(state.mix>=1)return to;const m=smooth(state.mix);return blendLooks([[1-m,weatherLook(state.from.kind,state.from.intensity)],[m,to]])}
// The blended look at a position: region weights x each region's (fading) state.
// `preview` ({kind,intensity}) replaces everything (owner preview on one screen).
export function weatherAt(pub,x,z,ms,{seed=1,preview=null}={}){
 if(preview&&WEATHER_KINDS.includes(preview.kind)){const look=weatherLook(preview.kind,preview.intensity??.8);return {look,kind:preview.kind,region:weatherRegionAt(x,z,seed),states:{}}}
 const weights=weatherRegionWeights(x,z,seed),parts=[],states={};let region=REGION_IDS[0],best=-1,kind='clear',kindWeight=-1;
 for(const id of REGION_IDS){const w=weights[id];if(w>best){best=w;region=id}if(w<.01)continue;const s=regionWeather(pub,id,ms);states[id]=s;parts.push([w,regionLook(s)]);const kw=w*(s.mix>=.5?1:0);if(kw>kindWeight){kindWeight=kw;kind=s.mix>=.5?s.kind:s.from.kind}}
 return {look:blendLooks(parts),kind,region,states};
}
// Deterministic lightning: for whole second `second`, does a strike happen at
// `rate` strikes per minute, and where (bearing radians, virtual distance km)?
// Players standing together see the same flash at the same moment.
export function lightningAt(seed,regionId,second,rate){
 if(!(rate>0))return null;const ri=regionIndex(regionId)||1;
 if(weatherHash(seed,ri,second,9)%10000>=Math.min(1,rate/60)*10000)return null;
 return {bearing:weatherHash(seed,ri,second,10)%3600/3600*Math.PI*2,distance:.4+weatherHash(seed,ri,second,11)%560/100,pulses:1+weatherHash(seed,ri,second,12)%3};
}
// Thunder heard after a flash: about 3 s per km, nearer = louder and brighter.
export function thunderFor(distanceKm){const d=Math.max(.1,distanceKm);return {delay:d*2.9,gain:Math.max(.12,Math.min(1,1.25/(1+d*.55))),cutoff:Math.max(450,9000/(1+d*1.6)),crack:d<1.4}}
// Short label for the HUD clock ("Rain", "Light snow", "Heavy rain"...).
export function weatherLabel(kind,intensity=1){if(kind==='clear')return '';const base=WEATHER_LABELS[kind]||kind;if(kind==='rain'||kind==='snow')return intensity<.6?'Light '+base.toLowerCase():intensity>.88?'Heavy '+base.toLowerCase():base;return base}
// Upcoming slots for the console preview: [{start ms, k, i}] for each region.
export function weatherForecast(stored,ms,count=6){const cfg=weatherSettings(stored),n=slotIndex(cfg,ms),span=cfg.slotMinutes*60000,out={};for(const id of REGION_IDS)out[id]=Array.from({length:count},(_,j)=>({start:(n+j)*span,...slotWeather(cfg,id,n+j)}));return out}

// Shared shader uniforms (natural-environment.js terrain, grass and sky; signs).
// Plain {value} objects so this module stays THREE-free; weather-effects.js drives them.
export const weatherUniforms={weatherWet:{value:0},weatherSnow:{value:0},weatherWind:{value:0},weatherCloud:{value:0},weatherOvercast:{value:0},weatherFlash:{value:0},weatherCloudShift:{value:{x:0,y:0,isVector2:true}}};
