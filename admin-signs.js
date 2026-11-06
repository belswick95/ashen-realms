// Owner console › Build › Signs: edit every building sign and town signpost (text, icon, style,
// paint, on/off; position and arms for signposts) and place new signposts. Reads the signs the
// game is showing (window.eldervaleBuildingSigns) and the stored overrides (sign_list); writes go
// through ctx.invoke -> world_admin, owner-checked and audited (db/building-signs.sql).
import {SIGN_ICONS,SIGN_STYLES,SIGN_PAINTS,drawSignIcon,cleanSign} from './building-signs.js?v=release-20261106-ui94';

export const signFormData=(read)=>{const d={text:read.text.trim(),icon:read.icon,style:read.style,paint:read.paint,enabled:!!read.enabled};
 if(read.style==='post'){for(const k of ['x','z'])if(Number.isFinite(Number(read[k]))&&read[k]!=='')d[k]=Math.round(Number(read[k])*100)/100;
  d.arms=(read.arms||[]).filter(a=>a.text.trim()).slice(0,3).map(a=>({text:a.text.trim().slice(0,28),icon:a.icon||'none',toX:Number(a.toX)||0,toZ:Number(a.toZ)||0}));
  if(read.name)d.name=read.name.trim().slice(0,60)}
 return d};

export function createSignTabs(ctx){
 const {el,btn,field,invoke,note}=ctx;
 const W=()=>ctx.workspace;let filter='',selected=null,stored={};
 const live=()=>window.eldervaleBuildingSigns;
 function iconPreview(icon){const c=el('canvas',null,{width:'40',height:'40',class:'sign-icon-preview','aria-hidden':'true'});const g=c.getContext?.('2d');if(g&&icon&&icon!=='none'){drawSignIcon(g,icon,3,3,34)}return c}
 async function load(){try{const r=await ctx.rpc('world_admin',{command:'sign_list',payload:{}});stored=r||{}}catch(e){stored={};note('Sign overrides unavailable: '+e.message+' (apply db/building-signs.sql)',true)}}
 const applyLive=()=>live()?.setOverrides(Object.fromEntries(Object.entries(stored).map(([id,v])=>[id,v.data||{}])));
 async function save(id,data){const r=await invoke('sign_save',{id,data});stored[id]={data:r.data};applyLive();note('Sign saved: everyone sees it on their next world load.');draw()}
 async function reset(id){await invoke('sign_reset',{id});stored[id]={data:{}};applyLive();note('Sign back to its default.');draw()}
 function form(row){
  const box=el('section',null,{class:'console-card sign-editor'}),s=row.sign;box.append(el('h3',row.name||row.id),el('p',(row.kind==='post'?'Signpost':'Building sign')+' · '+row.id,{class:'console-muted'}));
  const text=field(box,'Text','text',s.text||''),icon=field(box,'Icon','icon',s.icon||'none','text',[['none','No icon'],...SIGN_ICONS.map(i=>[i,i[0].toUpperCase()+i.slice(1)])]);
  const preview=el('div',null,{class:'sign-icon-row'});preview.append(iconPreview(s.icon));box.append(preview);icon.onchange=()=>preview.replaceChildren(iconPreview(icon.value));
  const style=field(box,'Style','style',s.style,'text',(row.kind==='post'?['post']:SIGN_STYLES.filter(x=>x!=='post')).map(x=>[x,{hanging:'Hanging board on an iron bracket',plaque:'Wall plaque',post:'Signpost'}[x]]));
  const paint=field(box,'Paint','paint',s.paint||'green','text',Object.keys(SIGN_PAINTS).map(p=>[p,p[0].toUpperCase()+p.slice(1)]));
  const enabled=field(box,'Shown in the world','enabled',s.enabled!==false,'checkbox');
  let x,z,name;const arms=[];
  if(row.kind==='post'){name=field(box,'Console name','name',row.name||'');x=field(box,'X','x',row.x,'number');z=field(box,'Z','z',row.z,'number');x.step=z.step='0.1';
   btn('Use my position',()=>{const p=ctx.bridge?.position?.();if(p){x.value=p.x.toFixed(1);z.value=p.z.toFixed(1)}},box);
   const list=(s.arms||[]).concat([{},{},{}]).slice(0,3);box.append(el('h4','Arms (point at a place)'));
   list.forEach((a,i)=>{const r=el('div',null,{class:'studio-recipe-parts'});const t=field(r,'Arm '+(i+1)+' text','arm'+i,a.text||''),ic=field(r,'Icon','armicon'+i,a.icon||'none','text',[['none','No icon'],...SIGN_ICONS.map(k=>[k,k])]),tx=field(r,'Towards X','armx'+i,a.toX??'','number'),tz=field(r,'Towards Z','armz'+i,a.toZ??'','number');
    btn('Point at my position',()=>{const p=ctx.bridge?.position?.();if(p){tx.value=p.x.toFixed(1);tz.value=p.z.toFixed(1)}},r);arms.push({t,ic,tx,tz});box.append(r)})}
  const read=()=>signFormData({text:text.value,icon:icon.value,style:style.value,paint:paint.value,enabled:enabled.checked,x:x?.value,z:z?.value,name:name?.value,arms:arms.map(a=>({text:a.t.value,icon:a.ic.value,toX:a.tx.value,toZ:a.tz.value}))});
  const actions=el('div',null,{class:'studio-actions'});box.append(actions);
  btn('Preview in world',()=>{const rows=Object.fromEntries(Object.entries(stored).map(([id,v])=>[id,v.data||{}]));rows[row.id]=read();live()?.setOverrides(rows);note('Previewing on this screen only. Save to keep it.')},actions);
  btn('Save sign',()=>save(row.id,read()),actions);
  btn('Reset to default',()=>reset(row.id),actions);
  btn('Back to list',()=>{selected=null;applyLive();draw()},actions);
  return box;
 }
 function draw(){
  const root=W();root.replaceChildren();
  const rows=live()?.list?.()||[];
  if(selected){const row=rows.find(r=>r.id===selected)||(stored[selected]?{id:selected,kind:'post',name:stored[selected].data.name,sign:cleanSign(stored[selected].data,{text:'',icon:'none',style:'post',paint:'oak',enabled:true}),x:stored[selected].data.x,z:stored[selected].data.z}:null);if(row){root.append(form(row));return}selected=null}
  const head=el('section',null,{class:'console-card'});head.append(el('h3','Building signs & signposts'),el('p','Hanging boards and plaques follow each building’s name and trade; signposts stand at town gates. Pick one to change its text, icon, style or turn it off.'));
  const search=el('input',null,{type:'search',class:'console-search',placeholder:'Find a sign…','aria-label':'Find a sign'});search.value=filter;search.oninput=()=>{filter=search.value;drawList()};head.append(search);
  const acts=el('div',null,{class:'studio-actions'});head.append(acts);
  btn('New signpost here',()=>{const p=ctx.bridge?.position?.()||{x:0,z:0},id='post:custom-'+Date.now().toString(36);stored[id]={data:{name:'New signpost',text:'Signpost',icon:'none',x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10,arms:[{text:'Signpost',icon:'none',toX:Math.round(p.x+10),toZ:Math.round(p.z)}]}};applyLive();selected=id;draw()},acts);
  btn('Reload',async()=>{await load();applyLive();draw()},acts);
  root.append(head);const list=el('section',null,{class:'console-card sign-list'});root.append(list);
  function drawList(){list.replaceChildren();const q=filter.trim().toLowerCase();const shown=rows.filter(r=>!q||(r.name+' '+r.sign.text+' '+r.id).toLowerCase().includes(q));
   if(!shown.length){list.append(el('p',rows.length?'No signs match.':'Signs appear here once the world has loaded around you.'));return}
   for(const r of shown.slice(0,200)){const b=el('button',null,{type:'button',class:'sign-row'});b.append(iconPreview(r.sign.icon),el('span',(r.sign.enabled?'':'○ ')+(r.name||r.id)),el('small',r.sign.style+(stored[r.id]&&Object.keys(stored[r.id].data||{}).length?' · edited':'')));b.onclick=()=>{selected=r.id;draw()};list.append(b)}}
  drawList();
 }
 return {Signs:()=>{draw();void load().then(()=>{if(ctx.tab()==='Signs'&&!selected)draw()})}};
}
