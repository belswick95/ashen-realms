-- The general-store and fisherman seeds (db/general-store-and-fisherman.sql) used plain
-- SQL strings, so their dialogue holds a literal backslash-n ("\n") instead of a line
-- break. The client now splits on both, but fix the stored text too. Safe to re-run.
do $fix$
declare rev bigint;n integer;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 update eldervale_private.entities set revision=rev,data=jsonb_set(data,'{dialogue}',to_jsonb(replace(data->>'dialogue','\n',E'\n')))
  where not deleted and data->>'blueprint'='osrs-shops-v1' and position('\n' in coalesce(data->>'dialogue',''))>0;
 get diagnostics n=row_count;
 if n=0 then update eldervale_private.settings set revision=revision-1 where id;end if;
 raise notice 'shop dialogue lines fixed: %',n;
end $fix$;
