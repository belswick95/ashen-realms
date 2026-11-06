import {levelSkills} from './level-up.js?v=release-20261106-terrain111';
import {formatXp} from './combat-level.js?v=release-20261106-terrain111';
// RuneScape-style XP drops: when a skill's XP rises, a small "+N Skill" label
// floats up near the top right and fades. Purely cosmetic; the server owns XP.
// OSRS XP can be fractional (17.5 per copper ore, 6.25 per bronze bar), so gains keep two decimals.
export function xpDelta(previous,next){const out=[];if(!previous)return out;for(const s of levelSkills){const gain=Math.round(((Number(next[s.key])||0)-(Number(previous[s.key])||0))*100)/100;if(gain>0&&gain<5e6)out.push({key:s.key,name:s.name,gain})}return out}
export function createXpDrops({host=document.body}={}){
 const box=document.createElement('div');box.className='xp-drops';box.setAttribute('aria-hidden','true');box.style.cssText='position:fixed;right:clamp(12px,22vw,250px);top:72px;z-index:30;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;font:600 13px/1.2 system-ui,sans-serif;color:#f6e7b0;text-shadow:0 1px 2px #000,0 0 3px #000';host.append(box);
 let previous=null,account=null;
 function show({name,gain}){const node=document.createElement('span');node.textContent='+'+formatXp(gain)+' '+name;node.style.cssText='transition:transform 1.6s ease-out,opacity 1.6s ease-in;opacity:1';box.append(node);requestAnimationFrame(()=>requestAnimationFrame(()=>{node.style.transform='translateY(-34px)';node.style.opacity='0'}));setTimeout(()=>node.remove(),1700);while(box.children.length>6)box.firstChild.remove()}
 return {sync(state,userId){if(account!==userId){account=userId;previous=null}const next=Object.fromEntries(levelSkills.map(s=>[s.key,Number(state[s.key])||0]));for(const d of xpDelta(previous,next))show(d);previous=next}};
}
