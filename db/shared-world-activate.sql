-- Run after the matching client is uploaded. Reversible via the documented rollback.
revoke insert,update,delete on public.player_saves from authenticated;
update public.player_saves set level=eldervale_private.combat_level(skills);
update eldervale_private.entities set revision=revision;
update eldervale_private.realm_clock set enabled=true,tick_at=clock_timestamp() where id;
select cron.schedule('eldervale_world_tick','1 second','select eldervale_private.world_tick()');

select cron.schedule('eldervale_runtime_log_cleanup','17 * * * *',$cleanup$delete from cron.job_run_details where jobid=(select jobid from cron.job where jobname='eldervale_world_tick') and end_time<now()-interval '1 hour'$cleanup$);
