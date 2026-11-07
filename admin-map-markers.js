// Owner console › World › Map markers: every marker the world map and minimap draw (mines, trees,
// fishing, stations, shops, caves, lairs, dragons, training areas, shortcuts, boats), each with a
// show/hide box and a rename field, plus the owner's own markers ("Add marker at my position").
// The overrides are one small JSON document, {hidden:[ids], names:{id:name}, custom:[{id,cat,
// name,x,z,note}]}, stored in game_settings 'map_markers' and published to every client in
// gameConfig.mapMarkers (db/map-icons.sql: map_markers_get / map_markers_save, owner-checked and
// audited). "Preview" applies the draft on this screen only.
import {MARKER_CATS,MARKER_GROUPS,markerLabel,drawMarkerIcon,OVERWORLD} from './map-icons.js?v=release-20261107-mapicons133';

export const MARKER_LIMITS={custom:60,names:300,hidden:600,name:60,note:120};
// The overrides document from the console's draft: trimmed names, known kinds, bounded sizes.
// Throws a readable message for anything the server would refuse.
export function markerOverrides({hidden=[],names={},custom=[]}={}){
 const idOk=v=>typeof v==='string'&&/^[a-z]{3,12}:-?\d{1,4}:-?\d{1,4}$/.test(v);
 const h=[...new Set(hidden)].filter(idOk);if(h.length>MARKER_LIMITS.hidden)throw Error('At most '+MARKER_LIMITS.hidden+' hidden markers');
 const n={};for(const [id,v] of Object.entries(names||{})){const t=String(v??'').trim();if(!t||!idOk(id))continue;if(t.length>MARKER_LIMITS.name)throw Error('Marker names: at most '+MARKER_LIMITS.name+' characters');n[id]=t}
 if(Object.keys(n).length>MARKER_LIMITS.names)throw Error('At most '+MARKER_LIMITS.names+' renamed markers');
 if(custom.length>MARKER_LIMITS.custom)throw Error('At most '+MARKER_LIMITS.custom+' custom markers');
 const c=custom.map(m=>{const x=Math.round(Number(m.x)*10)/10,z=Math.round(Number(m.z)*10)/10,name=String(m.name||'').trim(),note=String(m.note||'').trim();
  if(!MARKER_CATS[m.cat])throw Error('Choose a kind for '+(name||'the custom marker'));if(!name||name.length>MARKER_LIMITS.name)throw Error('Custom marker names: 1–'+MARKER_LIMITS.name+' characters');
  if(note.length>MARKER_LIMITS.note)throw Error('Notes: at most '+MARKER_LIMITS.note+' characters');if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>OVERWORLD||Math.abs(z)>OVERWORLD)throw Error(name+': stand in the overworld (x and z within ±'+OVERWORLD+')');
  return {id:'custom:'+Math.round(x)+':'+Math.round(z),cat:m.cat,name,x,z,...(note?{note}:{})}});
 const seen=new Set();for(const m of c){if(seen.has(m.id))throw Error('Two custom markers on the same spot: move one a little');seen.add(m.id)}
 return {hidden:h,names:n,custom:c};
}

