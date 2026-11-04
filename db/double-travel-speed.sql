-- Only player travel constants and the collision substep budget change.
-- Existing permissions, energy, mount restrictions and combat are preserved.
do $patch$ declare body text;before text;after text;begin
 select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) into body;
 if md5(body)<>'10519de241892f79664f5f8f804f9423' then raise exception 'world_tick changed; review before applying speed change';end if;
 before:='then 9.6 when p.run and p.energy>0 then 6.4 else 3.2 end';
 after:='then 19.2 when p.run and p.energy>0 then 12.8 else 6.4 end';
 if (length(body)-length(replace(body,before,'')))/length(before)<>3 then raise exception 'Expected exactly three player travel expressions';end if;
 body:=replace(body,before,after);
 if position('for quantity in 1..96 loop' in body)=0 then raise exception 'Collision loop baseline missing';end if;
 body:=replace(body,'for quantity in 1..96 loop','for quantity in 1..192 loop');
 execute body;
end $patch$;
