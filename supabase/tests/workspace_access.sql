-- Isolated fixture database only. Every change rolls back.
begin;
update auth.users set email='villaseca.managements@gmail.com' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.crm_org_members(org_id,user_id,role)
select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
insert into public.crm_app_versions(app_id,version,blueprint,summary) values
 ('11111111-1111-4111-8111-111111111111',1,'{}','Old'),
 ('11111111-1111-4111-8111-111111111111',2,'{}','Current');
update public.crm_apps set current_version=2 where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ begin
 if public.crm_platform_status() then raise exception 'Unconfirmed email elevated'; end if;
 if (select count(*) from public.crm_visible_versions('11111111-1111-4111-8111-111111111111'))<>2 then raise exception 'Owner history missing'; end if;
 if has_table_privilege('authenticated','public.crm_platform_admins','INSERT') then raise exception 'Client may grant admin'; end if;
 begin
  perform public.crm_platform_organizations();
  raise exception 'Unprivileged platform read';
 exception when raise_exception then if sqlerrm='Unprivileged platform read' then raise; end if; end;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
do $$ declare r jsonb; stamp timestamptz; begin
 if not public.crm_platform_status() then raise exception 'Confirmed bootstrap failed'; end if;
 if (select count(*) from public.crm_platform_organizations())<>2 then raise exception 'Platform organizations missing'; end if;
 if (select count(*) from public.crm_records where app_id='22222222-2222-4222-8222-222222222222')<>0 then raise exception 'Platform bypassed business RLS'; end if;
 select updated_at into stamp from public.crm_records where id='33333333-3333-4333-8333-333333333333';
 r:=public.crm_patch_record('33333333-3333-4333-8333-333333333333','{"first":"one"}',stamp);
 r:=public.crm_patch_record('33333333-3333-4333-8333-333333333333','{"second":"two"}',(r->>'updated_at')::timestamptz);
 if r->'data'->>'first'<>'one' or r->'data'->>'second'<>'two' then raise exception 'Patch lost unrelated field'; end if;
 begin
  perform public.crm_patch_record('33333333-3333-4333-8333-333333333333','{"stale":true}',stamp);
  raise exception 'Stale overwrite accepted';
 exception when sqlstate 'PT409' then null; end;
 if (select data ? 'stale' from public.crm_records where id='33333333-3333-4333-8333-333333333333')
 then raise exception 'Rejected stale patch changed the record'; end if;
 begin
  perform public.crm_patch_record('44444444-4444-4444-8444-444444444444','{"cross":true}');
  raise exception 'Cross tenant patch accepted';
 exception when raise_exception then if sqlerrm='Cross tenant patch accepted' then raise; end if; end;
end $$;
reset role;
-- Even a second confirmed identity with the reserved address cannot reclaim it.
update auth.users set email='villaseca.managements@gmail.com',email_confirmed_at=now() where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin if public.crm_platform_status() then raise exception 'Bootstrap reused'; end if; end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 if (select array_agg(version) from public.crm_visible_versions('11111111-1111-4111-8111-111111111111')) is distinct from array[2] then raise exception 'Member current blueprint missing or history exposed'; end if;
 if (select count(*) from public.crm_visible_versions('22222222-2222-4222-8222-222222222222'))<>0 then raise exception 'Cross tenant blueprint'; end if;
 if (public.crm_workspace_access('11111111-1111-4111-8111-111111111111')->>'can_edit')::boolean then raise exception 'Viewer edit granted'; end if;
 if public.crm_workspace_access('22222222-2222-4222-8222-222222222222') is not null then raise exception 'Other workspace visible'; end if;
 begin
  perform public.crm_patch_record('33333333-3333-4333-8333-333333333333','{"viewer":true}');
  raise exception 'Viewer patch accepted';
 exception when insufficient_privilege then null;
 when raise_exception then if sqlerrm='Viewer patch accepted' then raise; end if; end;
end $$;
rollback;
