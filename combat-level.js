// Old School RuneScape experience curve. XP(L) = floor(Σ_{l=1}^{L-1} floor(l + 300·2^(l/7)) / 4);
// level 2 needs 83 XP, level 99 needs 13,034,431 XP. Every skill caps at 99.
// Mirrors eldervale_private.level_xp / xp_level in db/osrs-skills-and-food.sql.
export const MAX_LEVEL=99,MAX_XP=200000000,HITPOINTS_START=10;
export const XP_TABLE=(()=>{const t=[0,0];let points=0;for(let l=1;l<=MAX_LEVEL;l++){points+=Math.floor(l+300*2**(l/7));t[l+1]=Math.floor(points/4)}return t})();
export const xpForLevel=level=>XP_TABLE[Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number(level)||1)))];
export function skillLevel(xp){const v=Math.max(0,Number(xp)||0);let lo=1,hi=MAX_LEVEL;while(lo<hi){const mid=(lo+hi+1)>>1;if(XP_TABLE[mid]<=v)lo=mid;else hi=mid-1}return lo}
export const levelForXp=skillLevel;
// Hitpoints never drops below level 10 (new characters start there); max HP is 10 × Hitpoints level.
export const hitpointsLevel=xp=>Math.max(HITPOINTS_START,skillLevel(xp));
export const maxHpForXp=xp=>10*hitpointsLevel(xp);
// Progress inside the current level, 0..1 (1 at level 99).
export function xpProgress(xp){const v=Math.max(0,Number(xp)||0),l=skillLevel(v);if(l>=MAX_LEVEL)return {level:l,floor:XP_TABLE[l],next:XP_TABLE[l],fraction:1,remaining:0};const floor=XP_TABLE[l],next=XP_TABLE[l+1];return {level:l,floor,next,fraction:(v-floor)/(next-floor),remaining:next-v}}
// OSRS combat formula: base = ¼(Defence + Hitpoints + ⌊Prayer/2⌋); the best of melee
// 0.325(Attack + Strength), ranged 0.325⌊1.5·Ranged⌋ or magic 0.325⌊1.5·Magic⌋ is added.
// Eldervale caps it at 99; it becomes 100 only when Attack, Strength, Defence,
// Ranged and Magic are all 99.
export function combatLevel(skills={}){const l=k=>skillLevel(skills[k]);if(['attackXP','strengthXP','defenceXP','rangedXP','magicXP'].every(k=>l(k)>=MAX_LEVEL))return 100;
 const base=.25*(l('defenceXP')+hitpointsLevel(skills.hitpointsXP)+Math.floor(l('prayerXP')/2)),melee=.325*(l('attackXP')+l('strengthXP')),ranged=.325*Math.floor(l('rangedXP')*3/2),magic=.325*Math.floor(l('magicXP')*3/2);
 return Math.min(MAX_LEVEL,Math.max(3,Math.floor(base+Math.max(melee,ranged,magic))))}
// One-time migration from the old curve (level = 1 + ⌊√(xp/50)⌋, 99 at 480,200 XP): the same
// level on the OSRS curve plus the same fraction of the way to the next level. Mirrors
// eldervale_private.osrs_xp_from_legacy. Hitpoints is raised to at least level 10.
export function migrateLegacyXp(xp,{hitpoints=false}={}){const v=Math.max(0,Math.floor(Number(xp)||0)),old=Math.min(MAX_LEVEL,1+Math.floor(Math.sqrt(v/50)));let out;
 if(old>=MAX_LEVEL)out=XP_TABLE[MAX_LEVEL]+Math.max(0,v-480200);else{const lo=50*(old-1)**2,hi=50*old**2;out=XP_TABLE[old]+Math.floor((v-lo)/(hi-lo)*(XP_TABLE[old+1]-XP_TABLE[old]))}
 out=Math.min(MAX_XP,out);return hitpoints?Math.max(XP_TABLE[HITPOINTS_START],out):out}
// Combat XP per hit, OSRS style. Melee: 4 XP per damage to the trained skill
// (Stab = accurate → Attack, Slash = aggressive → Strength, Lunge = controlled →
// 1⅓ each to Attack, Strength and Defence); ranged 4 per damage; magic 2 per damage
// plus the spell's base XP. Hitpoints gains 1⅓ per damage dealt and 1 per damage taken.
export function combatXp({damage=0,style='slash',ranged=false,magic=false,baseSpellXp=6}={}){const d=Math.max(0,Math.floor(damage)),out={};const add=(k,n)=>{if(n>0)out[k]=(out[k]||0)+n};
 if(magic){add('magicXP',2*d+baseSpellXp)}else if(ranged)add('rangedXP',4*d);else if(style==='stab')add('attackXP',4*d);else if(style==='lunge'){const each=Math.round(4*d/3);add('attackXP',each);add('strengthXP',each);add('defenceXP',each)}else add('strengthXP',4*d);
 add('hitpointsXP',Math.round(4*d/3));return out}
export const damageTakenHitpointsXp=damage=>Math.max(0,Math.floor(damage));
export const crossedSwords='<svg class="combat-swords" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><path d="m5 2 6 3 14 17-3 3L5 11Z"/><path d="m27 2-6 3L7 22l3 3L27 11Z"/><path d="m3 19 2-2 10 10-2 2Zm14 8 10-10 2 2-10 10ZM2 29l6-6 2 2-6 6Zm20-4 2-2 6 6-2 2Z"/></g></svg>';
