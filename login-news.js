// "What's new in Eldervale" parchment and the "Adventurers online" count on the
// login screen. Both come from read-only, security-definer RPCs that anonymous
// visitors may call (db/news-and-login.sql); nothing here needs a signed-in user.
import {renderNewsMarkup,safeHttpsUrl,newsPlainText,NEWS_LIMITS} from './news-markup.js?v=release-20261106-walk117';

export const SUPABASE_URL='https://aojccnhmvxurrnnzteej.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_pfcppa_7V_9lvHsL1aAM8Q_px5bXnY8';
export const NEWS_IMAGE_PREFIX=SUPABASE_URL+'/storage/v1/object/public/news-images/';

// Shown until db/news-and-login.sql is applied (or while the RPC is unreachable).
// Identical to the two starter rows the SQL seeds.
export const STARTER_NEWS=Object.freeze([
 {id:'5e1d0000-0000-4000-8000-000000000001',title:'Castle Training opens its gates to new adventurers',publishedAt:'2026-11-05T09:00:00Z',pinned:true,imageUrl:null,links:[],
  body:`Every new adventurer now begins inside **Eldervale Castle**, where King Oswin the Steadfast and his instructors teach the ways of the Heartlands before you set out.

- Eight short training quests: the *Arms Drill*, *Timber and Flame*, *Nets at the Pond*, *Supper at the Range*, *Ore and Anvil*, *Coins and Vaults* and more
- Follow your progress in the new **Quests** tab — grey for not started, yellow in progress, green once complete
- Every finished lesson pays out experience and useful starter kit, celebrated with a quest scroll

Complete your training and pass *Through the Great Gate* into the wider world. Seasoned adventurers are welcome to visit the castle for a refresher.`},
 {id:'5e1d0000-0000-4000-8000-000000000002',title:'Birchford crowned the Royal Capital',publishedAt:'2026-11-04T09:00:00Z',pinned:false,imageUrl:null,links:[],
  body:`Birchford has grown into the walled **Royal Capital of Eldervale**.

- A stone curtain wall with towers, wardens and four gates on the great roads
- The **Grand Market**: eight stalls of traders around the old square, plus new shops, two banks and the Gilded Antler inn
- The **Warriors' Guild** and the **Crafters' Guild & Smithy**, with furnace, anvil, workbench and spinning wheel
- **Birchford Keep**, seat of Queen Aelith, watched over by the Royal Guard

Walk its paved streets by lamplight — the town square, bank and lodge you know are still at its heart.`}
]);

const asDate=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d:null};
export function formatNewsDate(value,locale){const d=asDate(value);if(!d)return '';try{return d.toLocaleDateString(locale||undefined,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}catch{return d.toISOString().slice(0,10)}}

// Server rows are untrusted input for rendering: clamp lengths, vet every URL.
export function normalizePost(raw){
 if(!raw||typeof raw!=='object')return null;const title=String(raw.title??'').trim().slice(0,NEWS_LIMITS.title);if(!title)return null;
 const links=(Array.isArray(raw.links)?raw.links:[]).slice(0,NEWS_LIMITS.links).map(l=>({label:String(l?.label??'').trim().slice(0,NEWS_LIMITS.linkLabel),url:safeHttpsUrl(l?.url)})).filter(l=>l.label&&l.url);
 return {id:String(raw.id??title),title,body:String(raw.body??'').slice(0,NEWS_LIMITS.body),imageUrl:safeHttpsUrl(raw.imageUrl??raw.image_url),imageAlt:String(raw.imageAlt??raw.image_alt??'').slice(0,160),links,publishedAt:raw.publishedAt??raw.published_at??null,pinned:!!raw.pinned,sortOrder:Number(raw.sortOrder??raw.sort_order)||0};
}
// Pinned first, then the owner's manual order, then newest.
export function sortPosts(posts){return [...posts].sort((a,b)=>(b.pinned-a.pinned)||(a.sortOrder-b.sortOrder)||((asDate(b.publishedAt)?.getTime()||0)-(asDate(a.publishedAt)?.getTime()||0)))}

async function rpc(name,args,{fetchImpl=globalThis.fetch,signal}={}){
 const response=await fetchImpl(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args||{}),signal});
 if(!response.ok)throw Error(name+' '+response.status);return response.json();
}
export async function fetchNews(options={}){const rows=await rpc('eldervale_news',{max_posts:options.limit||8},options);return sortPosts((Array.isArray(rows)?rows:[]).map(normalizePost).filter(Boolean))}
export async function fetchOnlineCount(options={}){const n=Number(await rpc('eldervale_online_count',{},options));return Number.isFinite(n)&&n>=0?Math.floor(n):null}

