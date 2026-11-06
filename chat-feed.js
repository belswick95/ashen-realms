// Local game notices and server chat share one timeline. Notices never leave this device.
import {morphChildren} from './ui-stable.js?v=release-20261106-quiet121';
const local=[],remote=new Map();let identity=null;
// Staff badges are bound to account UUIDs, never user-editable display names.
const STAFF_ACCOUNT_IDS=new Set(['91c5b7f0-7018-4290-a190-c2bba0ca492d']);
export const crownSVG='<svg viewBox="0 0 20 16" width="17" height="14" aria-label="Staff" role="img" style="display:inline-block;vertical-align:-2px;margin-right:4px;flex:none;image-rendering:pixelated"><path fill="#7b470e" d="M1 2h3v3h2V2h3v4h2V1h3v5h2V3h3v10H1z"/><path fill="#ffec54" d="M2 2h2v5h3V4h2v5h2V3h2v6h2V5h2v7H2z"/><path fill="#fff9a4" d="M3 3h1v4h2V6h1v4H3z"/><path fill="#e6a728" d="M2 12h16v3H2z"/><path fill="#ffd848" d="M3 12h13v2H3z"/><path fill="#3a280e" d="M6 9h3v3H6zm6 0h3v3h-3z"/></svg>';
export const hasStaffCrown=id=>STAFF_ACCOUNT_IDS.has(id);
export function setFeedIdentity(id){if(identity&&identity!==id){local.length=0;remote.clear()}identity=id;renderFeed()}
export function addSystemMessage(body){local.push({body:String(body),time:Date.now(),system:true});if(local.length>100)local.shift();renderFeed()}
export function setChatMessages(rows){remote.clear();for(const row of rows)remote.set(row.id,{body:String(row.body||''),name:String(row.sender_name||'Player'),senderId:String(row.sender_id||''),time:Date.parse(row.created_at)||Date.now()});renderFeed()}
export function feedEntries(){return [...local,...remote.values()].sort((a,b)=>a.time-b.time)}
export function renderFeed(){const host=globalThis.document?.querySelector('#world-chat-lines');if(!host)return;const bottom=host.scrollHeight-host.scrollTop-host.clientHeight<45;const lines=[];for(const entry of feedEntries()){const line=document.createElement('div');line.className=entry.system?'world-line game-line':'world-line';const name=document.createElement('strong');name.textContent=entry.system?'Game: ':entry.name+': ';const body=document.createElement('span');body.textContent=entry.body;if(!entry.system&&hasStaffCrown(entry.senderId)){const crown=document.createElement('span');crown.innerHTML=crownSVG;crown.title='Eldervale staff';line.append(crown)}line.append(name,body);lines.push(line)}if(morphChildren(host,lines)&&bottom)host.scrollTop=host.scrollHeight}
