// Night keeps a readable ambient floor; lantern pools add local warmth.
export function lightingAt(daylight){const d=Math.max(0,Math.min(1,Number(daylight)||0));return {ambient:.90+d*1.10,directional:.48+d*1.82,lantern:1-d,skyNight:0x26394f}}
