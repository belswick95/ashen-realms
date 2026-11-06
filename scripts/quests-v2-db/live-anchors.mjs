// Patch anchors of db/quests-v2.sql: every $a$…$a$ (old text) with the $b$…$b$ that replaces it,
// grouped by the function the DO block patches. Run as a script to print a read-only SQL query
// that counts each anchor in the live function text (every row must say matches=1 before applying,
// or applied=true afterwards).
import {readFileSync} from 'node:fs';
const repo=new URL('../..',import.meta.url).pathname;
export const PATCHED={
 'eldervale_private.realm_request_before_stories(uuid,text,jsonb,uuid,bigint)':'realm_request_before_stories',
 'eldervale_private.quest_event(jsonb)':'quest_event',
 'eldervale_private.quest_refresh(uuid)':'quest_refresh',
 'eldervale_private.admin_action(text,jsonb)':'admin_action'};
export function anchors(){
 const sql=readFileSync(repo+'db/quests-v2.sql','utf8'),hooks=sql.slice(sql.indexOf('do $hooks$'));
 const pairs=[...hooks.matchAll(/\$a\$([\s\S]*?)\$a\$,\s*\$b\$([\s\S]*?)\$b\$/g)].map(m=>({old:m[1],next:m[2]}));
 // Block order: 5 edits of realm_request_before_stories, 2 shared by quest_event + quest_refresh, 1 of admin_action.
 const out=[];
 pairs.slice(0,5).forEach(p=>out.push({fn:'eldervale_private.realm_request_before_stories(uuid,text,jsonb,uuid,bigint)',...p}));
 for(const fn of ['eldervale_private.quest_event(jsonb)','eldervale_private.quest_refresh(uuid)'])pairs.slice(5,7).forEach(p=>out.push({fn,...p}));
 pairs.slice(7).forEach(p=>out.push({fn:'eldervale_private.admin_action(text,jsonb)',...p}));
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const q=s=>"'"+s.replace(/'/g,"''")+"'";
 const rows=anchors().map((a,k)=>`(${k+1},${q(a.fn)},${q(a.old)},${q(a.next)})`);
 console.log(`select n,fn,(length(d)-length(replace(d,old,'')))/length(old) matches,position(next in d)>0 applied
from (values ${rows.join(',\n ')}) v(n,fn,old,next) cross join lateral (select pg_get_functiondef(fn::regprocedure) d) x order by n;`);
}
