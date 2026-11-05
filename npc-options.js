// RuneScape-style NPC options. Left click talks; bankers and merchants offer
// their service inside the conversation and directly from the right-click menu.
export function npcService(profile){return profile?.role==='banker'?'bank':profile?.role==='merchant'?'trade':null}
export function npcDisplayName(profile){return profile?.name||(npcService(profile)==='trade'?'Merchant':npcService(profile)==='bank'?'Banker':'Villager')}
// Right-click / long-press menu, in order. Each entry: {action, prefix} (the
// caller renders prefix + name with the combat-level colouring it already uses).
export function npcMenuOptions(profile){
 const service=npcService(profile),out=[{action:'talk',prefix:'Talk-to '}];
 if(service==='bank')out.push({action:'bank',prefix:'Bank '});else if(service==='trade')out.push({action:'trade',prefix:'Trade '});
 out.push({action:'examine',prefix:'Examine '});return out;
}
export function npcMenuLabels(profile){const name=npcDisplayName(profile);return npcMenuOptions(profile).map(o=>o.prefix+name)}
// Conversation: the NPC's first line, then choices. Bankers and merchants lead
// with their service; "Tell me more." walks through the rest of their lines.
export function npcDialogueChoices(profile,lineIndex=0){
 const service=npcService(profile),lines=profile?.lines||[],out=[];
 if(service==='bank')out.push({action:'bank',label:"I'd like to access my bank account."});
 if(service==='trade')out.push({action:'trade',label:"I'd like to see what you have for sale."});
 if(lineIndex<lines.length-1)out.push({action:'more',label:service?'Tell me more.':'Continue'});
 out.push({action:'goodbye',label:'Goodbye.'});return out;
}
export function npcGreeting(profile){const service=npcService(profile),line=profile?.lines?.[0];if(line)return line;return service==='bank'?'Good day. How may I help you?':service==='trade'?'Welcome! Care to see my wares?':'Hello there.'}
// Dialogue text is one line per row; seeds written with a plain SQL string store
// a literal backslash-n, which must split too rather than show as "\n".
export function dialogueLines(text){return String(text??'').split(/\r?\n|\\n/).map(l=>l.trim()).filter(Boolean)}
