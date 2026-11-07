// Combat sounds: short, punchy one-shots cut from real CC0 recordings
// (assets/audio/combat, sources and edits in its CREDITS.md). Nothing here is
// synthesised. Each attack is two cues, as in Old School RuneScape: the swing
// (or bow release, or spell cast) on the wind-up, then the outcome on impact —
// a landed hit by weapon type, a parry clang, or a miss whoosh.
//
// Timing: the attack animation lasts .55 s and strikes at about .27 s, so a
// melee whoosh starts .08 s into the wind-up and its peak lands on the strike
// frame. The server's hit event arrives on the 600 ms tick the hit lands; an
// NPC's melee hit lands on the same tick as its wind-up, so the impact cue
// waits until at least the strike frame.

export const COMBAT_FILES={
 swingSword:['swing-sword-1','swing-sword-2','swing-sword-3'],
 swingHeavy:['swing-heavy-1','swing-heavy-2'],
 swingDagger:['swing-dagger-1','swing-dagger-2'],
 swingSpear:['swing-spear-1'],
 miss:['miss-1','miss-2'],
 hitBlade:['hit-blade-1','hit-blade-2','hit-blade-3'],
 hitBlunt:['hit-blunt-1','hit-blunt-2'],
 hitAxe:['hit-axe-1','hit-axe-2'],
 hitStab:['hit-stab-1','hit-stab-2'],
 punch:['punch-1','punch-2'],
 block:['block-1','block-2','block-3'],
 bowRelease:['bow-release-1','bow-release-2'],
 arrowHit:['arrow-hit-1','arrow-hit-2'],
 magicCast:['magic-cast-1'],
 magicImpact:['magic-impact-1'],
 special:['special-1'],
 hurt:['hurt-1','hurt-2'],
 growlBeast:['growl-beast-1','growl-beast-2'],
 growlUndead:['growl-undead-1','growl-undead-2'],
 growlBrute:['growl-brute-1'],
 roarDragon:['roar-dragon-1'],
 deathThud:['death-thud-1','death-thud-2']
};
// sfx.js loads sample files relative to assets/audio/sfx/.
export const COMBAT_DIR='../combat/';
export const COMBAT_SAMPLE_SETS=Object.fromEntries(Object.entries(COMBAT_FILES).map(([k,files])=>[k,files.map(f=>COMBAT_DIR+f)]));

// Weapon families that sound different: what whooshes and what lands.
export const WEAPON_SOUNDS={
 sword:{swing:'swingSword',hit:'hitBlade',stab:'hitStab'},
 twohand:{swing:'swingHeavy',hit:'hitBlade'},
 dagger:{swing:'swingDagger',hit:'hitStab'},
 axe:{swing:'swingHeavy',hit:'hitAxe'},
 blunt:{swing:'swingHeavy',hit:'hitBlunt'},
 spear:{swing:'swingSpear',hit:'hitStab'},
 bow:{swing:'bowRelease',hit:'arrowHit',ranged:true},
 staff:{swing:'magicCast',hit:'magicImpact',ranged:true,magic:true},
 unarmed:{swing:'swingDagger',hit:'punch',swingGain:.55},
 claw:{swing:null,hit:'hitBlade'},
 bite:{swing:null,hit:'hitStab'}
};
export function weaponFamily(key,weapon){
 if(!key||!weapon)return 'unarmed';
 if(weapon.magic)return 'staff';if(weapon.ranged)return 'bow';
 const k=String(key).toLowerCase();
 if(/dagger|knife|broodfang/.test(k))return 'dagger';
 if(/hammer|maul|mace|club|scepter|flail/.test(k))return 'blunt';
 if(/spear|pike|lance|trident/.test(k))return 'spear';
 if(/axe|cleaver|hatchet/.test(k))return 'axe';
 if(weapon.twoHanded||/scythe|glaive|halberd/.test(k))return 'twohand';
 return 'sword';
}
// A monster's own attack (attackType from its stat block) by family.
export function monsterFamily(attackType,weaponKey=null,catalog={}){
 const t=String(attackType||'').toLowerCase();
 if(weaponKey){const key=String(weaponKey).replace(/^weapon:/,'');if(catalog[key])return weaponFamily(key,catalog[key])}
 if(t==='arrow'||t==='ranged')return 'bow';
 if(t==='magic'||t==='fire'||t==='frost'||t==='spell')return 'staff';
 if(t==='slam'||t==='hammer'||t==='charge'||t==='crush')return 'blunt';
 if(t==='slash')return 'sword';if(t==='stab')return 'dagger';
 if(t==='claw'||t==='swoop')return 'claw';
 return 'bite';
}
// A creature's voice by species; humanoids (goblins, bandits, knights) fight
// silently and are heard through their weapons.
const UNDEAD=new Set(['skeleton','zombie','wraith','revenant','ghost','ghoul','shade','lich']);
const DRAGON=new Set(['dragon','wyrm','drake','wyvern']);
const BRUTE=new Set(['troll','ogre','golem','giant','demon','orc']);
const BEAST=new Set(['wolf','boar','bear','rat','spider','bat','hound','beast','cat','lion','snake','scorpion','crab','beetle']);
export function monsterVoice(species){
 const s=String(species||'').toLowerCase();
 if(DRAGON.has(s))return 'roarDragon';if(UNDEAD.has(s))return 'growlUndead';if(BRUTE.has(s))return 'growlBrute';if(BEAST.has(s))return 'growlBeast';return null;
}

