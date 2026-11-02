export function stepEnergy(energy,enabled,moving,dt){
 const seconds=Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0;
 const value=Number.isFinite(energy)?Math.max(0,Math.min(100,energy)):100;
 const next=Math.max(0,Math.min(100,value+(enabled&&moving?-5:moving?1.5:3)*seconds));
 return {energy:next,running:enabled&&next>0,exhausted:enabled&&value>0&&next===0};
}
export const footIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M19 12c5 1 7 6 5 10-1 3-1 7-5 8-5 1-8-2-7-6 1-3 0-5 1-8 1-3 3-5 6-4Z"/><ellipse fill="currentColor" cx="22" cy="6" rx="4" ry="5"/><ellipse fill="currentColor" cx="14.5" cy="6" rx="2.4" ry="3.2"/><ellipse fill="currentColor" cx="9" cy="9" rx="2" ry="2.6"/><ellipse fill="currentColor" cx="6" cy="14" rx="1.7" ry="2.2"/></svg>';
