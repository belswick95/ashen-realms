// Prints a read-only SQL query that counts every patch anchor of db/tick-tile-engine-*.sql in the
// live function text. Every row must say matches=1 (or applied=true once the file is in).
// Usage: node scripts/tick-tile-db/live-anchors.mjs > /tmp/anchors.sql, then run it read-only.
import {readFileSync,readdirSync} from 'node:fs';
const repo=new URL('../..',import.meta.url).pathname;
export function anchors(){
 const out=[];
 for(const f of readdirSync(repo+'db').filter(f=>/^tick-tile-engine-\d.*\.sql$/.test(f)).sort()){
  const sql=readFileSync(repo+'db/'+f,'utf8');
  for(const m of sql.matchAll(/\$edits\$(\[[\s\S]*?\])\$edits\$/g))for(const [fn,old,next] of JSON.parse(m[1]))out.push({file:f,fn,old,next});
 }
 // Single patch_function calls on live functions written as SQL string literals.
 out.push({file:'tick-tile-engine-1-grid.sql',fn:'eldervale_private.admin_console(text,jsonb)',old:" if command='console_give_xp' then",next:'eldervale_private.engine_console(command,payload)'});
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const q=s=>"'"+s.replace(/'/g,"''")+"'";
 const rows=anchors().filter(a=>!a.fn.includes('engine_console(')).map((a,k)=>`(${k+1},${q(a.file)},${q(a.fn)},${q(a.old)},${q(a.next)})`);
 console.log(`select n,file,fn,(length(d)-length(replace(d,old,'')))/length(old) matches,position(next in d)>0 applied
from (values ${rows.join(',\n ')}) v(n,file,fn,old,next) cross join lateral (select pg_get_functiondef(fn::regprocedure) d) x order by n;`);
}
