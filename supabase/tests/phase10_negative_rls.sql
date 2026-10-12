-- Negative integration tests against real PostgreSQL RLS, not mocks.
-- Runs with a temporary role/JWT context; all fixture changes roll back.
begin;
do $test$
declare org_a uuid; org_b uuid;
begin
 select org_id into org_a from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
 select org_id into org_b from public.crm_apps where id='22222222-2222-4222-8222-222222222222';
 if org_a is null or org_b is null or org_a=org_b then raise exception 'Backfill failed'; end if;
 if (select count(*) from public.crm_records where org_id is null)<>0 then raise exception 'Unassigned records'; end if;
 if not (select relrowsecurity from pg_class where oid='public.crm_records'::regclass)
   or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
 then raise exception 'RLS not enabled'; end if;
 if (select public from storage.buckets where id='crm-property-media') is distinct from false then raise exception 'Storage bucket public'; end if;
 if has_function_privilege('anon','public.crm_apply_proposal(uuid)','EXECUTE')
   or has_function_privilege('anon','public.crm_org_role(uuid)','EXECUTE')
   or has_function_privilege('anon','public.crm_media_allowed(text,boolean)','EXECUTE')
   or has_function_privilege('anon','public.crm_clear_samples(uuid)','EXECUTE')
 then raise exception 'Public RPC access'; end if;
 if has_table_privilege('anon','public.crm_records','SELECT') or
    has_table_privilege('authenticated','public.crm_google_accounts','SELECT') or
    has_table_privilege('authenticated','public.crm_instagram_accounts','SELECT') or
    has_table_privilege('authenticated','public.crm_instagram_events','SELECT')
 then raise exception 'Anonymous or token table privileges exposed'; end if;
 if has_column_privilege('authenticated','public.crm_records','org_id','UPDATE') or
    has_column_privilege('authenticated','public.crm_apps','org_id','UPDATE') or
    has_column_privilege('authenticated','public.crm_organizations','owner_id','UPDATE')
 then raise exception 'Tenant assignment columns writable'; end if;
 insert into public.crm_org_members(org_id,user_id,role) values
 (org_a,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','agent'),
 (org_a,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer'),
 (org_a,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','admin');
 insert into storage.objects(bucket_id,name) values
 ('crm-property-media','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg'),
 ('crm-property-media','22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/66666666-6666-4666-8666-666666666666.pdf');
end $test$;

select set_config('test.other_org', (select org_id::text from public.crm_apps where id='22222222-2222-4222-8222-222222222222'),true);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
-- Agency A owner must never see or modify B.
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $test$
declare n integer; other_org uuid;
begin
 if (select count(*) from public.crm_apps where id='11111111-1111-4111-8111-111111111111')<>1 or
    (select count(*) from public.crm_apps where id='22222222-2222-4222-8222-222222222222')<>0
 then raise exception 'Cross-agency application read'; end if;
 if (select count(*) from public.crm_records where app_id='22222222-2222-4222-8222-222222222222')<>0
 then raise exception 'Cross-agency record read'; end if;
 if (select count(*) from public.crm_org_members m join public.crm_organizations o on o.id=m.org_id where o.owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0
 then raise exception 'Cross-agency members read'; end if;
 if (select count(*) from public.crm_organizations where owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0
 then raise exception 'Cross-agency organization read'; end if;
 if (select count(*) from storage.objects where bucket_id='crm-property-media')<>1
 then raise exception 'Storage leaks another agency'; end if;
 if public.crm_media_allowed('../../wrong.jpg',false)
   or public.crm_media_can_delete('not-a-uuid/..')
 then raise exception 'Malformed storage path authorized'; end if;
 if not public.crm_media_can_delete('11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg')
 then raise exception 'Owner cannot delete own media'; end if;
 begin
  insert into public.crm_records(app_id,entity,data) values
   ('22222222-2222-4222-8222-222222222222','lead','{}');
  raise exception 'Cross-agency INSERT succeeded';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values
  ('crm-property-media','22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/77777777-7777-4777-8777-777777777777.jpg');
  raise exception 'Cross-agency media upload succeeded';
 exception when insufficient_privilege then null; end;
 update public.crm_records set data='{"breach":true}' where id='44444444-4444-4444-8444-444444444444';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Cross-agency UPDATE succeeded'; end if;
 delete from public.crm_records where id='44444444-4444-4444-8444-444444444444';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Cross-agency DELETE succeeded'; end if;
 begin
  perform public.crm_clear_samples('22222222-2222-4222-8222-222222222222');
  raise exception 'Owner invoked B RPC';
 exception when raise_exception then
  if sqlerrm='Owner invoked B RPC' then raise; end if;
 end;
 other_org := current_setting('test.other_org')::uuid;
 -- SECURITY DEFINER helper visibility must not permit management.
 begin
  perform public.crm_set_org_member(other_org,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','admin');
  raise exception 'Cross-agency membership granted';
 exception when raise_exception then
  if sqlerrm='Cross-agency membership granted' then raise; end if;
 end;
begin
  perform public.crm_remove_org_member(other_org,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Cross-agency member removal succeeded';
 exception when raise_exception then
  if sqlerrm='Cross-agency member removal succeeded' then raise; end if;
 end;
end $test$;

-- Agent A may edit existing A records, not delete or read B.
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $test$
declare n integer;
begin
 update public.crm_records set data='{"edited":"agent"}'
 where id='33333333-3333-4333-8333-333333333333';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Agent cannot edit own record'; end if;
 delete from public.crm_records where id='33333333-3333-4333-8333-333333333333';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Agent deleted record'; end if;
 if (select count(*) from public.crm_records where app_id='22222222-2222-4222-8222-222222222222')<>0
 then raise exception 'Agent reads B'; end if;
 if public.crm_media_can_delete('11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg')
 then raise exception 'Agent can delete media'; end if;
 begin
   perform public.crm_set_org_member((select org_id from public.crm_apps where id='11111111-1111-4111-8111-111111111111'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin');
   raise exception 'Agent promoted member';
 exception when raise_exception then
  if sqlerrm='Agent promoted member' then raise; end if;
 end;
end $test$;

-- Viewer A is read-only (including organization configuration).
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $test$
declare n integer;
begin
 if (select count(*) from public.crm_records where id='33333333-3333-4333-8333-333333333333')<>1
 then raise exception 'Viewer cannot read agency record'; end if;
 update public.crm_records set data='{"breach":true}' where id='33333333-3333-4333-8333-333333333333';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Viewer updated record'; end if;
 delete from public.crm_records where id='33333333-3333-4333-8333-333333333333';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Viewer deleted record'; end if;
 begin
  insert into public.crm_records(app_id,entity,data) values
  ('11111111-1111-4111-8111-111111111111','lead','{}');
  raise exception 'Viewer inserted record';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values
   ('crm-property-media','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/88888888-8888-4888-8888-888888888888.jpg');
  raise exception 'Viewer uploaded media';
 exception when insufficient_privilege then null; end;
 if public.crm_media_allowed('11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg',true)
 then raise exception 'Viewer can upload media'; end if;
 update public.crm_organizations set settings='{"breach":true}'
 where id=(select org_id from public.crm_apps where id='11111111-1111-4111-8111-111111111111');
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Viewer updated organization settings'; end if;
end $test$;

-- Admin A can manage own records, B remains inaccessible.
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
do $test$
declare n integer;
begin
 if public.crm_can_access_app('22222222-2222-4222-8222-222222222222',true)
 then raise exception 'Admin can write B'; end if;
 delete from storage.objects where name='11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin cannot delete agency media'; end if;
 delete from public.crm_records where id='33333333-3333-4333-8333-333333333333';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin cannot delete agency record'; end if;
end $test$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $test$
begin
 if (select count(*) from public.crm_apps where id='22222222-2222-4222-8222-222222222222')<>1
  or (select count(*) from public.crm_apps where id='11111111-1111-4111-8111-111111111111')<>0
 then raise exception 'Agency B reads A app or cannot read own'; end if;
 if (select count(*) from storage.objects where bucket_id='crm-property-media')<>1
 then raise exception 'Agency B storage isolation failed'; end if;
end $test$;
reset role;
rollback;
