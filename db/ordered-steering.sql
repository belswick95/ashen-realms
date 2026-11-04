-- Movement-only ordering; no world-tick, NPC, item or banking logic changes.
alter table eldervale_private.realm_players add column if not exists input_seq bigint not null default 0,add column if not exists input_session uuid;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_gathering(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;dx float8;dz float8;angle float8;length float8;result jsonb;duplicate boolean;sequence bigint;
begin
 if command not in('steer','jump') then
  if command in('move','stop') then update eldervale_private.realm_players set input_until=null,input_x=0,input_z=0 where user_id=auth.uid() and realm_players.session_id=$1;end if;
  return eldervale_private.realm_request_before_controls($1,$2,$3,$4,$5);
 end if;
 if not eldervale_private.allowed() then raise exception 'World access denied' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>1000 or request_id is null then raise exception 'Invalid movement';end if;
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;
 if not found then raise exception 'Session expired';end if;
 if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then return eldervale_private.realm_request_before_controls($1,'sync','{}',null,$5);end if;
 -- Base sync enforces moderation, maintenance, session expiry and normal command checks.
 if command='steer' and payload?'sequence' then
  sequence:=(payload->>'sequence')::bigint;
  if sequence is null or sequence<1 or sequence>9007199254740991 then raise exception 'Invalid movement sequence';end if;
  if p.input_session=$1 and sequence<=p.input_seq then return eldervale_private.realm_request_before_controls($1,'sync','{}',null,$5);end if;
 end if;
 -- The final base sync still enforces moderation and maintenance; rejection rolls back this transaction.
 p:=eldervale_private.advance_player_motion(auth.uid(),clock_timestamp());
 if command='steer' then
  dx:=coalesce((payload->>'x')::float8,0);dz:=coalesce((payload->>'z')::float8,0);angle:=coalesce((payload->>'yaw')::float8,p.yaw);
  if not(dx between -1 and 1 and dz between -1 and 1 and angle between -10000 and 10000) then raise exception 'Invalid movement';end if;
  length:=sqrt(dx*dx+dz*dz);if length>1 then dx:=dx/length;dz:=dz/length;end if;
  update eldervale_private.realm_players set input_x=dx,input_z=dz,input_yaw=angle,input_until=case when length>.001 then clock_timestamp()+interval '1.5 seconds' else null end,path='[]',intent=null,yaw=angle,input_seq=coalesce(sequence,input_seq),input_session=case when sequence is not null then $1 else input_session end where user_id=auth.uid();
 elsif p.jump_at is null or p.jump_at<clock_timestamp()-interval '.85 seconds' then
  update eldervale_private.realm_players set jump_at=clock_timestamp() where user_id=auth.uid();
 end if;
 insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
 return eldervale_private.realm_request_before_controls($1,'sync','{}',null,$5);
end $function$
;
