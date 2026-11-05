-- Follow-up to db/trade-requests.sql (already applied): a player counts as offline for a
-- pending trade request after 8 s without a sync (was 5 s, which cancelled a live request
-- when a slow client stalled briefly). Logout now cancels explicitly (auth.js).
create or replace function eldervale_private.trade_request_sweep(t timestamptz)
returns void language sql set search_path='' as $fn$
 update eldervale_private.trades x set stage='expired',reason='timeout',expires_at=t+interval '15 seconds'
  where x.stage='invited' and x.expires_at<=t;
 update eldervale_private.trades x set stage='cancelled',expires_at=t+interval '15 seconds',reason=(case
   when exists(select 1 from eldervale_private.realm_actors r where r.target in (x.a,x.b)) then 'combat'
   when (select count(*) from eldervale_private.realm_players q where q.user_id in (x.a,x.b) and q.last_seen>t-interval '8 seconds')<2 then 'offline'
   else 'moved' end)
  where x.stage='invited' and (exists(select 1 from eldervale_private.realm_actors r where r.target in (x.a,x.b))
   or not exists(select 1 from eldervale_private.realm_players qa join eldervale_private.realm_players qb on qb.user_id=x.b
    where qa.user_id=x.a and qa.last_seen>t-interval '8 seconds' and qb.last_seen>t-interval '8 seconds'
     and qa.floor=qb.floor and sqrt(power(qa.x-qb.x,2)+power(qa.z-qb.z,2))<=6));
$fn$;
revoke all on function eldervale_private.trade_request_sweep(timestamptz) from public,anon,authenticated;
