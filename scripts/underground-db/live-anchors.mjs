// Prints a read-only SQL query that counts every patch anchor of db/underground-*.sql and
// db/water-*.sql in the live function text. Before applying, every row must say matches=1
// (or applied=true once that file is in). Usage:
//   node scripts/underground-db/live-anchors.mjs > anchors.sql   then run it read-only on live.
import {readFileSync,readdirSync} from 'node:fs';
const repo=new URL('../..',import.meta.url).pathname;
// SQL string literals: E'..' (backslash escapes), '..' and $tag$..$tag$.
function literals(text){const out=[];let i=0;
 while(i<text.length){const c=text[i];
  if(c===']')break;
  if((c==='E'||c==='e')&&text[i+1]==="'"){let s='';i+=2;while(i<text.length){if(text[i]==='\\'){const n=text[i+1];s+=n==='n'?'\n':n==='t'?'\t':n;i+=2;continue}if(text[i]==="'"){if(text[i+1]==="'"){s+="'";i+=2;continue}i++;break}s+=text[i++]}out.push(s);continue}
  if(c==="'"){let s='';i++;while(i<text.length){if(text[i]==="'"){if(text[i+1]==="'"){s+="'";i+=2;continue}i++;break}s+=text[i++]}out.push(s);continue}
  if(c==='$'){const m=text.slice(i).match(/^\$[A-Za-z_]*\$/);if(m){const end=text.indexOf(m[0],i+m[0].length);out.push(text.slice(i+m[0].length,end));i=end+m[0].length;continue}}
  i++}
 return out}
export function anchors(){
 const out=[];
 for(const f of readdirSync(repo+'db').filter(f=>/^(underground|water)-.*\.sql$/.test(f)).sort()){
  const sql=readFileSync(repo+'db/'+f,'utf8');
  for(const m of sql.matchAll(/select eldervale_private\.(underground_patch|soft_patch)\('([^']+)',/g)){
   const rest=sql.slice(m.index+m[0].length),lits=literals(rest.slice(0,rest.indexOf(']);')+1));
   const marker=lits[0],edits=lits.slice(1);for(let k=0;k<edits.length;k+=2)out.push({file:f,fn:m[2],marker,old:edits[k]})}
 }
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const q=s=>"'"+s.replace(/'/g,"''")+"'";
 const rows=anchors().map((a,k)=>`(${k+1},${q(a.file)},${q(a.fn)},${q(a.old)},${q(a.marker)})`);
 console.log(`select n,file,fn,(length(d)-length(replace(d,old,'')))/length(old) matches,position(marker in d)>0 applied
from (values ${rows.join(',\n ')}) v(n,file,fn,old,marker) cross join lateral (select pg_get_functiondef(fn::regprocedure) d) x order by n;`);
}
