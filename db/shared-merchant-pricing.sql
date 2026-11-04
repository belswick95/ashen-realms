-- Finite stock responds to shared supply. Owner-entered prices remain the baseline.
alter table eldervale_private.shop_stock add column target_stock integer;
update eldervale_private.shop_stock set target_stock=greatest(10,stock) where stock>=0;
create function eldervale_private.shop_stock_baseline() returns trigger language plpgsql set search_path='' as $$
begin
 new.target_stock:=case when new.stock<0 then null else greatest(10,coalesce(new.target_stock,new.stock)) end;
 return new;
end $$;
revoke all on function eldervale_private.shop_stock_baseline() from public,anon,authenticated;
create trigger shop_stock_baseline before insert on eldervale_private.shop_stock for each row execute function eldervale_private.shop_stock_baseline();
create function eldervale_private.merchant_quote(base_buy integer,base_sell integer,available integer,target integer,purchase boolean,amount integer default 1) returns integer language plpgsql immutable set search_path='' as $$
declare total bigint:=0;unit_buy integer;unit_sell integer;factor numeric;i integer;
begin
 if base_buy<1 or base_sell<0 or amount not between 1 and 10 then raise exception 'Invalid merchant quote';end if;
 for i in 0..amount-1 loop
  factor:=case when available<0 then 1 else greatest(.65,least(1.50,1+(greatest(10,coalesce(target,10))-(available-case when purchase then i else -1 end))::numeric/greatest(10,coalesce(target,10))*.35)) end;
  unit_buy:=greatest(1,ceil(base_buy*factor)::integer);
  unit_sell:=least(floor(base_sell*factor)::integer,greatest(0,floor(unit_buy*.75)::integer));
  total:=total+case when purchase then unit_buy else unit_sell end;
 end loop;
 return total::integer;
end $$;
revoke all on function eldervale_private.merchant_quote(integer,integer,integer,integer,boolean,integer) from public,anon,authenticated;
do $patch$ declare body text;old text;replacement text;begin
 select pg_get_functiondef('eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)'::regprocedure) into body;
 if md5(body)<>'465b9a93795c86e4b2591781e19c57a2' then raise exception 'Merchant request changed; review baseline';end if;
 old:='price:=coalesce(stock.buy,(c->>''buy'')::integer);perform eldervale_private.item_change(auth.uid(),''gold'',-price*amount);';
 replacement:='price:=eldervale_private.merchant_quote(coalesce(stock.buy,(c->>''buy'')::integer),coalesce(stock.sell,(c->>''sell'')::integer),coalesce(stock.stock,-1),stock.target_stock,true,amount);if payload?''quote'' and (payload->>''quote'')::integer<>price then raise exception ''Price changed. Review the refreshed price and try again.'';end if;perform eldervale_private.item_change(auth.uid(),''gold'',-price);';
 if position(old in body)=0 then raise exception 'Buy fragment missing';end if;body:=replace(body,old,replacement);
 old:='price:=coalesce(stock.sell,(c->>''sell'')::integer);';
 replacement:='price:=eldervale_private.merchant_quote(coalesce(stock.buy,(c->>''buy'')::integer),coalesce(stock.sell,(c->>''sell'')::integer),coalesce(stock.stock,-1),stock.target_stock,false,1);if payload?''quote'' and (payload->>''quote'')::integer<>price then raise exception ''Price changed. Review the refreshed price and try again.'';end if;';
 if position(old in body)=0 then raise exception 'Sell fragment missing';end if;body:=replace(body,old,replacement);
 old:='jsonb_build_object(''buy'',ss.buy,''sell'',ss.sell,''stock'',ss.stock)';
 replacement:='jsonb_build_object(''buy'',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,1),''sell'',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,false,1),''buy10'',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,10),''stock'',ss.stock,''pricing'',case when ss.stock<0 then ''fixed'' else ''supply'' end)';
 if position(old in body)=0 then raise exception 'Snapshot fragment missing';end if;body:=replace(body,old,replacement);execute body;
end $patch$;
