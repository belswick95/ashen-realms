// Client half of db/sync-diet.sql. The lean RPCs leave out every heavy key
// whose md5 digest the client already holds, and send actors as a delta
// against an acknowledged state token. expand() rebuilds the full reply shape
// that the rest of the game reads, so callers see exactly what the old RPCs
// returned. Old servers (no `digests` in the reply) pass straight through.
export function createSyncDiet(){
 const cache=new Map(),digests=new Map(),actors=new Map();let token=null;
 // What to tell the server we already have.
 function have(){const out={};for(const [k,d] of digests)out[k]=d;if(token)out.actorsToken=token;return out}
 // `changed` lists the keys whose value is new in this reply (skipped keys are not).
 function expand(data){
  if(!data||typeof data!=='object'||!data.digests||typeof data.digests!=='object'){
   // Full reply from an old server: forget what we knew so a later lean reply cannot mix states.
   cache.clear();digests.clear();actors.clear();token=null;return {data,changed:null}}
  const changed=new Set();
  for(const [k,d] of Object.entries(data.digests)){
   if(Object.hasOwn(data,k)){if(digests.get(k)!==d)changed.add(k);cache.set(k,data[k]);digests.set(k,d)}
   else if(cache.has(k)){data[k]=cache.get(k);
    // Skipped against a digest we no longer hold (two requests in flight):
    // show the cached value and ask for the full key next time.
    if(digests.get(k)!==d)digests.delete(k)}
   else digests.delete(k)
  }
  delete data.digests;
  if(Array.isArray(data.actors)){
   if(data.actorsBase!==undefined){
    // A delta: apply it only on the state it was computed against.
    for(const row of data.actors)actors.set(row.id,row);
    if(data.actorsBase===token){for(const id of data.actorsGone||[])actors.delete(id);token=data.actorsToken||null}
    else token=null;
    data.actors=[...actors.values()];
   }else{actors.clear();for(const row of data.actors)actors.set(row.id,row);token=data.actorsToken||null}
   if(data.actors.length)changed.add('actors');
  }
  delete data.actorsBase;delete data.actorsGone;delete data.actorsToken;
  return {data,changed};
 }
 return {have,expand,get token(){return token},reset(){cache.clear();digests.clear();actors.clear();token=null}};
}
// A missing lean RPC (server not migrated yet): fall back to the old one.
export function missingRpc(error){return !!error&&(error.code==='PGRST202'||/Could not find the function/i.test(error.message||''))}
