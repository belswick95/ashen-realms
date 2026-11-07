import {weaponCatalog} from './weapons.js?v=release-20261107-qaui148';
import {ARROW_SPEED,BOLT_SPEED} from './arrows.js?v=release-20261107-qaui148';
// How each weapon attacks: the motion kind, the clip under it, and when it strikes.
// Pure data and maths (no Three.js) so the animator (animation.js), the combat
// presentation timeline (combat-timeline.js, game.js) and the tests agree on one
// strike time per weapon.
//
// Kinds:
//  slash  swords, scimitars: the authored sword swing (Sword_Attack)
//  stab   daggers, spears (and a sword on a stab style): a straight thrust (Punch_Cross + blade forward)
//  crush  hammers, maces, mauls: an overhead blow brought straight down (arm layer)
//  chop   axes, cleavers, picks: a diagonal overhead chop (arm layer)
//  heavy  two-handed swords, scythes, glaives: the wide swing with both hands on the grip
//  bow    draw and release (animation.js aim layer), then the arrow's flight
//  cast   staffs: the casting hand throws the bolt while the staff hand thrusts, then the bolt's flight
//  punch  unarmed
//
// Clip motions are re-timed so the clip's own strike frame (clipStrike, a fraction of the clip)
// lands at `strike` seconds: the wind-up is sped up rather than the damage delayed.
// Layer motions are keyframed in the arm layer (animation.js, createArmLayers().strike).
export const ATTACK_DURATION=.55;
export const MOTIONS={
 slash:{kind:'slash',clip:'Sword_Attack',clipStrike:.29,clipEnd:.9,strike:.2},
 stab:{kind:'stab',clip:'Punch_Cross',clipStrike:.23,clipEnd:.95,strike:.17,layer:'thrust'},
 crush:{kind:'crush',clip:null,strike:.24,layer:'overhead'},
 chop:{kind:'chop',clip:null,strike:.22,layer:'chop'},
 heavy:{kind:'heavy',clip:'Sword_Attack',clipStrike:.29,clipEnd:.9,strike:.26,layer:'twoHand'},
 punch:{kind:'punch',clip:'Punch_Cross',clipStrike:.23,clipEnd:.95,strike:.15},
 // Bow: the string is released at 70% of the draw (animation.js), never shorter than .6 s.
 bow:{kind:'bow',clip:null,strike:.42,ranged:true,projectile:'arrow'},
 // Staff: the bolt leaves the casting hand at 45% of the cast (animation.js), never shorter than .45 s.
 cast:{kind:'cast',clip:'Spell_Simple_Shoot',strike:.2475,ranged:true,magic:true,projectile:'bolt',layer:'staff'}
};
const model=key=>String(weaponCatalog[key]?.model||key||'').toLowerCase();
// Weapon family by its key and model (uniques and tiers reuse an iron model).
export function attackKind(key,{style=null,armed=!!key,ranged=false,magic=false}={}){
 const w=key?weaponCatalog[key]:null;
 if(w?.magic||(!w&&magic))return 'cast';
 if(w?.ranged||(!w&&ranged))return 'bow';
 if(!w)return armed?'slash':'punch';
 const k=String(key).toLowerCase(),m=model(key);
 const has=re=>re.test(k)||re.test(m);
 if(has(/dagger|knife|broodfang/))return 'stab';
 if(has(/spear|pike|lance|trident/))return 'stab';
 if(has(/hammer|maul|mace|club|flail/))return 'crush';
 if(has(/axe|cleaver|hatchet|pick/))return 'chop';
 if(w.twoHanded||has(/scythe|glaive|halberd|claymore|twohand/))return 'heavy';
 // One-handed swords thrust on a stab style (OSRS: Accurate/Controlled with a stab type).
 const type=w.styles?.[style==='block'?'lunge':style];
 return type==='stab'?'stab':'slash';
}
export function attackMotion(key,options={}){const kind=attackKind(key,options);return {...MOTIONS[kind],twoHanded:!!weaponCatalog[key]?.twoHanded}}
// Seconds from the start of the swing to the strike frame (for ranged: the release).
export function strikeTime(key,options={}){
 const m=attackMotion(key,options),d=Number(options.duration)>0?options.duration:ATTACK_DURATION;
 if(m.kind==='bow')return .7*Math.max(.6,d);
 if(m.kind==='cast')return .45*Math.max(.45,d);
 return Math.min(m.strike,d*.6);
}
// Seconds from the start of the swing until the blow lands on a target `distance` units away:
// the strike frame, plus the projectile's flight for bows and staffs.
export function impactDelay(key,{distance=0,...options}={}){
 const m=attackMotion(key,options),d=Math.max(0,Number(distance)||0);
 const flight=m.projectile==='arrow'?d/ARROW_SPEED:m.projectile==='bolt'?d/BOLT_SPEED:0;
 return strikeTime(key,options)+(m.projectile?Math.max(.08,flight):0);
}
// Monster attack clips play over `attackSeconds` (monster-models.js MONSTER_MODELS[].attack,
// the 0.55 s wind-up otherwise); their blow lands a little before the middle.
export function monsterStrike(attackSeconds=ATTACK_DURATION,{ranged=false,distance=0}={}){
 const s=Math.max(.18,Math.min(.45,(Number(attackSeconds)||ATTACK_DURATION)*.45));
 return ranged?s+Math.max(.08,(Number(distance)||0)/BOLT_SPEED):s;
}
// The clip time that plays `t` seconds into a re-timed clip motion: the wind-up
// [0, strike] covers the clip up to its strike frame, the recovery the rest.
export function clipTime(motion,t,clipDuration,duration=ATTACK_DURATION){
 const strikeAt=Math.min(motion.strike,duration*.6),cs=(motion.clipStrike??.5)*clipDuration,ce=(motion.clipEnd??1)*clipDuration;
 if(t<=0)return 0;if(t<strikeAt)return cs*t/strikeAt;
 return Math.min(ce,cs+(ce-cs)*Math.min(1,(t-strikeAt)/Math.max(.05,duration-strikeAt)));
}
