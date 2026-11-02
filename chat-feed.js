// Local game notices and server chat share one timeline. Notices never leave this device.
const local=[],remote=new Map();let identity=null;
export function setFeedIdentity(id){if(identity&&identity!==id){local.length=0;remote.clear()}identity=id;renderFeed()}
export function addSystemMessage(body){local.push({body:String(body),time:Date.now(),system:true});if(local.length>100)local.shift();renderFeed()}
export function setChatMessages(rows){remote.clear();for(const row of rows)remote.set(row.id,{body:String(row.body||''),name:String(row.sender_name||'Player'),time:Date.parse(row.created_at)||Date.now()});renderFeed()}
export function feedEntries(){return [...local,...remote.values()].sort((a,b)=>a.time-b.time)}
export function renderFeed(){const host=globalThis.document?.querySelector('#world-chat-lines');if(!host)return;const bottom=host.scrollHeight-host.scrollTop-host.clientHeight<45;host.replaceChildren();for(const entry of feedEntries()){const line=document.createElement('div');line.className=entry.system?'world-line game-line':'world-line';const name=document.createElement('strong');name.textContent=entry.system?'Game: ':entry.name+': ';const body=document.createElement('span');body.textContent=entry.body;line.append(name,body);host.append(line)}if(bottom)host.scrollTop=host.scrollHeight}