export function createMapMarkersTab(ctx){
 const {el,btn,field,invoke,note}=ctx;
 let draft=null,filter='',kind='';
 const api=()=>window.eldervaleMapMarkers;
 const saved=()=>{const c=window.eldervaleGameConfig?.mapMarkers;return {hidden:[...(c?.hidden||[])],names:{...(c?.names||{})},custom:(c?.custom||[]).map(m=>({...m}))}};
 const icon=(cat,tint)=>{const c=el('canvas',null,{width:'36',height:'36',style:'width:18px;height:18px;vertical-align:middle;margin-right:6px'});const g=c.getContext('2d');if(g){g.scale(2,2);drawMarkerIcon(g,cat,9,9,16,{tint})}return c};
 const section=(title,parent)=>{const s=el('section',null,{class:'console-card'});s.append(el('h3',title));parent.append(s);return s};
 const kinds=[['','All kinds'],...MARKER_GROUPS.flatMap(([g,label])=>Object.entries(MARKER_CATS).filter(([,d])=>d.group===g).map(([k,d])=>[k,label+' · '+d.label]))];
 function preview(){try{api()?.preview(markerOverrides(draft));note('Previewing on your map only. Save to show everyone.')}catch(e){note(e.message,true)}}
 async function save(){const doc=markerOverrides(draft);await invoke('map_markers_save',doc);window.eldervaleGameConfig={...(window.eldervaleGameConfig||{}),mapMarkers:doc};api()?.preview(null);note('Map markers saved for everyone ('+doc.hidden.length+' hidden, '+Object.keys(doc.names).length+' renamed, '+doc.custom.length+' custom).')}
 function Markers(){
  const W=ctx.workspace;if(!draft)draft=saved();
  W.append(el('p','Every icon on the world map and minimap. Untick to hide one for everyone, type a new name to rename it, or add your own marker where you stand. Preview shows the change on your screen; Save publishes it.',{class:'console-muted'}));
  if(!api()){W.append(el('p','The map markers are not loaded yet. Open the world map once, then come back.'));return}
  const bar=el('div',null,{class:'studio-actions console-primary-actions'});W.append(bar);
  btn('Preview on my map',preview,bar);btn('Save for everyone',async()=>{await save();ctx.redraw()},bar);btn('Discard changes',()=>{draft=saved();api()?.preview(null);ctx.redraw()},bar);
  // Custom markers.
  const cs=section('Your markers ('+draft.custom.length+'/'+MARKER_LIMITS.custom+')',W);
  const add=el('div',null,{class:'studio-grid'});cs.append(add);
  const k=field(add,'Kind','newCat','custom','text',Object.entries(MARKER_CATS).map(([key,d])=>[key,d.label])),nm=field(add,'Name','newName',''),nt=field(add,'Note (optional)','newNote','');nm.maxLength=MARKER_LIMITS.name;nt.maxLength=MARKER_LIMITS.note;
  btn('Add marker at my position',()=>{const p=ctx.bridge?.position?.();if(!p)throw Error('Your position is not known yet');if(!nm.value.trim())throw Error('Give the marker a name');
   const next={cat:k.value,name:nm.value.trim(),note:nt.value.trim(),x:p.x,z:p.z};markerOverrides({custom:[...draft.custom,next]});draft.custom.push(next);preview();ctx.redraw()},cs);
  const cl=el('div',null,{class:'studio-entity-list'});cs.append(cl);
  draft.custom.forEach((m,i)=>{const row=el('div',null,{class:'studio-actions'});row.append(icon(m.cat));const n=el('input',null,{value:m.name,'aria-label':'Marker name',maxlength:String(MARKER_LIMITS.name)});n.oninput=()=>{m.name=n.value};row.append(n,el('span',' '+Number(m.x).toFixed(0)+', '+Number(m.z).toFixed(0)+' · '+MARKER_CATS[m.cat]?.label+' '));btn('Remove',()=>{draft.custom.splice(i,1);preview();ctx.redraw()},row);cl.append(row)});
  if(!draft.custom.length)cl.append(el('p','No custom markers yet.',{class:'console-muted'}));
  // Every generated marker.
  const ms=section('Markers on the map',W);const tools=el('div',null,{class:'studio-grid'});ms.append(tools);
  const f=field(tools,'Filter','markerFilter',filter);f.type='search';f.oninput=()=>{filter=f.value;list()};const kk=field(tools,'Kind','markerKind',kind,'text',kinds);kk.onchange=()=>{kind=kk.value;list()};
  const box=el('div',null,{class:'studio-entity-list'});ms.append(box);
  function list(){box.replaceChildren();const hidden=new Set(draft.hidden),q=filter.trim().toLowerCase();let shown=0;
   for(const c of api().base()){if(kind&&c.cat!==kind)continue;const label=markerLabel(c);if(q&&!(label+' '+MARKER_CATS[c.cat].label).toLowerCase().includes(q))continue;if(++shown>250)break;
    const row=el('div',null,{class:'studio-actions',title:label});const on=el('input',null,{type:'checkbox','aria-label':'Show '+c.name});on.checked=!hidden.has(c.id);
    on.onchange=()=>{draft.hidden=draft.hidden.filter(id=>id!==c.id);if(!on.checked)draft.hidden.push(c.id)};
    const n=el('input',null,{value:draft.names[c.id]||'',placeholder:c.name,'aria-label':'Rename '+c.name,maxlength:String(MARKER_LIMITS.name)});n.oninput=()=>{if(n.value.trim())draft.names[c.id]=n.value;else delete draft.names[c.id]};
    const lab=el('label',null);lab.append(on,icon(c.cat,c.tierColor||null));row.append(lab,n,el('small',' '+MARKER_CATS[c.cat].label+' · '+Math.round(c.x)+', '+Math.round(c.z)+(c.count>1?' · '+c.count+' nodes':'')));box.append(row)}
   if(!shown)box.append(el('p','No markers match.',{class:'console-muted'}));if(shown>250)box.append(el('p','Showing the first 250; narrow the filter.',{class:'console-muted'}))}
  list();
 }
 return {'Map markers':Markers};
}
