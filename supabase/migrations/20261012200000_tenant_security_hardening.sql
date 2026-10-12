-- Phase 10: tenant security lockdown. REQUIRES Phase 09 expansion.
-- No data is deleted. Run the negative PostgreSQL test suite before enabling collaboration.

do $guard$
begin
  if to_regclass('public.crm_organizations') is null or
     to_regclass('public.crm_org_members') is null or
     not exists (select 1 from information_schema.columns where table_schema='public' and table_name='crm_records' and column_name='org_id')
  then raise exception 'Apply Phase 09 migration before Phase 10'; end if;
  if exists (select 1 from public.crm_apps where org_id is null) or
     exists (select 1 from public.crm_records where org_id is null)
  then raise exception 'Tenant backfill incomplete; resolve null org_id before hardening'; end if;
end
$guard$;

-- Fail closed on records without an organization. BEFORE INSERT trigger from
-- Phase 09 assigns org_id to inserts made by existing CRM RPCs.
alter table public.crm_apps alter column org_id set not null;
alter table public.crm_records alter column org_id set not null;

-- SECURITY DEFINER functions must never resolve mutable unqualified objects.
alter function public.crm_owns_app(uuid) set search_path = '';
alter function public.crm_apply_proposal(uuid) set search_path = '';
alter function public.crm_restore_version(uuid,integer) set search_path = '';
alter function public.crm_discard_proposal(uuid) set search_path = '';
alter function public.crm_clear_samples(uuid) set search_path = '';

-- Explicit RPC privileges; functions default to EXECUTE for PUBLIC unless revoked.
revoke all on function public.crm_owns_app(uuid) from public,anon;
grant execute on function public.crm_owns_app(uuid) to authenticated;
revoke all on function public.crm_apply_proposal(uuid) from public,anon;
revoke all on function public.crm_restore_version(uuid,integer) from public,anon;
revoke all on function public.crm_discard_proposal(uuid) from public,anon;
revoke all on function public.crm_clear_samples(uuid) from public,anon;
grant execute on function public.crm_apply_proposal(uuid) to authenticated;
grant execute on function public.crm_restore_version(uuid,integer) to authenticated;
grant execute on function public.crm_discard_proposal(uuid) to authenticated;
grant execute on function public.crm_clear_samples(uuid) to authenticated;
-- Trigger implementations are not user-callable RPCs.
revoke all on function public.crm_set_app_org() from public,anon,authenticated;
revoke all on function public.crm_set_record_org() from public,anon,authenticated;
revoke all on function public.crm_protect_external_record_fields() from public,anon,authenticated;

-- Explicit client table privileges complement tenant RLS. Secrets and
-- webhook idempotency tables stay backend/service-role only.
revoke all on public.crm_apps,public.crm_records,public.crm_app_versions,
  public.crm_proposals,public.crm_messages,public.crm_organizations,
  public.crm_org_members from anon,authenticated;
grant select,insert,delete on public.crm_apps to authenticated;
grant update(name,updated_at) on public.crm_apps to authenticated;
grant select,insert,delete on public.crm_records to authenticated;
grant update(data,updated_at) on public.crm_records to authenticated;
grant select on public.crm_app_versions,public.crm_proposals,public.crm_messages to authenticated;
grant select on public.crm_organizations to authenticated;
grant update(name,settings,updated_at) on public.crm_organizations to authenticated;
grant select on public.crm_org_members to authenticated;
revoke all on public.crm_google_accounts,public.crm_instagram_accounts,
  public.crm_instagram_events from anon,authenticated;

-- Ensure RLS is active even if a prior change disabled it.
alter table public.crm_apps enable row level security;
alter table public.crm_records enable row level security;
alter table public.crm_app_versions enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_organizations enable row level security;
alter table public.crm_org_members enable row level security;
alter table public.crm_google_accounts enable row level security;
alter table public.crm_instagram_accounts enable row level security;
alter table public.crm_instagram_events enable row level security;

-- Members can only read their agency's apps; owners still exclusively manage
-- apps, blueprints, proposals and integration credentials.
drop policy if exists crm_apps_member_select on public.crm_apps;
create policy crm_apps_member_select on public.crm_apps for select to authenticated
 using (public.crm_can_access_app(id,false));
drop policy if exists crm_records_select on public.crm_records;
drop policy if exists crm_records_insert on public.crm_records;
drop policy if exists crm_records_update on public.crm_records;
drop policy if exists crm_records_delete on public.crm_records;
create policy crm_records_select on public.crm_records for select to authenticated
 using (public.crm_can_access_app(app_id,false)
   and org_id=(select org_id from public.crm_apps a where a.id=app_id));
create policy crm_records_insert on public.crm_records for insert to authenticated
 with check (public.crm_can_access_app(app_id,true)
   and org_id=(select org_id from public.crm_apps a where a.id=app_id));
