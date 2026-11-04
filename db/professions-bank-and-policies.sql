-- Equipment bank stacks may contain many copies; one carried equipment slot
-- represents one copy. Withdraw-all must never debit more than one copy.
do $$declare body text;begin
 select pg_get_functiondef('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure) into body;
 if md5(body)<>'56b3c6492ba78c87215f451babe29fa9' then raise exception 'Bank withdrawal baseline changed';end if;
 execute replace(body,'amount:=least(amount,case when coalesce((c->>''stackable'')','amount:=least(amount,case when field is not null then 1 when coalesce((c->>''stackable'')');
end $$;
create policy rpc_only on eldervale_private.skill_recipes to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.skill_jobs to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.skill_fires to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.skill_crops to authenticated using(false) with check(false);

create or replace function eldervale_private.skill_tick(t timestamptz) returns void language plpgsql set search_path='' as $$
declare j eldervale_private.skill_jobs;r jsonb;problem text;f eldervale_private.skill_fires;
begin
 for j in select * from eldervale_private.skill_jobs where due_at<=t for update loop
  select data into r from eldervale_private.skill_recipes where id=j.recipe;
  if exists(select 1 from eldervale_private.realm_players where user_id=j.user_id and (path<>'[]' or input_until>t and abs(input_x)+abs(input_z)>.001)) then problem:='You stop skilling to move.';
  else
   problem:=null;
   begin
    perform eldervale_private.emit(jsonb_build_object('type','skill_complete','player',j.user_id,'text',eldervale_private.skill_finish(j.user_id,r,j.target,j.ground_drop,t)));
   exception when others then problem:=sqlerrm;end;
  end if;
  if problem is not null or j.remaining=1 then
   delete from eldervale_private.skill_jobs where user_id=j.user_id;if problem is not null then perform eldervale_private.emit(jsonb_build_object('type','skill_notice','player',j.user_id,'text',problem));end if;
  else update eldervale_private.skill_jobs set remaining=remaining-1,started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8) where user_id=j.user_id;end if;
 end loop;
 delete from eldervale_private.ground_drops where expires_at<=t;
 for f in select * from eldervale_private.skill_fires where expires_at<=t for update loop
  insert into eldervale_private.ground_drops(owner_id,item,amount,x,z) values(f.owner_id,'ashes',1,f.x,f.z);delete from eldervale_private.skill_fires where id=f.id;
 end loop;
end $$;
