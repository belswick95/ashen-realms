// Game console → World → Tick & tile engine (db/tick-tile-engine-*.sql): view and change the
// engine settings, rebuild the collision grid, and show the tile grid around you.
export const ENGINE_TOGGLES=[
 ['tile_mode','Tile movement: 600 ms ticks on 1.58-unit tiles (walk 1, run 2 tiles per tick)'],
 ['run_default','Players start running when they first walk on tiles'],
 ['corner_cutting','Allow cutting corners diagonally (OSRS does not)'],
];
export const ENGINE_NUMBERS=[
 ['path_radius','Path search radius (tiles)',8,64],
 ['alt_radius','Blocked click: walk to the nearest tile within (tiles)',0,32],
 ['grid_check_ticks','Check world edits for the grid every (ticks; 0 = only on rebuild)',0,1000],
 ['talk_face_ticks','NPCs face a talker for (ticks)',1,100],
 ['max_catchup_ticks','Ticks caught up after a slow tick (at most)',1,5],
];
export const ENGINE_DRIVERS=[['inline','Inline: cron each second + every player request runs the tick'],['loop','600 ms loop (tick-tile-engine-5-cadence.sql); requests only queue intents']];
// The settings form → the console_engine_set payload (numbers validated like the server does).
export function engineSettings(values){
 const config={};
 for(const [k] of ENGINE_TOGGLES)if(k in values)config[k]=values[k]===true;
 for(const [k,,min,max] of ENGINE_NUMBERS)if(k in values){const v=Number(values[k]);if(!Number.isInteger(v)||v<min||v>max)throw Error('Choose a whole number from '+min+' to '+max+' for '+k.replace(/_/g,' '));config[k]=v}
 if('tick_driver' in values){if(!ENGINE_DRIVERS.some(([k])=>k===values.tick_driver))throw Error('Unknown tick driver');config.tick_driver=values.tick_driver}
 return config;
}
export function engineSummary(r){
 const st=r?.state||{},t=r?.tiles||{},bits=[];
 bits.push(r?.config?.tile_mode?'Tile movement is ON.':'Tile movement is off (free movement).');
 bits.push((t.rows??0)+' grid tiles ('+(t.blocked??0)+' blocked, '+(t.doors??0)+' at doors) from '+(r?.sources??0)+' objects');
 if(st.grid_built_at)bits.push('last full build '+new Date(st.grid_built_at).toLocaleString()+' in '+st.grid_ms+' ms');
 if(st.tick_ms!=null)bits.push('last tick '+st.tick_ms+' ms (avg '+(st.tick_avg_ms??'—')+' ms)');
 if(st.loop_at)bits.push('600 ms loop seen '+new Date(st.loop_at).toLocaleTimeString());
 return bits.join(' · ');
}
export function engineSection({section,el,btn,field,invoke,note,parent,overlay=()=>window.eldervaleTileOverlay}){
 const s=section('Tick & tile engine',parent),status=el('p','Loading engine settings…',{class:'console-muted'});s.append(status);
 const form=el('form');form.onsubmit=e=>e.preventDefault();s.append(form);
 async function load(){
  let r;try{r=await invoke('console_engine',{})}catch(e){status.textContent=/unknown (console )?command/i.test(e.message)?'The tick & tile engine is not installed on this server yet.':e.message;form.replaceChildren();return}
  status.textContent=engineSummary(r);form.replaceChildren();const c=r.config||{},inputs={};
  for(const [k,label] of ENGINE_TOGGLES){const l=el('label',null,{class:'console-check'}),box=el('input',null,{type:'checkbox'});box.checked=c[k]===true;l.append(box,document.createTextNode(' '+label));form.append(l);inputs[k]=box}
  const grid=el('div',null,{class:'console-form-grid'});form.append(grid);
  for(const [k,label,min,max] of ENGINE_NUMBERS){const n=field(grid,label,'engine_'+k,c[k]??'','number');n.min=min;n.max=max;n.step=1;inputs[k]=n}
  inputs.tick_driver=field(grid,'Tick driver','engine_tick_driver',c.tick_driver||'inline','text',ENGINE_DRIVERS);
  btn('Save engine settings',async()=>{const values={};for(const [k,input] of Object.entries(inputs))values[k]=input.type==='checkbox'?input.checked:input.value;await invoke('console_engine_set',{config:engineSettings(values)});note('Engine settings saved.');await load()},form);
  btn('Rebuild collision grid',async()=>{const b=await invoke('console_tiles_rebuild',{});note('Grid rebuilt: '+b.tiles+' tiles in '+b.ms+' ms.');await load()},form);
  const o=overlay();
  if(o)btn(o.enabled?'Hide tile grid':'Show tile grid around me',()=>{const on=o.toggle(payload=>invoke('console_tiles_view',payload));note(on?'Tile grid shown: red = blocked, blue = water, orange = wall edge, yellow = door.':'Tile grid hidden.');void load()},form);
 }
 void load();
 return {reload:load};
}
