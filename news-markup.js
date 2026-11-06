// "What's new" posts use a tiny, safe markup instead of HTML:
//   blank line        → new paragraph        line break → <br>
//   **bold**  *italic*  [label](https://…)   lines starting "- " or "* " → bullet list
//   \* escapes a markup character.
// Text is parsed into a small tree and rendered with createElement/textContent only,
// so a post can never inject markup, scripts, styles or non-https links.
export const NEWS_LIMITS=Object.freeze({title:120,body:8000,links:3,linkLabel:40,url:500});
const MAX_DEPTH=4;

// Only absolute https URLs without credentials survive; everything else is rejected.
export function safeHttpsUrl(value){
 if(typeof value!=='string')return null;const raw=value.trim();if(!raw||raw.length>NEWS_LIMITS.url||/[\s<>"'`\\]/.test(raw))return null;
 let url;try{url=new URL(raw)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname||!url.hostname.includes('.'))return null;
 return url.href;
}

function parseInline(text,depth=0,allowLinks=true){
 const out=[];let buffer='';const flush=()=>{if(buffer){out.push({type:'text',text:buffer});buffer=''}};
 for(let i=0;i<text.length;){
  const c=text[i];
  if(c==='\\'&&i+1<text.length&&/[*\\[\]()_-]/.test(text[i+1])){buffer+=text[i+1];i+=2;continue}
  if(depth<MAX_DEPTH&&c==='*'&&text[i+1]==='*'){const end=text.indexOf('**',i+2);if(end>i+2&&text[i+2]!==' '){flush();out.push({type:'strong',children:parseInline(text.slice(i+2,end),depth+1,allowLinks)});i=end+2;continue}}
  if(depth<MAX_DEPTH&&c==='*'&&text[i+1]!=='*'&&text[i+1]!==' '&&i+1<text.length){let end=i+1;while((end=text.indexOf('*',end))!==-1&&text[end+1]==='*')end+=2;if(end>i+1&&text[end-1]!==' '){flush();out.push({type:'em',children:parseInline(text.slice(i+1,end),depth+1,allowLinks)});i=end+1;continue}}
  if(c==='['&&allowLinks){const close=text.indexOf('](',i+1),end=close<0?-1:text.indexOf(')',close+2);if(close>i+1&&end>close+2){const label=text.slice(i+1,close),href=safeHttpsUrl(text.slice(close+2,end));flush();if(href)out.push({type:'link',href,children:parseInline(label,depth+1,false)});else out.push(...parseInline(label,depth+1,false));i=end+1;continue}}
  buffer+=c;i++;
 }
 flush();return out;
}

// Returns [{type:'p',children:[inline…]}|{type:'ul',items:[[inline…]…]}].
export function parseNewsMarkup(source){
 const text=String(source??'').replace(/\r\n?/g,'\n').slice(0,NEWS_LIMITS.body),blocks=[];let paragraph=[],list=null;
 const endParagraph=()=>{if(paragraph.length){const children=[];paragraph.forEach((line,i)=>{if(i)children.push({type:'br'});children.push(...parseInline(line))});blocks.push({type:'p',children});paragraph=[]}};
 for(const rawLine of text.split('\n')){
  const line=rawLine.trimEnd(),bullet=/^\s*[-*•]\s+(.*)$/.exec(line);
  if(bullet&&!/^\s*\*\*/.test(line)){endParagraph();if(!list){list={type:'ul',items:[]};blocks.push(list)}list.items.push(parseInline(bullet[1].trim()));continue}
  if(!line.trim()){endParagraph();list=null;continue}
  list=null;paragraph.push(line.trim());
 }
 endParagraph();return blocks;
}

// Plain text (for previews, aria labels and length checks).
export function newsPlainText(source){
 const walk=nodes=>nodes.map(n=>n.type==='text'?n.text:n.type==='br'?' ':walk(n.children||[])).join('');
 return parseNewsMarkup(source).map(b=>b.type==='p'?walk(b.children):b.items.map(walk).join(' · ')).join(' ').replace(/\s+/g,' ').trim();
}

const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Escaped HTML string of the same tree (used by tests and server-free previews).
export function newsMarkupToHTML(source){
 const inline=nodes=>nodes.map(n=>n.type==='text'?escapeHtml(n.text):n.type==='br'?'<br>':n.type==='strong'?'<strong>'+inline(n.children)+'</strong>':n.type==='em'?'<em>'+inline(n.children)+'</em>':'<a href="'+escapeHtml(n.href)+'" target="_blank" rel="noopener noreferrer nofollow">'+inline(n.children)+'</a>').join('');
 return parseNewsMarkup(source).map(b=>b.type==='p'?'<p>'+inline(b.children)+'</p>':'<ul>'+b.items.map(i=>'<li>'+inline(i)+'</li>').join('')+'</ul>').join('');
}

// DOM rendering: only createElement / textContent / vetted href attributes.
export function renderNewsMarkup(source,doc=globalThis.document){
 const fragment=doc.createDocumentFragment();
 const inline=(parent,nodes)=>{for(const n of nodes){
  if(n.type==='text')parent.append(doc.createTextNode(n.text));
  else if(n.type==='br')parent.append(doc.createElement('br'));
  else if(n.type==='strong'||n.type==='em'){const e=doc.createElement(n.type);inline(e,n.children);parent.append(e)}
  else if(n.type==='link'){const a=doc.createElement('a');a.href=n.href;a.target='_blank';a.rel='noopener noreferrer nofollow';inline(a,n.children);parent.append(a)}
 }};
 for(const block of parseNewsMarkup(source)){
  if(block.type==='p'){const p=doc.createElement('p');inline(p,block.children);fragment.append(p)}
  else{const ul=doc.createElement('ul');for(const item of block.items){const li=doc.createElement('li');inline(li,item);ul.append(li)}fragment.append(ul)}
 }
 return fragment;
}
