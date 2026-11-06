-- Eldervale: login "What's new" news posts, the owner's News console, the public
-- "Adventurers online" count and the news-images storage bucket.
-- Idempotent (create … if not exists / create or replace / on conflict do nothing):
-- safe to run more than once. Apply after db/owner-world-builder.sql (needs
-- eldervale_private.is_owner(), eldervale_private.audit and eldervale_private.realm_players).
--
-- Posts are never removed: the console archives them (archived = true), which hides
-- them from the login screen and keeps their history in the audit log.

create table if not exists eldervale_private.news_posts(
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 120),
 body text not null default '' check (char_length(body)<=8000),
 image_url text check (image_url is null or image_url like 'https://%'),
 image_alt text not null default '' check (char_length(image_alt)<=160),
 links jsonb not null default '[]'::jsonb check (jsonb_typeof(links)='array' and jsonb_array_length(links)<=3),
 published boolean not null default false,
 published_at timestamptz not null default now(),
 pinned boolean not null default false,
 sort_order integer not null default 0,
 archived boolean not null default false,
 version integer not null default 1,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists news_posts_public_order on eldervale_private.news_posts(pinned desc,sort_order,published_at desc) where published and not archived;
-- Private schema, no direct table access: reads and writes only go through the functions below.
revoke all on table eldervale_private.news_posts from public,anon,authenticated;

-- Public (anonymous) read of published posts, newest pinned first. Only display fields leave the server.
create or replace function public.eldervale_news(max_posts integer default 8) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'image_url',p.image_url,'image_alt',p.image_alt,'links',p.links,'published_at',p.published_at,'pinned',p.pinned,'sort_order',p.sort_order) order by p.pinned desc,p.sort_order,p.published_at desc),'[]'::jsonb)
 from (select * from eldervale_private.news_posts n where n.published and not n.archived and n.published_at<=now()
       order by n.pinned desc,n.sort_order,n.published_at desc limit greatest(1,least(coalesce(max_posts,8),20))) p
$$;

-- Public (anonymous) "Adventurers online" count: a single number, no names or positions.
create or replace function public.eldervale_online_count() returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from eldervale_private.realm_players where last_seen>now()-interval '30 seconds'
$$;

-- Owner-only News console commands: news_list, news_save, news_publish, news_unpublish,
-- news_pin, news_unpin, news_archive, news_restore, news_reorder. Every write is audited.
create or replace function eldervale_private.news_admin(command text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid;old jsonb;result jsonb;d jsonb;link jsonb;clean_links jsonb:='[]'::jsonb;img text;post_title text;post_body text;post_alt text;post_at timestamptz;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>40000 then raise exception 'News payload is invalid or too large';end if;
 if command='news_list' then
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.archived,p.pinned desc,p.sort_order,p.published_at desc),'[]'::jsonb) from eldervale_private.news_posts p);
 end if;
 if command='news_reorder' then
  if coalesce(jsonb_typeof(payload->'ids'),'null')<>'array' or jsonb_array_length(payload->'ids') not between 1 and 200 then raise exception 'Send the post ids in display order';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'ids') as v(id) where v.id !~ '^[0-9a-fA-F-]{36}$') then raise exception 'Invalid post id';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'sort_order',p.sort_order)),'[]'::jsonb) into old from eldervale_private.news_posts p;
  update eldervale_private.news_posts p set sort_order=o.ord::integer-1,updated_at=now() from jsonb_array_elements_text(payload->'ids') with ordinality as o(id,ord) where p.id=o.id::uuid and p.sort_order is distinct from o.ord::integer-1;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,null,old,payload->'ids');
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.archived,p.pinned desc,p.sort_order,p.published_at desc),'[]'::jsonb) from eldervale_private.news_posts p);
 end if;
 if nullif(payload->>'id','') is not null then
  if payload->>'id' !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid post id';end if;
  pid:=(payload->>'id')::uuid;select to_jsonb(p) into old from eldervale_private.news_posts p where p.id=pid for update;
 end if;
 if command in ('news_publish','news_unpublish','news_pin','news_unpin','news_archive','news_restore') then
  if old is null then raise exception 'News post not found';end if;
  update eldervale_private.news_posts p set
   published=case command when 'news_publish' then true when 'news_unpublish' then false when 'news_archive' then false else p.published end,
   pinned=case command when 'news_pin' then true when 'news_unpin' then false when 'news_archive' then false else p.pinned end,
   archived=case command when 'news_archive' then true when 'news_restore' then false else p.archived end,
   version=p.version+1,updated_at=now()
  where p.id=pid returning to_jsonb(p) into result;
 elsif command='news_save' then
  d:=payload->'data';
  if coalesce(jsonb_typeof(d),'null')<>'object' then raise exception 'News post data is missing';end if;
  post_title:=btrim(coalesce(d->>'title',''));post_body:=coalesce(d->>'body','');post_alt:=btrim(coalesce(d->>'image_alt',''));
  if char_length(post_title) not between 1 and 120 then raise exception 'Title must be 1–120 characters';end if;
  if char_length(post_body)>8000 then raise exception 'Body must be at most 8000 characters';end if;
  if char_length(post_alt)>160 then raise exception 'Image description must be at most 160 characters';end if;
  img:=nullif(btrim(coalesce(d->>'image_url','')),'');
  if img is not null and img !~ '^https://aojccnhmvxurrnnzteej\.supabase\.co/storage/v1/object/public/news-images/[A-Za-z0-9._/-]{1,200}$' then raise exception 'Images must be uploaded to the news-images bucket';end if;
  if coalesce(jsonb_typeof(coalesce(d->'links','[]'::jsonb)),'null')<>'array' or jsonb_array_length(coalesce(d->'links','[]'::jsonb))>3 then raise exception 'Up to three link buttons';end if;
  for link in select value from jsonb_array_elements(coalesce(d->'links','[]'::jsonb)) loop
   if char_length(btrim(coalesce(link->>'label',''))) not between 1 and 40 then raise exception 'Each link button needs a 1–40 character label';end if;
   if char_length(coalesce(link->>'url','')) not between 12 and 500 or coalesce(link->>'url','') !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]<>"''`\\]*)?$' then raise exception 'Link buttons must use https:// addresses';end if;
   clean_links:=clean_links||jsonb_build_array(jsonb_build_object('label',btrim(link->>'label'),'url',link->>'url'));
  end loop;
  begin post_at:=coalesce(nullif(d->>'published_at','')::timestamptz,(old->>'published_at')::timestamptz,now());
  exception when others then raise exception 'Invalid publish date';end;
  if post_at>now()+interval '1 year' or post_at<timestamptz '2020-01-01' then raise exception 'Publish date is out of range';end if;
  insert into eldervale_private.news_posts as p(id,title,body,image_url,image_alt,links,published,published_at,pinned,sort_order,created_by)
  values(coalesce(pid,gen_random_uuid()),post_title,post_body,img,post_alt,clean_links,coalesce((d->>'published')::boolean,false),post_at,coalesce((d->>'pinned')::boolean,false),coalesce((select min(sort_order)-1 from eldervale_private.news_posts),0),auth.uid())
  on conflict (id) do update set title=excluded.title,body=excluded.body,image_url=excluded.image_url,image_alt=excluded.image_alt,links=excluded.links,
   published=excluded.published,published_at=excluded.published_at,pinned=excluded.pinned,version=p.version+1,updated_at=now()
  returning to_jsonb(p) into result;
  pid:=(result->>'id')::uuid;
 else
  raise exception 'Unknown news command %',command;
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,pid::text,old,result);
 return result;
