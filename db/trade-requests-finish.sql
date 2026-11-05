-- Finishes db/trade-requests.sql (the column, sweep function and realm_request edits are already applied).
-- Paste into the Supabase SQL Editor and Run once.
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

select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
 $o$delete from eldervale_private.trades where expires_at<=t;$o$,
 $n$perform eldervale_private.trade_request_sweep(t);delete from eldervale_private.trades where expires_at<=t;$n$
]);
