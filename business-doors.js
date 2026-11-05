// Doors that are held open: the castle gate, banks, and every building where a
// core service lives (a banker, merchant, smith, innkeeper or healer works
// inside, or a crafting/prayer station stands inside). Players can only examine
// them. Mirrors eldervale_private.door_held_open in db/business-doors.sql.
export const SERVICE_ROLES=['banker','merchant','smith','innkeeper','healer'];
export const SERVICE_STATIONS=['altar','rune_altar','hearth','furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','practice_chest','thieving_stall','essence_rock','cooking_tripod'];
export const HELD_OPEN_TEMPLATES=['bank'];
export function heldOpen({kind,template}={},{roles=[],stations=[]}={}){
 if(kind==='castle_gate'||kind==='castleGate'||template==='castle_gate')return true;
 if(HELD_OPEN_TEMPLATES.includes(template))return true;
 return roles.some(r=>SERVICE_ROLES.includes(r))||stations.some(s=>SERVICE_STATIONS.includes(s));
}
export function heldOpenExamine(kind){return kind==='castle_gate'||kind==='castleGate'?'The castle gates stand open.':'The doors are held open for business.'}
