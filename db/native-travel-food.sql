-- Native travel foods use the existing atomic, rate-limited consumption path.
do $patch$ declare body text;old text;begin
 select pg_get_functiondef('eldervale_private.realm_request_social_base(uuid,text,jsonb,uuid,bigint)'::regprocedure) into body;
 if md5(body)<>'d2a98aa02a5ceb5df313583013d5046f' then raise exception 'Consumption handler changed';end if;
 old:='where id=''item:''||k and data->>''custom''=''true''';
 if position(old in body)=0 then raise exception 'Consumption catalog lookup changed';end if;
 body:=replace(body,old,'where id=''item:''||k and not(data?''noteOf'') and coalesce((data->>''heal'')::integer,0)>0 and (data->>''custom''=''true'' or data->>''category''=''Food'')');execute body;
end $patch$;
