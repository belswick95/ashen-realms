// Network heartbeats must not replace buttons between a touch-down and click.
export function panelStateKey(state,tab,style,items){
 return JSON.stringify([tab,style,state.equipped,state.equippedWeapon,state.equippedShield,state.equippedMount,state.amulet,state.trinket,...['armorOwned','weaponsOwned','shieldsOwned','mountsOwned','jewelryOwned'].map(k=>state[k]),Object.entries(items).map(([id,d])=>[id,d.field?null:state[id]||0]),Object.entries(state).filter(([k])=>k.endsWith('XP'))]);
}
