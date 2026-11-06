import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseNewsMarkup,newsMarkupToHTML,renderNewsMarkup,safeHttpsUrl,newsPlainText} from '../news-markup.js';
import {STARTER_NEWS,normalizePost,sortPosts,renderNewsPost,formatNewsDate} from '../login-news.js';
import {fitWithin,validateNewsDraft,draftPayload,isNewsImageUrl,newsImagePath,emptyDraft} from '../admin-news.js';
import {composeJingle,ELDERVALE_MOTIF} from '../jingles.js';
import {pointerTarget,tiltTarget} from '../login-atmosphere.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

// Minimal DOM: enough to prove rendering only ever uses createElement/textContent/attributes.
function fakeDocument(){
 const node=(tag)=>({tag,children:[],attrs:{},classList:{add(){},toggle(){},contains:()=>false},dataset:{},append(...k){this.children.push(...k)},setAttribute(k,v){this.attrs[k]=String(v)},set innerHTML(v){throw Error('innerHTML used')},get textContent(){return this._text??this.children.map(c=>c.textContent).join('')},set textContent(v){this._text=String(v)}});
 return {createElement:node,createDocumentFragment:()=>node('#fragment'),createTextNode:t=>({tag:'#text',textContent:t})};
}
const flat=n=>n.tag==='#text'?[]:[n.tag,...n.children.flatMap(flat)];

