export const skillLevel=xp=>Math.min(100,1+Math.floor(Math.sqrt(Math.max(0,Number(xp)||0)/50)));
export function combatLevel(skills={}){return Math.min(100,Math.max(1,Math.floor((skillLevel(skills.attackXP)+skillLevel(skills.defenceXP)+skillLevel(skills.strengthXP))/3)))}
export const crossedSwords='<svg class="combat-swords" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><path d="m5 2 6 3 14 17-3 3L5 11Z"/><path d="m27 2-6 3L7 22l3 3L27 11Z"/><path d="m3 19 2-2 10 10-2 2Zm14 8 10-10 2 2-10 10ZM2 29l6-6 2 2-6 6Zm20-4 2-2 6 6-2 2Z"/></g></svg>';
