-- Fences block walking on the server too, matching the client route search
-- (navigation-obstacles.js): a fence panel is 1.7 × 0.24 m (inside its 2.2 m rails) before its scaleX
-- stretch, padded by the 0.2 m walker radius like every other prop. Click-to-walk
-- routes already go around fences on the client; this keeps the server from
-- letting a stale or hand-made path cut through a paddock.
select eldervale_private.patch_function('eldervale_private.can_step(double precision,double precision,double precision,double precision)'::regprocedure,array[
 $o$'scarecrow','flower_bed') loop$o$,
 $n$'scarecrow','flower_bed','fence') loop$n$,
 $o$"flower_bed":[1,0.45]}'::jsonb)$o$,
 $n$"flower_bed":[1,0.45],"fence":[0.85,0.12]}'::jsonb)$n$,
 $o$dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;$o$,
 $n$dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/(case when o.data->>'template'='fence' then coalesce((o.data->>'scaleX')::float8,s) else s end);dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/(case when o.data->>'template'='fence' then coalesce((o.data->>'scaleZ')::float8,s) else s end);$n$
]);
