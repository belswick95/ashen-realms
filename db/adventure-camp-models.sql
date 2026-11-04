-- Extend existing checked owner entry points; keep their authorization and audit behavior.
do $patch$ declare body text;begin
 select pg_get_functiondef('eldervale_private.admin_owner_base(text,jsonb)'::regprocedure) into body;
 if md5(body)<>'d07d1154a69d33b86584fda038e48163' then raise exception 'Owner template validator changed';end if;
 body:=replace(body,'body->>''template'' not in (','body->>''template'' not in (''tent'',''bedroll'',''log_seat'',''cooking_tripod'',''supply_wagon'',''trail_sign'',''woodpile'',''rope_coil'',''camp_lantern'',''wooden_table'',''stool'',''weapon_rack'',''trail_warden'',''camp_outfitter'',''woodsman'',''herbalist'',''camp_cook'',''scout'',''pilgrim'',''wagoner'',''wayfarer'',''camp_storyteller'',');execute body;
 select pg_get_functiondef('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure) into body;
 if md5(body)<>'c6f8306acdf2b6a2577142dd5a791795' then raise exception 'Owner model validator changed';end if;
 body:=replace(body,'if k not in(''sack''','if k not in(''rope'',''candle'',''lantern'',''bedroll'',''book'',''scroll'',''bucket'',''sack''');execute body;
 select pg_get_functiondef('eldervale_private.skill_error_before_notes(uuid,jsonb,text,uuid)'::regprocedure) into body;
 if md5(body)<>'588815663af7bc360b12c337930ffcd8' then raise exception 'Cooking station validator changed';end if;
 body:=replace(body,'in(''hearth'',''campfire'')','in(''hearth'',''campfire'',''cooking_tripod'')');execute body;
end $patch$;
alter function eldervale_private.can_step(double precision,double precision,double precision,double precision) rename to can_step_before_camp;
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language plpgsql stable set search_path='' as $$
declare o record;size jsonb;dx float8;dz float8;a float8;s float8;story integer:=coalesce(nullif(current_setting('eldervale.motion_floor',true),''),'0')::integer;
begin
 if not eldervale_private.can_step_before_camp(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where abs(x-bx)<18 and abs(z-bz)<18 and coalesce((data->>'floor')::integer,0)=story and data->>'template' in('tent','bedroll','log_seat','cooking_tripod','supply_wagon','trail_sign','woodpile','rope_coil','camp_lantern','wooden_table','stool','weapon_rack','campfire') loop
  size:=('{"tent":[2,1.95],"bedroll":[0.48,1.05],"log_seat":[0.35,1.1],"cooking_tripod":[0.55,0.55],"supply_wagon":[1.25,2.8],"trail_sign":[0.2,0.2],"woodpile":[0.65,0.65],"rope_coil":[0.48,0.48],"camp_lantern":[0.18,0.18],"wooden_table":[1,0.5],"stool":[0.3,0.3],"weapon_rack":[1.05,0.25],"campfire":[0.65,0.65]}'::jsonb)->(o.data->>'template');
  s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if not(o.data?'scaleX') then a:=a*pi()/180;end if;
  dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;
  if abs(dx)<(size->>0)::float8+.2 and abs(dz)<(size->>1)::float8+.2 then return false;end if;
 end loop;return true;
end $$;
revoke all on function eldervale_private.can_step(double precision,double precision,double precision,double precision) from public,anon,authenticated;
