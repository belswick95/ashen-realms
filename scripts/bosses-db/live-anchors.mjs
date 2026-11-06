// Prints a read-only SQL query that counts every hook anchor of db/bosses-2-hooks.sql in the live
// function text. Before applying, every row must say matches=1 (or applied=true once the file is in).
// Usage: node scripts/bosses-db/live-anchors.mjs > anchors.sql   then run it read-only on live.
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../db/bosses-2-hooks.sql',import.meta.url),'utf8');
export const anchors=()=>JSON.parse(sql.match(/\$edits\$([\s\S]*?)\$edits\$/)[1]).map(([fn,old,nw])=>({fn,old,nw}));
if(import.meta.url===`file://${process.argv[1]}`){
 const q=s=>"'"+s.replace(/'/g,"''")+"'";
 const rows=anchors().map((a,k)=>`(${k+1},${q(a.fn)},${q(a.old)},${q(a.nw)})`);
 console.log(`select n,fn,(length(d)-length(replace(d,old,'')))/length(old) matches,position(nw in d)>0 applied
from (values ${rows.join(',\n ')}) v(n,fn,old,nw) cross join lateral (select pg_get_functiondef(fn::regprocedure) d) x order by n;`);
}
