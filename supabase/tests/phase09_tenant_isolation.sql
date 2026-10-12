-- Run in a disposable STAGING database after Phase 09 expand.
-- Uses two preexisting owners/apps; read-only and rolls back.
begin;
do $$
declare a record; b record;
begin
 select id,owner_id,org_id into a from public.crm_apps where org_id is not null limit 1;
 select id,owner_id,org_id into b from public.crm_apps where org_id<>a.org_id and owner_id<>a.owner_id limit 1;
 if a.id is null or b.id is null then raise exception 'Need two agencies and apps in staging'; end if;
 perform set_config('app.test_a',a.id::text,true);
 perform set_config('app.test_b',b.id::text,true);
 perform set_config('app.test_org_a',a.org_id::text,true);
 perform set_config('app.test_org_b',b.org_id::text,true);
 perform set_config('app.test_user_a',a.owner_id::text,true);
 perform set_config('app.test_user_b',b.owner_id::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',current_setting('app.test_user_a'),true);
do $$
begin
 if (select count(*) from public.crm_apps where id=current_setting('app.test_a')::uuid)<>1 then raise exception 'A cannot read own app'; end if;
 if (select count(*) from public.crm_apps where id=current_setting('app.test_b')::uuid)<>0 then raise exception 'A reads B app'; end if;
 if (select count(*) from public.crm_organizations where id=current_setting('app.test_org_b')::uuid)<>0 then raise exception 'A reads B organization'; end if;
 if (select count(*) from public.crm_org_members where org_id=current_setting('app.test_org_b')::uuid)<>0 then raise exception 'A reads B membership'; end if;
 if (select count(*) from public.crm_records where app_id=current_setting('app.test_b')::uuid)<>0 then raise exception 'A reads B records'; end if;
 if public.crm_can_access_app(current_setting('app.test_b')::uuid,true) then raise exception 'A can write B'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('app.test_user_b'),true);
do $$
begin
 if (select count(*) from public.crm_apps where id=current_setting('app.test_b')::uuid)<>1 then raise exception 'B cannot read own app'; end if;
 if (select count(*) from public.crm_apps where id=current_setting('app.test_a')::uuid)<>0 then raise exception 'B reads A app'; end if;
 if (select count(*) from public.crm_organizations where id=current_setting('app.test_org_a')::uuid)<>0 then raise exception 'B reads A organization'; end if;
 if (select count(*) from public.crm_records where app_id=current_setting('app.test_a')::uuid)<>0 then raise exception 'B reads A records'; end if;
 if public.crm_can_access_app(current_setting('app.test_a')::uuid,true) then raise exception 'B can write A'; end if;
end $$;
reset role;
rollback;
-- Separately test rejected cross-tenant INSERT/UPDATE/DELETE with real JWTs
-- and ensure service-role Edge Functions validate app ownership explicitly.
