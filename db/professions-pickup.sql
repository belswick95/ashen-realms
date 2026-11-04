-- Owner-placed world items are collected atomically into carried inventory.
-- The public entry point and its established authentication remain unchanged.
create or replace function eldervale_private.pickup(entity_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e eldervale_private.entities;p eldervale_private.realm_players;n integer;rev bigint;
begin
 if not eldervale_private.allowed() or exists(select 1 from eldervale_private.settings where maintenance and not eldervale_private.is_owner()) then raise exception 'Access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() for update;
 if not found or p.last_seen<clock_timestamp()-interval '15 seconds' then raise exception 'Reconnect to the shared world';end if;
 if exists(select 1 from eldervale_private.moderation where user_id=auth.uid() and (banned_until>clock_timestamp() or kicked_at>p.last_seen)) then raise exception 'Access denied' using errcode='42501';end if;
 select * into e from eldervale_private.entities where id=entity_id for update;
 if e.id is null or e.deleted or e.data->>'kind'<>'item' then raise exception 'Item is no longer available';end if;
 if sqrt(power(p.x-(e.data->>'x')::float8,2)+power(p.z-(e.data->>'z')::float8,2))>3 then raise exception 'Move closer to pick up this item';end if;
 n:=coalesce((e.data->>'amount')::integer,1);perform eldervale_private.item_change(auth.uid(),e.data->>'item',n);
 if eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Inventory full. Free space before collecting this item';end if;
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 update eldervale_private.entities set deleted=true,revision=rev where id=entity_id;
 return jsonb_build_object('collected',true,'item',e.data->>'item','amount',n);
end $$;
revoke all on function eldervale_private.pickup(uuid) from public,anon,authenticated;
grant execute on function eldervale_private.pickup(uuid) to authenticated;
