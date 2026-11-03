create policy rpc_only on eldervale_private.staff to authenticated using(false) with check(false);
-- Keep the great hall's flanking towers clear of its accessible interior.
update eldervale_private.settings set revision=revision+1 where id;
update eldervale_private.entities set data=data||jsonb_build_object('x',case when (data->>'x')::float8 < -340 then -359 else -321 end,'z',-339,'scale',1.1),revision=(select revision from eldervale_private.settings where id) where data->>'blueprint'='eldervale-castle-v1' and data->>'template'='castle_tower' and (data->>'scale')::float8=1.35;