export const SWING_DELAY=.08,STRIKE_AT=.27,BOW_RELEASE_AT=.22;
// Gains on the SFX bus (the player's Sound effects volume and mute apply on top).
const GAIN={swing:.62,hit:.9,block:.8,miss:.5,special:.85,voice:.6,hurt:.45,death:.85};

// Wind-up cue: what plays when an attack starts.
export function swingCue({family='sword',special=false}={}){
 const w=WEAPON_SOUNDS[family]||WEAPON_SOUNDS.sword,cues=[];
 if(special)cues.push({set:'special',gain:GAIN.special,delay:0});
 if(w.swing)cues.push({set:w.swing,gain:GAIN.swing*(w.swingGain||1)*(special?.7:1),delay:w.swing==='bowRelease'?BOW_RELEASE_AT:w.swing==='magicCast'?0:SWING_DELAY+(special?.12:0)});
 return cues;
}
// Impact cue: outcome is 'hit' (damage), 'block' (zero, parried) or 'miss'.
export function impactCue({family='sword',outcome='hit',damageType=null,armoured=true}={}){
 const w=WEAPON_SOUNDS[family]||WEAPON_SOUNDS.sword;
 if(outcome==='hit')return [{set:damageType==='stab'&&w.stab?w.stab:w.hit,gain:GAIN.hit}];
 if(w.magic)return [{set:'magicImpact',gain:GAIN.miss,cutoff:2200}];
 if(outcome==='block'&&armoured&&!w.ranged&&family!=='unarmed')return [{set:'block',gain:GAIN.block}];
 return [{set:'miss',gain:GAIN.miss}];
}
export function deathCue(species){const v=monsterVoice(species),cues=[{set:'deathThud',gain:GAIN.death,delay:.25}];if(v)cues.unshift({set:v,gain:GAIN.voice,rate:.82,delay:0});return cues}

// Every combat event the game reacts to, and the sample sets it can play.
export const COMBAT_EVENTS={
 attack:Object.values(WEAPON_SOUNDS).map(w=>w.swing).filter(Boolean),
 hit:[...new Set(Object.values(WEAPON_SOUNDS).flatMap(w=>[w.hit,w.stab]).filter(Boolean))],
 block:['block'],miss:['miss'],special:['special'],
 magicCast:['magicCast'],magicImpact:['magicImpact'],bowShot:['bowRelease'],arrowImpact:['arrowHit'],
 playerHurt:['hurt'],monsterAttack:['growlBeast','growlUndead','growlBrute','roarDragon'],
 monsterDeath:['deathThud','growlBeast','growlUndead','growlBrute','roarDragon'],playerDeath:['deathThud']
};

// Plays cues through sfx.js: positional (distance fade, pan, air absorption)
// for anyone but the local player, ±5% pitch and level per hit, and a shared
// voice budget so a big fight never stacks into clipping.
export function createCombatAudio({sfx=()=>null,now=()=>performance.now()/1000,random=Math.random}={}){
 const swings=new Map();
 function play(cues,{at=null,self=false,mine=false,extraDelay=0}={}){
  const fx=sfx();if(!fx)return 0;let played=0;
  // mine: a fight the local player is in (a monster attacking them) — positional but full priority.
  const own=self||mine;
  for(const c of cues){const ok=fx.sample(c.set,{at:self?null:at,gain:c.gain*(own?1:.85),delay:(c.delay||0)+extraDelay,vary:.05,rate:c.rate,cutoff:c.cutoff,far:45,group:'combat',priority:own?2:1});if(ok)played++}
  return played;
 }
 return {
  // key identifies the attacker→target pair so the impact can follow its swing.
  swing(key,cue,opts={}){swings.set(key,now());if(swings.size>64)swings.delete(swings.keys().next().value);return play(swingCue(cue),opts)},
  // opts.hurt: the local player was wounded, so sometimes add a short grunt.
  impact(key,cue,opts={}){const t=swings.get(key),wait=t==null?0:Math.max(0,t+STRIKE_AT-now());swings.delete(key);const cues=impactCue(cue);if(opts.hurt&&random()<.35)cues.push({set:'hurt',gain:GAIN.hurt,delay:.07});return play(cues,{...opts,extraDelay:wait})},
  voice(species,opts={},chance=.6){const v=monsterVoice(species);if(!v||random()>chance)return 0;return play([{set:v,gain:GAIN.voice,delay:0}],opts)},
  death(species,opts={}){return play(deathCue(species),opts)},
  play
 };
}