create policy crm_records_update on public.crm_records for update to authenticated
 using (public.crm_can_access_app(app_id,true)
   and org_id=(select org_id from public.crm_apps a where a.id=app_id))
 with check (public.crm_can_access_app(app_id,true)
   and org_id=(select org_id from public.crm_apps a where a.id=app_id));
create policy crm_records_delete on public.crm_records for delete to authenticated
 using (public.crm_org_role(org_id) in ('owner','admin')
   and public.crm_can_access_app(app_id,true));

-- Phase 09 RPCs used NOT IN on nullable roles. In PL/pgSQL, IF NULL
-- skips the branch: unknown organization IDs could bypass authorization.
-- Fail closed explicitly for null/foreign organization IDs.
create or replace function public.crm_set_org_member(p_org uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $
begin
 if p_org is null or p_user is null or
    coalesce(public.crm_org_role(p_org),'') not in ('owner','admin')
 then raise exception 'Forbidden'; end if;
 if p_role not in ('admin','agent','viewer') then raise exception 'Invalid role'; end if;
 if p_user=(select owner_id from public.crm_organizations where id=p_org)
 then raise exception 'Cannot change owner'; end if;
 insert into public.crm_org_members(org_id,user_id,role)
 values(p_org,p_user,p_role)
 on conflict(org_id,user_id) do update set role=excluded.role;
end $;
create or replace function public.crm_remove_org_member(p_org uuid,p_user uuid)
returns void language plpgsql security definer set search_path = '' as $
begin
 if p_org is null or p_user is null or
    coalesce(public.crm_org_role(p_org),'') not in ('owner','admin')
 then raise exception 'Forbidden'; end if;
 delete from public.crm_org_members where org_id=p_org and user_id=p_user and role<>'owner';
end $;
revoke all on function public.crm_set_org_member(uuid,uuid,text) from public,anon;
revoke all on function public.crm_remove_org_member(uuid,uuid) from public,anon;
grant execute on function public.crm_set_org_member(uuid,uuid,text) to authenticated;
grant execute on function public.crm_remove_org_member(uuid,uuid) to authenticated;

-- Strict private storage path check; invalid paths must not throw on cast.
-- This helper uses fixed search_path + auth.uid, never accepts a user ID.
create or replace function public.crm_media_allowed(p_path text, p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_app uuid; v_record uuid;
begin
  if p_path is null or p_path !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|png|webp|pdf)$'
  then return false; end if;
  v_app := split_part(p_path,'/',1)::uuid;
  v_record := split_part(p_path,'/',2)::uuid;
  return public.crm_can_access_app(v_app,p_write) and exists (
    select 1 from public.crm_records r
    join public.crm_apps a on a.id=r.app_id and a.org_id=r.org_id
    where r.id=v_record and r.app_id=v_app and r.entity in ('inmueble','alojamiento')
  );
end $$;
revoke all on function public.crm_media_allowed(text,boolean) from public,anon;
grant execute on function public.crm_media_allowed(text,boolean) to authenticated;

-- Only owner/admin can delete. Reuse safe UUID parser from crm_media_allowed
-- and resolve the org through a constrained record, not an untrusted cast.
create or replace function public.crm_media_can_delete(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_app uuid; v_record uuid; v_org uuid;
begin
 if not public.crm_media_allowed(p_path,true) then return false; end if;
 v_app := split_part(p_path,'/',1)::uuid;
 v_record := split_part(p_path,'/',2)::uuid;
 select r.org_id into v_org from public.crm_records r
 where r.id=v_record and r.app_id=v_app;
 return public.crm_org_role(v_org) in ('owner','admin');
end $$;
revoke all on function public.crm_media_can_delete(text) from public,anon;
grant execute on function public.crm_media_can_delete(text) to authenticated;

-- Supabase Storage is shared by all buckets: change policies only for ours.
-- Signed downloads still require SELECT RLS; no PUBLIC bucket access.
alter table storage.objects enable row level security;
update storage.buckets set public=false where id='crm-property-media';
drop policy if exists crm_property_media_select on storage.objects;
drop policy if exists crm_property_media_insert on storage.objects;
drop policy if exists crm_property_media_delete on storage.objects;
drop policy if exists crm_property_media_update on storage.objects;
create policy crm_property_media_select on storage.objects for select to authenticated
 using (bucket_id='crm-property-media' and public.crm_media_allowed(name,false));
create policy crm_property_media_insert on storage.objects for insert to authenticated
 with check (bucket_id='crm-property-media' and public.crm_media_allowed(name,true));
create policy crm_property_media_delete on storage.objects for delete to authenticated
 using (bucket_id='crm-property-media'
   and public.crm_media_can_delete(name));
-- No UPDATE or public policy is created for the property bucket.
