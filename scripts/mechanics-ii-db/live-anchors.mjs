// Prints a read-only SQL query that counts every patch anchor of db/mechanics-ii-3-hooks.sql in the
// live function text. Before applying, every row must say matches=1 (after: applied=true).
// Usage: node scripts/mechanics-ii-db/live-anchors.mjs > anchors.sql, then run it read-only.
import {readFileSync} from 'node:fs';
const repo=new URL('../..',import.meta.url).pathname;
export function anchors(){
 const out=[],sql=readFileSync(repo+'db/mechanics-ii-3-hooks.sql','utf8');
 for(const m of sql.matchAll(/\$edits\$(\[[\s\S]*?\])\$edits\$/g))for(const [fn,old,next] of JSON.parse(m[1]))out.push({fn,old,next});
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const q=s=>"'"+s.replace(/'/g,"''")+"'";
 const rows=anchors().map((a,k)=>`(${k+1},${q(a.fn)},${q(a.old)},${q(a.next)})`);
 console.log(`select n,fn,(length(d)-length(replace(d,old,'')))/length(old) matches,position(next in d)>0 applied
from (values ${rows.join(',\n ')}) v(n,fn,old,next) cross join lateral (select pg_get_functiondef(fn::regprocedure) d) x order by n;`);
}