end $$;

create or replace function public.world_news_admin(command text,payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$select eldervale_private.news_admin(command,payload)$$;

revoke all on function public.eldervale_news(integer),public.eldervale_online_count() from public;
grant execute on function public.eldervale_news(integer),public.eldervale_online_count() to anon,authenticated;
revoke all on function eldervale_private.news_admin(text,jsonb),public.world_news_admin(text,jsonb) from public,anon;
grant execute on function eldervale_private.news_admin(text,jsonb),public.world_news_admin(text,jsonb) to authenticated;

-- Public bucket for post images: anyone can view the files, only the owner can upload.
-- 2 MB cap and image types only (the console downscales to ≤1600 px WebP/JPEG first).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('news-images','news-images',true,2097152,array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

do $policies$
begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Owner uploads news images') then
  create policy "Owner uploads news images" on storage.objects for insert to authenticated
   with check (bucket_id='news-images' and eldervale_private.is_owner() and lower(storage.extension(name)) in ('webp','jpg','jpeg','png'));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Owner lists news images') then
  create policy "Owner lists news images" on storage.objects for select to authenticated
   using (bucket_id='news-images' and eldervale_private.is_owner());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Owner replaces news images') then
  create policy "Owner replaces news images" on storage.objects for update to authenticated
   using (bucket_id='news-images' and eldervale_private.is_owner())
   with check (bucket_id='news-images' and eldervale_private.is_owner() and lower(storage.extension(name)) in ('webp','jpg','jpeg','png'));
 end if;
end $policies$;

-- Starter posts (skipped if they already exist, so owner edits are never overwritten).
insert into eldervale_private.news_posts(id,title,body,published,published_at,pinned,sort_order) values
('5e1d0000-0000-4000-8000-000000000001','Castle Training opens its gates to new adventurers',$news$Every new adventurer now begins inside **Eldervale Castle**, where King Oswin the Steadfast and his instructors teach the ways of the Heartlands before you set out.

- Eight short training quests: the *Arms Drill*, *Timber and Flame*, *Nets at the Pond*, *Supper at the Range*, *Ore and Anvil*, *Coins and Vaults* and more
- Follow your progress in the new **Quests** tab — grey for not started, yellow in progress, green once complete
- Every finished lesson pays out experience and useful starter kit, celebrated with a quest scroll

Complete your training and pass *Through the Great Gate* into the wider world. Seasoned adventurers are welcome to visit the castle for a refresher.$news$,true,timestamptz '2026-11-05T09:00:00Z',true,0),
('5e1d0000-0000-4000-8000-000000000002','Birchford crowned the Royal Capital',$news$Birchford has grown into the walled **Royal Capital of Eldervale**.

- A stone curtain wall with towers, wardens and four gates on the great roads
- The **Grand Market**: eight stalls of traders around the old square, plus new shops, two banks and the Gilded Antler inn
- The **Warriors' Guild** and the **Crafters' Guild & Smithy**, with furnace, anvil, workbench and spinning wheel
- **Birchford Keep**, seat of Queen Aelith, watched over by the Royal Guard

Walk its paved streets by lamplight — the town square, bank and lodge you know are still at its heart.$news$,true,timestamptz '2026-11-04T09:00:00Z',false,1)
on conflict (id) do nothing;
