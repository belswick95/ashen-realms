// Player-to-player trade requests. Player A asks player B to trade; B has ten
// seconds to accept or decline. The server owns the deadline (trades.expires_at,
// sent as `expires_in` seconds) and cancels a request when the players move
// apart, one leaves the world, or either enters combat (db/trade-requests.sql).
// These pure helpers mirror that on the client for the countdown and messages.
export const TRADE_REQUEST_SECONDS=10;
export const TRADE_REQUEST_RANGE=6;
const FINISHED=new Set(['complete','cancelled','declined','expired']);
export const tradeFinished=stage=>FINISHED.has(stage);
// A trade that never left the request stage has revision 1 (accepting bumps it).
export const neverOpened=trade=>trade.stage==='invited'||Number(trade.revision)<=1;
export function tradeRoles(trade){const requester=trade.a===trade.self;return {requester,partner:(requester?trade.name_b:trade.name_a)||'The other player'}}
// Client deadline (ms) from the server's remaining seconds when the snapshot arrived.
// Never longer than the request window, whatever the payload says.
export function requestDeadline(expiresIn,receivedAt){
 const s=Number(expiresIn);
 return receivedAt+1000*(Number.isFinite(s)?Math.min(TRADE_REQUEST_SECONDS,Math.max(0,s)):TRADE_REQUEST_SECONDS);
}
export const secondsLeft=(deadline,now)=>Math.max(0,Math.ceil((deadline-now)/1000));
export const requestExpired=(deadline,now)=>now>=deadline;
// Why the server would cancel a pending request (mirrors trade_request_sweep), or null.
export function requestCancelReason({inCombat=false,online=true,sameFloor=true,distance=0}={}){
 if(inCombat)return 'combat';
 if(!online)return 'offline';
 if(!sameFloor||!(distance<=TRADE_REQUEST_RANGE))return 'moved';
 return null;
}
// Game message for a request that ended before the trade window opened, or null.
export function requestOutcomeMessage(trade){
 if(!trade||!neverOpened(trade))return null;
 const {requester,partner}=tradeRoles(trade);
 if(trade.stage==='expired')return requester?partner+' did not respond to your trade request.':'Trade request expired.';
 if(trade.stage==='declined')return requester?partner+' declined the trade.':'You declined the trade request.';
 if(trade.stage!=='cancelled')return null;
 if(trade.reason==='combat')return 'Trade request cancelled: you cannot trade during combat.';
 if(trade.reason==='offline')return 'Trade request cancelled: '+partner+' left the world.';
 if(trade.reason==='moved')return 'Trade request cancelled: you and '+partner+' are too far apart.';
 const byMe=trade.reason==='cancelled_by_'+(requester?'a':'b');
 return byMe?'You cancelled the trade request.':partner+' cancelled the trade request.';
}
