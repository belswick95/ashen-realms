-- Owner-placed item entities use a separate pickup RPC from ordinary ground drops.
do $patch$ declare body text;old text;begin
 select pg_get_functiondef('eldervale_private.pickup(uuid)'::regprocedure) into body;
 old:='if sqrt(power(p.x-(e.data->>''x'')::float8,2)';
 if position(old in body)=0 then raise exception 'Placed-item pickup baseline changed';end if;
 body:=replace(body,old,'if coalesce((e.data->>''floor'')::integer,0)<>p.floor then raise exception ''That item is on another floor'';end if;'||chr(10)||' '||old);execute body;
end $patch$;
