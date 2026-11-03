create or replace function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare key text;data jsonb;before_row jsonb;begin
 if command<>'catalog_item' then return eldervale_private.admin_staff_base(command,payload);end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if pg_column_size(payload)>4096 then raise exception 'Item definition too large';end if;
 key:=payload->>'id';
 if key is null or key!~'^custom_[a-z0-9_]{2,35}$' or length(trim(coalesce(payload->>'name',''))) not between 2 and 60 or length(coalesce(payload->>'description',''))>300 then raise exception 'Use custom_lowercase_id and a name of 2–60 characters';end if;
 if coalesce((payload->>'buy')::integer,0) not between 1 and 1000000 or coalesce((payload->>'sell')::integer,-1) not between 0 and (payload->>'buy')::integer or coalesce((payload->>'heal')::integer,-1) not between 0 and 100 or coalesce(payload->>'icon','') not in ('gem','food','potion','scroll','supply') then raise exception 'Invalid prices, healing amount or icon';end if;
 perform pg_advisory_xact_lock(736211);
 select realm_catalog.data into before_row from eldervale_private.realm_catalog where id='item:'||key;
 if before_row is null and (select count(*) from eldervale_private.realm_catalog c where c.data->>'custom'='true')>=200 then raise exception 'Custom item limit reached (200)';end if;
 data:=jsonb_build_object('name',trim(payload->>'name'),'description',coalesce(payload->>'description',''),'buy',(payload->>'buy')::integer,'sell',(payload->>'sell')::integer,'stackable',coalesce((payload->>'stackable')::boolean,false),'heal',(payload->>'heal')::integer,'icon',payload->>'icon','custom',true);
 insert into eldervale_private.realm_catalog(id,data) values('item:'||key,data) on conflict(id) do update set data=excluded.data;
 update eldervale_private.settings set revision=revision+1 where id;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,key,before_row,data);
 return data||jsonb_build_object('id',key);
end $$;