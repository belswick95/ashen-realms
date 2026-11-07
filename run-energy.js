// Run energy (docs/mechanics-spec.md 3), percent 0..100 on the HUD; one OSRS energy unit = 0.01 %.
// Per 600 ms tick: running drains floor((60 + 67 x min(weight,64)/64) x (1 - agility/300)) units,
// walking or standing regenerates floor(agility/10) + 15. The server (mech_energy) is
// authoritative; this is the offline fallback and the client prediction.
import {runDrain,runRegen,TICK} from './mechanics.js?v=release-20261107-perf146';
export function stepEnergy(energy,enabled,moving,dt,{weight=0,agility=1,stamina=false}={}){
 const ticks=(Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0)/TICK;
 const value=Number.isFinite(energy)?Math.max(0,Math.min(100,energy)):100;
 const delta=enabled&&moving?-runDrain(weight,agility,{stamina})*ticks/100:runRegen(agility)*ticks/100;
 const next=Math.max(0,Math.min(100,value+delta));
 return {energy:next,running:enabled&&next>0,exhausted:enabled&&value>0&&next===0};
}
export const footIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M19 12c5 1 7 6 5 10-1 3-1 7-5 8-5 1-8-2-7-6 1-3 0-5 1-8 1-3 3-5 6-4Z"/><ellipse fill="currentColor" cx="22" cy="6" rx="4" ry="5"/><ellipse fill="currentColor" cx="14.5" cy="6" rx="2.4" ry="3.2"/><ellipse fill="currentColor" cx="9" cy="9" rx="2" ry="2.6"/><ellipse fill="currentColor" cx="6" cy="14" rx="1.7" ry="2.2"/></svg>';
