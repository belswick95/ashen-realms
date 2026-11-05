-- Player trade requests (client: trade-requests.js, player-trading.js).
-- A "trade_request" now creates a request (stage 'invited') that lasts 10 seconds.
-- Only the target can accept it ("trade_join", already checked: tr.b = caller and
-- stage 'invited'), and only before it expires; offers and acceptance still require
-- stage 'offer'/'review', so no trade window can open without an accepted request.
-- A pending request ends as:
--   'expired'   reason 'timeout'   — the target did not answer within 10 seconds;
--   'declined'  reason 'declined'  — the target pressed Decline;
--   'cancelled' reason 'cancelled_by_a' / 'moved' / 'offline' / 'combat'.
-- Finished rows stay readable for 15 seconds so both players get the message.
-- Snapshots carry `expires_in` (seconds left) for the client countdown.

alter table eldervale_private.trades add column if not exists reason text;

-- Ends pending requests that ran out of time, or whose players moved apart
-- (more than 6 m, or onto different floors), left the world, or entered combat.
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

select eldervale_private.patch_function('eldervale_private.realm_request_before_controls(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 -- Sweep requests on every command and sync, before expired rows are deleted.
 $o$delete from eldervale_private.trades where expires_at<=clock_timestamp();$o$,
 $n$perform eldervale_private.trade_request_sweep(clock_timestamp());delete from eldervale_private.trades where expires_at<=clock_timestamp();$n$,
 -- One pending request or open trade per player; finished rows do not block a new request.
 $o$if exists(select 1 from eldervale_private.trades where stage not in ('complete','cancelled') and (a in (auth.uid(),partner)$o$,
 $n$if exists(select 1 from eldervale_private.trades where stage not in ('complete','cancelled','declined','expired') and (a in (auth.uid(),partner)$n$,
 -- The request lasts 10 seconds; earlier finished rows for either player are cleared so the new request is the one shown.
 $o$insert into eldervale_private.trades(a,b) values(auth.uid(),partner);$o$,
 $n$delete from eldervale_private.trades where stage in ('complete','cancelled','declined','expired') and (a in (auth.uid(),partner) or b in (auth.uid(),partner));insert into eldervale_private.trades(a,b,expires_at) values(auth.uid(),partner,clock_timestamp()+interval '10 seconds');$n$,
 -- The target's "cancel" on a pending request is a decline; finished trades stay as they are.
 $o$if command='trade_cancel' then update eldervale_private.trades set stage='cancelled',expires_at=now()+interval '15 seconds' where id=tr.id;$o$,
 $n$if command='trade_cancel' then update eldervale_private.trades set stage=(case when tr.stage='invited' and tr.b=auth.uid() then 'declined' else 'cancelled' end),reason=(case when tr.stage='invited' and tr.b=auth.uid() then 'declined' when tr.a=auth.uid() then 'cancelled_by_a' else 'cancelled_by_b' end),expires_at=now()+interval '15 seconds' where id=tr.id and stage not in ('complete','cancelled','declined','expired');$n$,
 -- Seconds left on the request, for the client countdown.
 $o$'self',auth.uid())$o$,
 $n$'self',auth.uid(),'expires_in',round(greatest(0,extract(epoch from t.expires_at-clock_timestamp()))::numeric,2))$n$
]);

-- The background tick sweeps too, so an unanswered request expires (with a message) instead of vanishing.
select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
 $o$delete from eldervale_private.trades where expires_at<=t;$o$,
 $n$perform eldervale_private.trade_request_sweep(t);delete from eldervale_private.trades where expires_at<=t;$n$
]);

-- Stairs: a declined or expired request no longer counts as an open trade, and a request
-- or trade can always be cancelled even when the partner is now on another floor.
select eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $o$stage not in ('complete','cancelled')$o$,
 $n$stage not in ('complete','cancelled','declined','expired')$n$,
 $o$command<>'trade_request' and exists($o$,
 $n$command not in ('trade_request','trade_cancel') and exists($n$
]);