test('news markup: paragraphs, bold, italic, bullet lists and https links',()=>{
 const html=newsMarkupToHTML('Hello **brave** *new* world\nsecond line\n\n- one **two**\n- [Guide](https://eldervale.apexfabricationco.com/owner-guide.html)\n\nEnd');
 assert.equal(html,'<p>Hello <strong>brave</strong> <em>new</em> world<br>second line</p><ul><li>one <strong>two</strong></li><li><a href="https://eldervale.apexfabricationco.com/owner-guide.html" target="_blank" rel="noopener noreferrer nofollow">Guide</a></li></ul><p>End</p>');
 assert.deepEqual(parseNewsMarkup('*a* and **b**')[0].children.map(n=>n.type),['em','text','strong']);
 assert.equal(newsPlainText('**Bold** [x](https://a.example)\n- item'),'Bold x item');
});
test('news markup: raw HTML, scripts and unsafe links can never get through',()=>{
 const html=newsMarkupToHTML('<script>alert(1)</script> <img src=x onerror=alert(1)> "q" & \'s\'\n\n[click](javascript:alert(1)) [plain](http://insecure.example) [data](data:text/html,hi) [creds](https://user:pw@evil.example)');
 assert.ok(!/<script|<img|javascript:|http:\/\/|data:|onerror=alert\(1\)>/.test(html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/,'')),html);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.match(html,/<p>click\)? plain data creds<\/p>/);
 for(const bad of ['javascript:alert(1)','http://x.example','//x.example','https://','https://localhost/x','https://a.example/"onmouseover','ftp://a.example',null,42])assert.equal(safeHttpsUrl(bad),null,String(bad));
 assert.equal(safeHttpsUrl(' https://Example.com/a?b=1 '),'https://example.com/a?b=1');
 // Pathological nesting and unmatched markers stay literal text, without runaway recursion.
 assert.equal(newsMarkupToHTML('**unclosed *also [x](y'),'<p>**unclosed *also [x](y</p>');
 assert.ok(newsMarkupToHTML('*'.repeat(5000)+'[a]('.repeat(500)).length>0);
 assert.ok(parseNewsMarkup('x'.repeat(20000)).length===1&&newsPlainText('x'.repeat(20000)).length===8000);
});
test('news rendering builds DOM nodes only (no innerHTML) and vets links/images',()=>{
 const doc=fakeDocument(),frag=renderNewsMarkup('Hi <b>there</b> **x** [go](https://a.example/)\n- one',doc);
 assert.deepEqual(flat(frag),['#fragment','p','strong','a','ul','li']);const a=frag.children[0].children.find(n=>n.tag==='a');
 assert.equal(a.href,'https://a.example/');assert.equal(a.rel,'noopener noreferrer nofollow');assert.match(frag.children[0].children[0].textContent,/<b>there<\/b>/);
 const article=renderNewsPost({id:'p',title:'T',body:'B',image_url:'javascript:alert(1)',links:[{label:'Ok',url:'https://a.example'},{label:'Bad',url:'http://a.example'},{label:'',url:'https://b.example'},{label:'4',url:'https://c.example'},{label:'5',url:'https://d.example'}],published_at:'2026-11-05T09:00:00Z',pinned:true},{doc});
 const tags=flat(article);assert.ok(!tags.includes('img'),'unsafe image dropped');assert.equal(tags.filter(t=>t==='a').length,1);assert.ok(tags.includes('time'));
});
test('news posts: normalised, pinned first then manual order then newest',()=>{
 const posts=[{id:'a',title:'Old',published_at:'2026-01-01'},{id:'b',title:'Pinned',pinned:true,published_at:'2025-01-01'},{id:'c',title:'New',published_at:'2026-06-01'},{id:'d',title:'Ordered',sort_order:-1,published_at:'2020-01-01'},{id:'e',title:''}].map(normalizePost).filter(Boolean);
 assert.deepEqual(sortPosts(posts).map(p=>p.id),['b','d','c','a']);
 assert.equal(normalizePost({title:'x'.repeat(500)}).title.length,120);assert.equal(formatNewsDate('nope'),'');assert.match(formatNewsDate('2026-11-05T09:00:00Z','en-GB'),/5 November 2026/);
});
test('db/news-and-login.sql: idempotent, no destructive verbs, seeds match the login fallback posts',()=>{
 const sql=read('db/news-and-login.sql');
 assert.doesNotMatch(sql,/delete|alter|drop/i);
 for(const needle of ['create table if not exists eldervale_private.news_posts','create or replace function public.eldervale_news','create or replace function public.eldervale_online_count','create or replace function eldervale_private.news_admin','eldervale_private.is_owner()','insert into eldervale_private.audit','on conflict (id) do nothing','grant execute on function public.eldervale_news(integer),public.eldervale_online_count() to anon,authenticated','revoke all on function eldervale_private.news_admin(text,jsonb),public.world_news_admin(text,jsonb) from public,anon',"insert into storage.buckets","from pg_policies"])assert.ok(sql.includes(needle),needle);
 assert.match(sql,/create policy "Owner uploads news images" on storage\.objects for insert to authenticated/);
 assert.ok(!/eldervale_online_count[^;]*(username|user_id\b|\bx\b,)/.test(sql.split('eldervale_online_count() returns integer')[1].split('$$;')[0]),'online count returns only a number');
 for(const post of STARTER_NEWS){assert.ok(sql.includes('$news$'+post.body+'$news$'),post.title);assert.ok(sql.includes("'"+post.id+"','"+post.title+"'"),post.title)}
 assert.equal(STARTER_NEWS.length,2);assert.match(STARTER_NEWS.map(p=>p.title+p.body).join(' '),/Castle Training[\s\S]*Quests[\s\S]*Birchford[\s\S]*Grand Market[\s\S]*Guild[\s\S]*Keep/);
});
test('owner News console: draft validation mirrors the server and images are bucket-only',()=>{
 assert.deepEqual(fitWithin(4000,3000),{width:1600,height:1200});assert.deepEqual(fitWithin(800,600),{width:800,height:600});assert.deepEqual(fitWithin(900,3600),{width:400,height:1600});
 const ok={...emptyDraft(),title:'Hello',body:'**Hi**',links:[{label:'Read',url:'https://example.com/a'}],image_url:'https://aojccnhmvxurrnnzteej.supabase.co/storage/v1/object/public/news-images/posts/2026-11/abc.webp'};
 assert.deepEqual(validateNewsDraft(ok),[]);
 assert.ok(validateNewsDraft({...ok,title:' '}).length);assert.ok(validateNewsDraft({...ok,image_url:'https://evil.example/x.png'}).length);
 assert.ok(validateNewsDraft({...ok,links:[{label:'x',url:'http://example.com'}]}).length);assert.ok(validateNewsDraft({...ok,links:[1,2,3,4].map(i=>({label:'l'+i,url:'https://e.example'}))}).length);
 assert.ok(!isNewsImageUrl('https://aojccnhmvxurrnnzteej.supabase.co/storage/v1/object/public/other/x.webp'));
 const payload=draftPayload({...ok,id:'abc',links:[{label:' A ',url:' https://e.example '},{label:'',url:''}]});assert.deepEqual(payload.data.links,[{label:'A',url:'https://e.example'}]);assert.equal(payload.id,'abc');
 assert.match(newsImagePath(new Date('2026-11-05T00:00:00Z'),()=>.5,'webp'),/^posts\/2026-11\/[a-z0-9]{16}\.webp$/);
 const sql=read('db/news-and-login.sql');assert.ok(sql.includes('news-images/[A-Za-z0-9._/-]{1,200}$'));
 const panel=read('admin-panel.js');assert.match(panel,/'Quests','News'/);assert.match(panel,/admin-news\.js\?v=/);
});
test('Eldervale motif: stated in the quest fanfare, every level-up family and the login sting; families stay distinct',()=>{
 assert.deepEqual([...ELDERVALE_MOTIF.intervals],[0,7,5,9,12]);
 const kinds=['quest','combat','gathering','artisan','combatLevel','motif'],signatures=new Set();
 for(const kind of kinds){const s=composeJingle(kind),motif=s.notes.filter(n=>n.motif);assert.equal(motif.length,5,kind);
  assert.deepEqual(motif.map(n=>n.m-motif[0].m),[0,7,5,9,12],kind);assert.ok(motif.every((n,i)=>!i||n.t>motif[i-1].t),kind+' motif in order');
  assert.equal(new Set(motif.map(n=>n.inst)).size,1);signatures.add(motif[0].m+':'+motif[0].inst+':'+(motif[1].t-motif[0].t).toFixed(2));
  if(kind==='motif')assert.ok(s.duration>=2&&s.duration<=3.2,'login sting is short: '+s.duration);else assert.ok(s.duration<=5.6,kind)}
 assert.equal(signatures.size,kinds.length,'each family voices the motif differently');
 assert.ok(!composeJingle('death').notes.some(n=>n.motif),'the death cue stays somber');
 const screen=read('login-screen.js');assert.match(screen,/celebrate\?\.\('motif'\)/);
});
test('login scene: parallax targets are bounded and the page wires news, online count and the frame',()=>{
 assert.deepEqual(pointerTarget(0,0,100,100),{x:-1,y:-1});assert.deepEqual(pointerTarget(50,50,100,100),{x:0,y:0});assert.deepEqual(pointerTarget(500,-50,100,100),{x:1,y:-1});
 const base={beta:40,gamma:0};assert.deepEqual(tiltTarget(40,0,base),{x:0,y:0});assert.equal(tiltTarget(40,90,base).x,1);assert.equal(tiltTarget(NaN,0,base),null);
 const html=read('index.html'),css=read('login-gate.css');
 for(const id of ['login-news','login-online','login-news-title','login-iron-corner'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/login-gate\.css\?v=release-/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/login-scene\[data-paused\]/);
 assert.doesNotMatch(read('login-news.js')+read('news-markup.js')+read('admin-news.js'),/innerHTML/);
});
