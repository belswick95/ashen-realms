-- Guard duels must obey the same floor separation as player combat.
do $patch$ declare body text;old text;begin
 select pg_get_functiondef('eldervale_private.guard_tick(double precision)'::regprocedure) into body;
 old:='for m in select * from eldervale_private.realm_actors a';
 if position(old in body)=0 then raise exception 'Guard tick baseline changed';end if;
 body:=replace(body,old,'delete from eldervale_private.guard_duels gd using eldervale_private.realm_actors ga,eldervale_private.realm_actors ma where gd.guard=ga.id and gd.monster=ma.id and coalesce((ga.data->>''floor'')::integer,0)<>coalesce((ma.data->>''floor'')::integer,0);'||chr(10)||old);
 old:='data->>''role''=''guard'' and not coalesce';
 if position(old in body)=0 then raise exception 'Guard selection changed';end if;
 body:=replace(body,old,'data->>''role''=''guard'' and coalesce((data->>''floor'')::integer,0)=coalesce((m.data->>''floor'')::integer,0) and not coalesce');
 old:='select * into g from eldervale_private.realm_actors where id=duel.guard;';
 if position(old in body)=0 then raise exception 'Guard duel changed';end if;
 body:=replace(body,old,old||'perform eldervale_private.motion_story(coalesce((g.data->>''floor'')::integer,0),g.data->>''building'');');execute body;
end $patch$;
