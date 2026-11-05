// Paper-doll equipment layout: the existing equipment slot buttons (each with
// data-slot) are arranged in body order on stone slots joined by chains.
// Empty slots show an outline silhouette of what goes there (original SVG art).
//
//            head
//   cape     neck     ammo
//   weapon   body     shield
//            legs
//   gloves   feet     ring
// Slots without a place on the doll (shoulders, scarf) sit in a row below it.

const P=d=>`<path d="${d}"/>`;
export const SILHOUETTES={
 helm:P('M6 20V11a6 6 0 0 1 12 0v9h-4v-6h-1.5v3h-1v-3H10v6z')+P('M8.5 11.5h7'),
 cape:P('M9 4h6l-1 2 4 13H6l4-13z')+P('M10.5 6.5c1 .7 2 .7 3 0'),
 amulet:P('M7 4c0 5 2.5 8 5 9 2.5-1 5-4 5-9')+'<circle cx="12" cy="16" r="2.6"/>',
 ammo:P('M5 19 17 7M9 20 20 9M14 7h3.5v3.5M17 9h3.5v3.5M5 19l-1 1M9 20l-1 1M6 16l-2 .5M10 17l-2 .5'),
 weapon:P('M5 5l10.5 10.5M14 18l4-4M17 17l2.5 2.5M5 5h2.5v2.5'),
 chest:P('M8 5c-3 0-5 2-5 4 0 1.5 1 2 2.5 2V19h13v-8c1.5 0 2.5-.5 2.5-2 0-2-2-4-5-4-1 1.5-2.5 2-4 2s-3-.5-4-2z')+P('M12 9v9'),
 legs:P('M8 4h8l-.5 5-1 10h-3l-.5-8-.5 8h-3l-1-10z')+P('M12 4v3'),
 shield:P('M5 5c3 0 5-1 7-2 2 1 4 2 7 2v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9z')+P('M12 7v10M8 11.5h8'),
 arms:P('M4 9c0-2 1.5-3 3-3h3l2 2-1 2H8l1 3H5z')+P('M20 15c0 2-1.5 3-3 3h-3l-2-2 1-2h3l-1-3h4z'),
 boots:P('M5 4h5v9l3 2.5c1.5 1 2 2 2 3.5H5z')+P('M12 4h4v8l3 2.5c1 .8 1.5 1.7 1.5 3.5H16')+P('M5 16h7'),
 trinket:'<circle cx="12" cy="15" r="5"/>'+P('M10 9.5 9 6.5h6l-1 3M10.5 6.5 12 4.5l1.5 2'),
 shoulders:P('M4 15c0-5 3.5-8 8-8s8 3 8 8z')+P('M7 15c0-3 2-5 5-5s5 2 5 5'),
 neck:P('M6 7c2 2 4 2.5 6 2.5S16 9 18 7M7 7v4c2 1.5 3.5 2 5 2s3-.5 5-2V7M10 13l-1 6M14 13l1 6')
};
export const DOLL_LAYOUT={helm:[1,0],cape:[0,1],amulet:[1,1],ammo:[2,1],weapon:[0,2],chest:[1,2],shield:[2,2],legs:[1,3],arms:[0,4],boots:[1,4],trinket:[2,4]};
// Chains between slot centres, as [from, to].
const CHAINS=[['helm','amulet'],['cape','amulet'],['amulet','ammo'],['amulet','chest'],['weapon','chest'],['chest','shield'],['chest','legs'],['legs','boots'],['weapon','arms'],['shield','trinket']];
const S=10,G=4,W=3*S+2*G,H=5*S+4*G,centre=([c,r])=>[c*(S+G)+S/2,r*(S+G)+S/2];
export function silhouette(slot){const body=SILHOUETTES[slot];return body?`<svg class="doll-silhouette" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`:''}
function chainSvg(){
 const lines=CHAINS.map(([a,b])=>{const [x1,y1]=centre(DOLL_LAYOUT[a]),[x2,y2]=centre(DOLL_LAYOUT[b]);return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`}).join('');
 return `<svg class="doll-chains" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><g class="chain-base">${lines}</g><g class="chain-links">${lines}</g></svg>`;
}
function emptyIcon(button,slot){const icon=button.querySelector('.item-icon');if(!icon)return;const text=icon.textContent.trim();if(button.dataset.empty==='true'||!icon.querySelector('svg,img')&&(text===''||text==='＋'||text==='+')){icon.innerHTML=silhouette(slot);button.classList.add('doll-empty')}}

// Move every `.equip-slot[data-slot]` in `container` (except the mount) onto the
// doll. `ammo` ({icon,count,title}) fills the ammo slot when given.
export function arrangeEquipmentDoll(container,{ammo=null}={}){
 container.querySelector('.equipment-doll')?.remove();container.querySelector('.equipment-doll-extras')?.remove();
 const doc=container.ownerDocument,doll=doc.createElement('div');doll.className='equipment-doll';doll.setAttribute('role','group');doll.setAttribute('aria-label','Worn equipment');doll.innerHTML=chainSvg();
 const extras=doc.createElement('div');extras.className='equipment-doll-extras';
 const buttons=[...container.querySelectorAll('.equip-slot[data-slot]')].filter(b=>!b.classList.contains('mount-slot'));
 const ammoButton=doc.createElement('button');ammoButton.type='button';ammoButton.className='equip-slot';ammoButton.dataset.slot='ammo';
 const count=Math.max(0,Math.floor(ammo?.count||0));ammoButton.innerHTML='<span class="item-icon" aria-hidden="true">'+(count&&ammo?.icon?ammo.icon:'')+'</span>'+(count?'<small class="doll-count">'+count+'</small>':'')+'<span class="equip-caption">Ammo</span>';
 ammoButton.setAttribute('aria-label','Ammo: '+(count?count+' arrows':'Empty'));ammoButton.title=ammo?.title||(count?count+' arrows · used by bows':'Arrows for bows · buy them from an outfitter or fletch them');ammoButton.onclick=()=>{};if(!count)ammoButton.classList.add('doll-passive');
 buttons.push(ammoButton);
 for(const button of buttons){const slot=button.dataset.slot,place=DOLL_LAYOUT[slot];emptyIcon(button,slot);button.classList.add('doll-slot');
  if(place){button.style.gridColumn=String(place[0]+1);button.style.gridRow=String(place[1]+1);doll.append(button)}else extras.append(button)}
 const first=container.querySelector('.attack-styles')||container.querySelector('.stance-toggle')||container.querySelector('.equipment-combat-stats');
 container.insertBefore(doll,first);if(extras.children.length)container.insertBefore(extras,first);
 return doll;
}

// Stance preference: relaxed by default; combat always engages while fighting.
const STANCE_KEY='eldervale-combat-stance';
export function loadStance(storage=globalThis.localStorage){try{return storage?.getItem(STANCE_KEY)==='combat'?'combat':'relaxed'}catch{return 'relaxed'}}
export function saveStance(value,storage=globalThis.localStorage){const v=value==='combat'?'combat':'relaxed';try{storage?.setItem(STANCE_KEY,v)}catch{}return v}
export function stanceToggle(doc,current,onChange){
 const row=doc.createElement('div');row.className='stance-toggle';row.setAttribute('role','group');row.setAttribute('aria-label','Idle stance');
 for(const [key,label,hint] of [['relaxed','Relaxed stance','Stand at ease; your combat stance engages automatically while fighting.'],['combat','Combat stance','Keep your guard up even out of combat.']]){
  const b=doc.createElement('button');b.type='button';b.textContent=label;b.title=hint;b.dataset.stance=key;const on=current===key;b.setAttribute('aria-pressed',String(on));b.classList.toggle('active',on);b.onclick=()=>onChange(key);row.append(b)}
 return row;
}
