// Pull inward immediately to avoid walls; ease outward instead of popping back.
export function obstructionDistance(previous,available,desired,dt){
 const target=Math.max(.8,Math.min(available,desired));
 if(!Number.isFinite(previous)||target<previous)return target;
 return Math.min(target,previous+(target-previous)*(1-Math.exp(-5*Math.max(0,Math.min(.1,dt)))));
}