const make=(doc,tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
// One post as an <article>. Used by the login parchment and the admin live preview.
export function renderNewsPost(post,{doc=globalThis.document,expanded=false}={}){
 const p=normalizePost(post);const article=make(doc,'article','news-post'+(p?.pinned?' pinned':''));if(!p)return article;
 article.dataset.postId=p.id;
 const head=make(doc,'header','news-post-head');
 if(p.pinned)head.append(make(doc,'span','news-pin','Pinned'));
 const date=formatNewsDate(p.publishedAt);if(date){const t=make(doc,'time','news-date',date);const d=asDate(p.publishedAt);if(d)t.dateTime=d.toISOString();head.append(t)}
 const title=make(doc,'h3','news-title',p.title);article.append(head,title);
 if(p.imageUrl){const figure=make(doc,'figure','news-figure'),img=doc.createElement('img');img.src=p.imageUrl;img.alt=p.imageAlt||'';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.addEventListener?.('error',()=>figure.remove());figure.append(img);article.append(figure)}
 const body=make(doc,'div','news-body'+(expanded?' expanded':''));body.append(renderNewsMarkup(p.body,doc));article.append(body);
 const more=make(doc,'button','news-more','Read more');more.type='button';more.hidden=true;more.setAttribute('aria-expanded',String(expanded));
 more.addEventListener?.('click',()=>{const open=!body.classList.contains('expanded');body.classList.toggle('expanded',open);more.textContent=open?'Show less':'Read more';more.setAttribute('aria-expanded',String(open));if(!open)article.scrollIntoView?.({block:'nearest'})});
 article.append(more);
 if(p.links.length){const row=make(doc,'div','news-links');for(const l of p.links){const a=make(doc,'a','news-link',l.label);a.href=l.url;a.target='_blank';a.rel='noopener noreferrer nofollow';row.append(a)}article.append(row)}
 return article;
}
// "Read more" only appears on bodies that are actually clipped.
export function refreshReadMore(root){for(const article of root.querySelectorAll('.news-post')){const body=article.querySelector('.news-body'),more=article.querySelector('.news-more');if(!body||!more)continue;more.hidden=!body.classList.contains('expanded')&&body.scrollHeight<=body.clientHeight+4}}

export function renderNewsList(list,posts,{doc=globalThis.document}={}){
 list.replaceChildren();const shown=sortPosts(posts.map(normalizePost).filter(Boolean));
 if(!shown.length){list.append(make(doc,'p','news-empty','No news from the realm just yet.'));return 0}
 for(const post of shown)list.append(renderNewsPost(post,{doc}));
 return shown.length;
}

// Wires the login parchment and online counter; polling pauses while the login is hidden. Returns {stop}.
export function startLoginNews({screen=document.querySelector('#auth-screen'),news=document.querySelector('#login-news'),online=document.querySelector('#login-online')}={}){
 const list=news?.querySelector('.news-list');let stopped=false,timer=0,controller=null;
 const fitReadMore=()=>{if(list)requestAnimationFrame(()=>refreshReadMore(list))};
 if(list){renderNewsList(list,STARTER_NEWS);fitReadMore();news.setAttribute('aria-busy','true');
  fetchNews().then(posts=>{if(!stopped&&posts.length){renderNewsList(list,posts);fitReadMore()}}).catch(()=>{}).finally(()=>news.removeAttribute('aria-busy'))}
 const showCount=n=>{if(!online)return;const value=online.querySelector('.online-count');if(n===null){online.hidden=true;return}if(value)value.textContent=n.toLocaleString();online.hidden=false;online.setAttribute('aria-label',n===1?'1 adventurer online':n.toLocaleString()+' adventurers online')};
 async function poll(){if(stopped)return;clearTimeout(timer);if(!screen?.hidden&&!document.hidden){controller?.abort?.();controller=typeof AbortController==='function'?new AbortController():null;try{showCount(await fetchOnlineCount({signal:controller?.signal}))}catch(e){if(e?.name!=='AbortError')showCount(null)}}timer=setTimeout(poll,60000)}
 void poll();
 const onResize=()=>fitReadMore();addEventListener('resize',onResize);
 const onVisible=()=>{if(!document.hidden&&!screen?.hidden)void poll()};document.addEventListener('visibilitychange',onVisible);
 const observer=screen?new MutationObserver(()=>{if(screen.hidden){clearTimeout(timer);controller?.abort?.()}else void poll()}):null;observer?.observe(screen,{attributes:true,attributeFilter:['hidden']});
 function stop(){if(stopped)return;stopped=true;clearTimeout(timer);controller?.abort?.();removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible);observer?.disconnect()}
 return {stop,refresh:poll,plain:newsPlainText};
}
