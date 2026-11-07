// Owner console › News: write, publish, pin, order and archive the login screen's
// "What's new in Eldervale" posts. Writes go through world_news_admin (owner-checked
// and audited on the server, db/news-and-login.sql); images go to the public
// `news-images` bucket after being downscaled here to ≤1600 px WebP (JPEG fallback).
import {renderNewsPost,refreshReadMore,NEWS_IMAGE_PREFIX,normalizePost} from './login-news.js?v=release-20261107-ground158';
import {safeHttpsUrl,NEWS_LIMITS,newsPlainText} from './news-markup.js?v=release-20261107-ground158';

export const NEWS_IMAGE=Object.freeze({maxSide:1600,maxBytes:2*1024*1024,maxSourceBytes:20*1024*1024,types:['image/jpeg','image/png','image/webp','image/gif','image/avif']});
export const emptyDraft=()=>({id:null,title:'',body:'',image_url:'',image_alt:'',links:[],published:false,pinned:false,published_at:new Date().toISOString()});

// Scale (w,h) to fit within max×max, never upscaling.
export function fitWithin(width,height,max=NEWS_IMAGE.maxSide){const w=Math.max(1,Math.round(width||1)),h=Math.max(1,Math.round(height||1)),k=Math.min(1,max/Math.max(w,h));return {width:Math.max(1,Math.round(w*k)),height:Math.max(1,Math.round(h*k))}}
export function newsImagePath(date=new Date(),random=Math.random,ext='webp'){const id=Array.from({length:16},()=>Math.floor(random()*36).toString(36)).join('');return 'posts/'+date.toISOString().slice(0,7)+'/'+id+'.'+(ext==='jpeg'?'jpg':ext)}
export function isNewsImageUrl(url){const safe=safeHttpsUrl(url);return !!safe&&safe.startsWith(NEWS_IMAGE_PREFIX)&&/^[A-Za-z0-9._/-]{1,200}$/.test(safe.slice(NEWS_IMAGE_PREFIX.length))}

// Mirrors the server's checks so the owner sees problems before saving.
export function validateNewsDraft(d){
 const errors=[];const title=String(d.title||'').trim();
 if(!title||title.length>NEWS_LIMITS.title)errors.push('Title must be 1–'+NEWS_LIMITS.title+' characters.');
 if(String(d.body||'').length>NEWS_LIMITS.body)errors.push('Body must be at most '+NEWS_LIMITS.body+' characters.');
 if(d.image_url&&!isNewsImageUrl(d.image_url))errors.push('Upload the image here (news-images bucket) instead of linking it.');
 if(String(d.image_alt||'').length>160)errors.push('Image description must be at most 160 characters.');
 const links=(d.links||[]).filter(l=>String(l.label||'').trim()||String(l.url||'').trim());
 if(links.length>NEWS_LIMITS.links)errors.push('Up to three link buttons.');
 links.forEach((l,i)=>{const label=String(l.label||'').trim();if(!label||label.length>NEWS_LIMITS.linkLabel)errors.push('Link '+(i+1)+' needs a 1–'+NEWS_LIMITS.linkLabel+' character label.');if(!safeHttpsUrl(l.url))errors.push('Link '+(i+1)+' must be an https:// address.')});
 const at=new Date(d.published_at);if(!Number.isFinite(at.getTime()))errors.push('Choose a publish date.');
 return errors;
}
// The payload sent to news_save: trimmed, with blank link rows dropped.
export function draftPayload(d){return {id:d.id||undefined,data:{title:String(d.title||'').trim(),body:String(d.body||''),image_url:d.image_url||null,image_alt:String(d.image_alt||'').trim(),links:(d.links||[]).map(l=>({label:String(l.label||'').trim(),url:String(l.url||'').trim()})).filter(l=>l.label||l.url),published:!!d.published,pinned:!!d.pinned,published_at:new Date(d.published_at).toISOString()}}}

