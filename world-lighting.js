// Night keeps a readable ambient floor; lantern pools add local warmth.
// Every value is a smooth function of daylight (0 night .. 1 noon) so dusk and
// dawn blend instead of stepping. Colours are hex numbers (sRGB).
const mix=(a,b,t)=>a+(b-a)*t;
function mixHex(a,b,t){let out=0;for(const s of [16,8,0])out|=Math.round(mix(a>>s&255,b>>s&255,t))<<s;return out}
function ramp(stops,d){for(let i=1;i<stops.length;i++)if(d<=stops[i][0]){const [d0,c0]=stops[i-1],[d1,c1]=stops[i],t=(d-d0)/(d1-d0);return mixHex(c0,c1,t*t*(3-2*t))}return stops.at(-1)[1]}
// Moonlight blue -> low amber -> warm white noon sun.
const sunStops=[[0,0x9fb4dc],[.2,0xb8bfd8],[.38,0xffb27a],[.62,0xffd6a8],[1,0xfff0d6]];
// Hemisphere sky/ground: cool deep night, warmer bounce from the ground by day.
const skyStops=[[0,0x93a8d4],[.35,0xb4c0dc],[1,0xcfe2ff]],groundStops=[[0,0x3a3646],[.35,0x5a4a3c],[1,0x6b5a3e]];
export function lightingAt(daylight){const d=Math.max(0,Math.min(1,Number(daylight)||0)),e=d*d*(3-2*d);
 return {ambient:1.1+e*.15,directional:.45+e*2.05,exposure:1.12-e*.22,lantern:1-d,skyNight:0x26394f,
  sunColor:ramp(sunStops,d),skyColor:ramp(skyStops,d),groundColor:ramp(groundStops,d)}}
