CREATE OR REPLACE FUNCTION eldervale_private.can_step(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$declare o record;template text;hx float8;hz float8;a float8;s float8;tx float8;tz float8;begin
 if not eldervale_private.can_step_before_props(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where abs(x-bx)<15 and abs(z-bz)<15 and(kind in('tree','rock') or data->>'template' in('tree','pine','rock','crate','barrel','fountain','well','market','bench')) loop
  template:=coalesce(o.data->>'template',o.kind);s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if o.data?'scaleX' then null;else a:=a*pi()/180;end if;
  hx:=case template when 'tree' then .7 when 'pine' then .7 when 'rock' then 1.1 when 'crate' then .7 when 'barrel' then .6 when 'fountain' then 1.9 when 'well' then 1.2 when 'market' then 1.35 when 'bench' then 1.15 else 0 end;
  hz:=case template when 'crate' then .6 when 'market' then .95 when 'bench' then .5 else hx end;
  tx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;tz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;
  if hx>0 and (case when template in('fountain','well','tree','pine','rock') then sqrt(tx*tx+tz*tz)<hx+.2 else abs(tx)<hx+.2 and abs(tz)<hz+.2 end) then return false;end if;
 end loop;return true;end $function$
;
