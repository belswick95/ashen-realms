-- PostgreSQL changes the implicit function label on rename. Keep parameter references positional.
do $$declare name text;body text;begin
 foreach name in array array['realm_request_before_castle','realm_request_services','realm_request'] loop
  body:=pg_get_functiondef(('eldervale_private.'||name||'(uuid,text,jsonb,uuid,bigint)')::regprocedure);
  body:=replace(replace(body,'realm_request.session_id','$1'),'realm_request.request_id','$4');
  execute body;
 end loop;
end $$;