// Browser-only: decode, downscale to ≤1600 px and re-encode (WebP, else JPEG) under 2 MB.
export async function prepareNewsImage(file,doc=document){
 if(!file||!NEWS_IMAGE.types.includes(file.type))throw Error('Choose a JPEG, PNG, WebP, GIF or AVIF image.');
 if(file.size>NEWS_IMAGE.maxSourceBytes)throw Error('That image is larger than 20 MB.');
 const bitmap=await createImageBitmap(file).catch(()=>{throw Error('That image could not be read.')});
 try{
  const size=fitWithin(bitmap.width,bitmap.height),canvas=doc.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,size.width,size.height);
  const encode=(type,q)=>new Promise(r=>canvas.toBlob(b=>r(b),type,q));
  for(const q of [.86,.78,.68,.58]){let blob=await encode('image/webp',q);if(!blob||blob.type!=='image/webp')blob=await encode('image/jpeg',q);if(blob&&blob.size<=NEWS_IMAGE.maxBytes)return {blob,...size,ext:blob.type==='image/webp'?'webp':'jpg'}}
  throw Error('That image is still over 2 MB after resizing.');
 }finally{bitmap.close?.()}
}

const localInput=iso=>{const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
const statusOf=p=>p.archived?'Archived':p.published?(new Date(p.published_at)>new Date()?'Scheduled':'Published'):'Draft';

export async function newsEditor(root,{rpc,note=()=>{},storage=null}){
 root.classList.add('news-admin');root.replaceChildren(el('p','Loading news posts…'));
 let posts=[],draft=null,dirty=false,busy=false,showArchived=false;
 const call=async(command,payload={})=>{if(busy)throw Error('Wait for the current change to finish');busy=true;note('Saving '+command.replace('news_','')+'…');try{const r=await rpc('world_news_admin',{command,payload});note('Saved to the server and audited.');return r}catch(e){note(e.message,true);throw e}finally{busy=false}};
 const load=async()=>{posts=await rpc('world_news_admin',{command:'news_list',payload:{}})||[]};
 try{await load()}catch(e){root.replaceChildren(el('p','News is unavailable: '+e.message+' (apply db/news-and-login.sql).'));note(e.message,true);return}
 const select=p=>{draft=p?{...emptyDraft(),...p,links:(p.links||[]).map(l=>({...l}))}:emptyDraft();dirty=false;draw()};
 const confirmLeave=()=>!dirty||confirm('Discard unsaved changes to this post?');
 function draw(){
  if(!root.isConnected)return;root.replaceChildren();
  const layout=el('div',null,{class:'news-admin-layout'}),side=el('section',null,{class:'console-card news-admin-list'}),editor=el('section',null,{class:'console-card news-admin-editor'}),preview=el('section',null,{class:'console-card news-admin-preview'});
  layout.append(side,editor,preview);root.append(layout);
  // ---- list ----
  const head=el('div',null,{class:'news-admin-head'});head.append(el('h3','Posts'));const add=el('button','+ New post',{type:'button'});add.onclick=()=>{if(confirmLeave())select(null)};head.append(add);side.append(head);
  const toggle=el('label',null,{class:'news-admin-check'});const box=el('input',null,{type:'checkbox'});box.checked=showArchived;box.onchange=()=>{showArchived=box.checked;draw()};toggle.append(box,document.createTextNode(' Show archived'));side.append(toggle);
  const visible=posts.filter(p=>showArchived||!p.archived),ordered=posts.filter(p=>!p.archived);
  const list=el('ol',null,{class:'news-admin-rows'});side.append(list);
  if(!visible.length)list.append(el('li','No posts yet — write the first one.',{class:'news-admin-empty'}));
  for(const p of visible){
   const li=el('li',null,{class:'news-admin-row'+(draft?.id===p.id?' selected':'')+(p.archived?' archived':'')}),pick=el('button',null,{type:'button',class:'news-admin-pick'});
   pick.append(el('strong',p.title),el('small',[statusOf(p),p.pinned?'Pinned':'',new Date(p.published_at).toLocaleDateString()].filter(Boolean).join(' · ')));
   pick.onclick=()=>{if(confirmLeave())select(p)};li.append(pick);
   if(!p.archived){const i=ordered.indexOf(p),up=el('button','↑',{type:'button','aria-label':'Move '+p.title+' up'}),down=el('button','↓',{type:'button','aria-label':'Move '+p.title+' down'});up.disabled=i<=0;down.disabled=i>=ordered.length-1;
    const move=d=>async()=>{const ids=ordered.map(x=>x.id);[ids[i],ids[i+d]]=[ids[i+d],ids[i]];posts=await call('news_reorder',{ids});draw()};up.onclick=()=>void move(-1)().catch(()=>{});down.onclick=()=>void move(1)().catch(()=>{});const arrows=el('span',null,{class:'news-admin-move'});arrows.append(up,down);li.append(arrows)}
   list.append(li);
  }
  side.append(el('p','Pinned posts always show first; the arrows set the order of the rest of the login parchment.',{class:'news-admin-hint'}));
  if(!draft)draft=emptyDraft();
  // ---- editor ----
  editor.append(el('h3',draft.id?'Edit post':'New post'));
  const form=el('form',null,{class:'news-admin-form',novalidate:''});editor.append(form);
  const field=(label,input,hint)=>{const l=el('label',label);l.append(input);if(hint)l.append(el('small',hint,{class:'news-admin-hint'}));form.append(l);return input};
  const title=field('Title',el('input',null,{name:'title',maxlength:String(NEWS_LIMITS.title),required:''}));title.value=draft.title;
  const when=field('Publish date',el('input',null,{name:'published_at',type:'datetime-local'}),'A future date schedules the post: it stays hidden until then.');when.value=localInput(draft.published_at);
  const body=field('Body',el('textarea',null,{name:'body',rows:'9',maxlength:String(NEWS_LIMITS.body)}),'Blank line = new paragraph · **bold** · *italic* · "- " starts a bullet · [label](https://link)');body.value=draft.body;
  const counter=el('small','',{class:'news-admin-count'});form.append(counter);
  // image
  const imageBox=el('fieldset',null,{class:'news-admin-image'});imageBox.append(el('legend','Image (optional)'));form.append(imageBox);
  const thumb=el('div',null,{class:'news-admin-thumb'});const file=el('input',null,{type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,image/avif','aria-label':'Upload image'});
  const removeImage=el('button','Remove image',{type:'button'});const alt=el('input',null,{name:'image_alt',maxlength:'160',placeholder:'Describe the image for screen readers'});alt.value=draft.image_alt||'';
  const imageStatus=el('small','',{class:'news-admin-hint',role:'status'});
  const showThumb=()=>{thumb.replaceChildren();if(draft.image_url){const img=el('img',null,{alt:''});img.src=draft.image_url;thumb.append(img)}else thumb.append(el('span','No image'));removeImage.hidden=!draft.image_url};showThumb();
  const altLabel=el('label','Image description');altLabel.append(alt);imageBox.append(thumb,file,removeImage,altLabel,imageStatus);
  if(!storage){file.disabled=true;imageStatus.textContent='Image upload is unavailable in this session.'}
  file.onchange=async()=>{const f=file.files?.[0];if(!f||!storage)return;file.disabled=true;imageStatus.textContent='Resizing…';try{const prepared=await prepareNewsImage(f);imageStatus.textContent='Uploading '+Math.round(prepared.blob.size/1024)+' KB ('+prepared.width+'×'+prepared.height+')…';const path=newsImagePath(new Date(),Math.random,prepared.ext);const bucket=storage.from('news-images');const up=await bucket.upload(path,prepared.blob,{contentType:prepared.blob.type,cacheControl:'31536000',upsert:false});if(up.error)throw up.error;const url=bucket.getPublicUrl(path).data.publicUrl;if(!isNewsImageUrl(url))throw Error('Unexpected image address');draft.image_url=url;if(!draft.image_alt){draft.image_alt=draft.title;alt.value=draft.title}dirty=true;showThumb();update();imageStatus.textContent='Image uploaded — save the post to keep it.'}catch(e){imageStatus.textContent=e.message;note(e.message,true)}finally{file.disabled=false;file.value=''}};
  removeImage.onclick=()=>{draft.image_url='';dirty=true;showThumb();update()};
  // links
  const linkBox=el('fieldset',null,{class:'news-admin-links'});linkBox.append(el('legend','Link buttons (optional, up to 3, https only)'));form.append(linkBox);
  const linkInputs=[0,1,2].map(i=>{const row=el('div',null,{class:'news-admin-link-row'}),label=el('input',null,{placeholder:'Button label',maxlength:String(NEWS_LIMITS.linkLabel),'aria-label':'Link '+(i+1)+' label'}),url=el('input',null,{type:'url',placeholder:'https://…',maxlength:String(NEWS_LIMITS.url),'aria-label':'Link '+(i+1)+' address'});label.value=draft.links[i]?.label||'';url.value=draft.links[i]?.url||'';row.append(label,url);linkBox.append(row);return {label,url}});
  // flags
  const flags=el('div',null,{class:'news-admin-flags'});const flag=(name,text)=>{const l=el('label',null,{class:'news-admin-check'}),c=el('input',null,{type:'checkbox',name});c.checked=!!draft[name];l.append(c,document.createTextNode(' '+text));flags.append(l);return c};
  const published=flag('published','Published (visible on the login screen)'),pinned=flag('pinned','Pinned to the top');form.append(flags);
  const errors=el('ul',null,{class:'news-admin-errors',role:'alert'});form.append(errors);
  const actions=el('div',null,{class:'studio-actions'});form.append(actions);
  const save=el('button',draft.id?'Save changes':'Save post',{type:'submit'});actions.append(save);
  const quick=(label,command,cls)=>{const b=el('button',label,{type:'button'});if(cls)b.className=cls;b.onclick=async()=>{try{if(dirty&&confirm('Save your edits to this post first? Cancel applies the change without them.'))await submit();await doQuick()}catch{}};async function doQuick(){try{const row=await call(command,{id:draft.id});await load();select(row)}catch{}}actions.append(b);return b};
  if(draft.id){const row=posts.find(p=>p.id===draft.id)||draft;
   if(!row.archived){quick(row.published?'Unpublish':'Publish now',row.published?'news_unpublish':'news_publish');quick(row.pinned?'Unpin':'Pin',row.pinned?'news_unpin':'news_pin');quick('Archive','news_archive','danger')}
   else quick('Restore from archive','news_restore')}
  // ---- preview ----
  preview.append(el('h3','Login preview'));
  const parchment=el('div',null,{class:'login-news news-parchment news-preview'}),phead=el('div',null,{class:'news-head'});phead.append(el('span','What’s new in Eldervale',{class:'news-heading'}));const plist=el('div',null,{class:'news-list'});parchment.append(phead,plist);preview.append(parchment);
  preview.append(el('p','Exactly as players will see it beside the sign-in card. Other published posts appear below this one.',{class:'news-admin-hint'}));
  function read(){draft.title=title.value;draft.body=body.value;draft.image_alt=alt.value;draft.published=published.checked;draft.pinned=pinned.checked;const at=new Date(when.value);if(Number.isFinite(at.getTime()))draft.published_at=at.toISOString();draft.links=linkInputs.map(l=>({label:l.label.value,url:l.url.value})).filter(l=>l.label.trim()||l.url.trim())}
  function update(){read();counter.textContent=draft.body.length+' / '+NEWS_LIMITS.body+' characters · '+newsPlainText(draft.body).split(' ').filter(Boolean).length+' words';
   const problems=validateNewsDraft(draft);errors.replaceChildren(...problems.map(p=>el('li',p)));save.disabled=busy;
   const shown=normalizePost({...draft,title:draft.title.trim()||'Untitled post',imageUrl:draft.image_url,imageAlt:draft.image_alt});plist.replaceChildren(renderNewsPost(shown||{},{expanded:false}));requestAnimationFrame(()=>refreshReadMore(plist))}
  form.oninput=()=>{dirty=true;update()};form.onchange=form.oninput;
  async function submit(){read();const problems=validateNewsDraft(draft);if(problems.length){update();throw Error(problems[0])}const row=await call('news_save',draftPayload(draft));await load();dirty=false;select(row);return row}
  form.onsubmit=e=>{e.preventDefault();void submit().catch(()=>{})};
  update();
 }
 select(posts.find(p=>!p.archived)||null);
 return {reload:async()=>{await load();draw()}};
}
