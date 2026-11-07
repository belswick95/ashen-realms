// Emotes (explore.js) as poses layered on the character's own animation, played in place.
// The character never leaves the ground for an emote: the gameplay root is not moved or
// turned, the body stays on the idle loop (the kneel on the Fixing_Kneeling clip, its hips
// lowered by the clip itself) so foot-ground.js keeps both boots planted, and the motion
// comes from the arms and spine only (animation.js, arms.emote).
// Previously the emote bounced the gameplay root up to .35 above the ground (dance,
// cheer) or pushed it .25 below it (bow, kneel) after the feet had been planted, and the
// dance spun the whole character: on the phone it bounced about and sank into the ground.

// How long each emote plays (s); the character then eases back to idle.
export const EMOTE_SECONDS={wave:2.2,bow:2.2,cheer:2.4,think:2.8,dance:3.2,clap:2.4,kneel:2.8,shrug:2};
// The body clip under the emote: every emote stands on the idle except the kneel.
export function emoteClip(kind){return kind==='kneel'?'Fixing_Kneeling':'Idle_Loop'}
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
// Layer weight 0..1: eases in over .3 s and back out over the last .4 s.
export function emoteWeight(kind,t){const d=EMOTE_SECONDS[kind];if(!d||!(t>=0)||t>=d)return 0;return Math.min(smooth(t/.3),smooth((d-t)/.4))}
// The pose at t seconds. Hand goals are [forward, up, out] in arm lengths from that shoulder
// (out = away from the body's midline), null leaves the arm to the clip. lean bends the spine
// forward (rad, spread over the spine bones), twist turns the chest (rad). chin: right hand to
// the chin (think).
export function emotePose(kind,t){const d=EMOTE_SECONDS[kind]||1,u=Math.max(0,Math.min(1,(Number(t)||0)/d)),tau=Math.PI*2,hold=smooth(Math.min(u/.25,(1-u)/.25,1));
 switch(kind){
  case 'wave':return {right:[.22,.82,.38+.24*Math.sin(t*tau*1.6)],left:null,lean:0,twist:0};
  case 'cheer':{const pump=Math.abs(Math.sin(t*Math.PI*2.2));return {right:[.12,.62+.3*pump,.22],left:[.12,.62+.3*pump,.22],lean:-.05,twist:0}}
  case 'clap':{const open=.5+.5*Math.cos(t*tau*2.2);return {right:[.62,-.3,-.3+.2*open],left:[.62,-.3,-.3+.2*open],lean:.04,twist:0}}
  case 'think':return {right:null,left:[.32,-.5,-.28],chin:true,lean:.06,twist:0};
  case 'shrug':{const up=Math.sin(u*Math.PI);return {right:[.3,-.55+.25*up,.48],left:[.3,-.55+.25*up,.48],lean:-.03,twist:0}}
  case 'bow':return {right:null,left:null,lean:.85*hold,twist:0};
  case 'kneel':return {right:null,left:null,lean:.2*hold,twist:0};
  case 'dance':{const s=Math.sin(t*tau*1.2);return {right:[.25,.15+.6*Math.max(0,s),.45],left:[.25,.15+.6*Math.max(0,-s),.45],lean:.04,twist:.3*s}}
  default:return null;
 }
}
