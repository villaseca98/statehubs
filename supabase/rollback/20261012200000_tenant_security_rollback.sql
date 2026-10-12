-- Phase 10 guarded rollback, BEFORE public invitation/collaboration rollout.
-- Preserve app/record IDs and tenant tables. Reverts only Phase 10 changes.
-- Security downgrade: do NOT execute after activating real agency memberships.
begin;
do $$
begin
 if exists(select 1 from public.crm_org_members where role<>'owner') then
  raise exception 'Phase 10 rollback refused while invited agency members exist';
 end if;
end $$;
alter table public.crm_apps alter column org_id drop not null;
alter table public.crm_records alter column org_id drop not null;
drop policy if exists crm_records_select on public.crm_records;
drop policy if exists crm_records_insert on public.crm_records;
drop policy if exists crm_records_update on public.crm_records;
drop policy if exists crm_records_delete on public.crm_records;
create policy crm_records_select on public.crm_records for select to authenticated
 using (public.crm_can_access_app(app_id,false));
create policy crm_records_insert on public.crm_records for insert to authenticated
 with check(public.crm_can_access_app(app_id,true));
create policy crm_records_update on public.crm_records for update to authenticated
 using(public.crm_can_access_app(app_id,true))
 with check(public.crm_can_access_app(app_id,true));
create policy crm_records_delete on public.crm_records for delete to authenticated
 using(public.crm_org_role(org_id) in ('owner','admin'));
drop policy if exists crm_property_media_select on storage.objects;
drop policy if exists crm_property_media_insert on storage.objects;
drop policy if exists crm_property_media_delete on storage.objects;
create policy crm_property_media_select on storage.objects for select to authenticated
 using (bucket_id='crm-property-media'
   and public.crm_owns_app(split_part(name,'/',1)::uuid)
   and exists(select 1 from public.crm_records r where r.id::text=split_part(name,'/',2)
     and r.app_id::text=split_part(name,'/',1) and r.entity in ('inmueble','alojamiento')));
create policy crm_property_media_insert on storage.objects for insert to authenticated
 with check(bucket_id='crm-property-media'
   and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|pdf)$'
   and public.crm_owns_app(split_part(name,'/',1)::uuid)
   and exists(select 1 from public.crm_records r where r.id::text=split_part(name,'/',2)
     and r.app_id::text=split_part(name,'/',1) and r.entity in ('inmueble','alojamiento')));
create policy crm_property_media_delete on storage.objects for delete to authenticated
 using(bucket_id='crm-property-media'
   and public.crm_owns_app(split_part(name,'/',1)::uuid)
   and exists(select 1 from public.crm_records r where r.id::text=split_part(name,'/',2)
     and r.app_id::text=split_part(name,'/',1) and r.entity in ('inmueble','alojamiento')));
drop function if exists public.crm_media_can_delete(text);
drop function if exists public.crm_media_allowed(text,boolean);
-- More restrictive object privileges, search_path hardening and secret isolation
-- remain in effect intentionally (safer than restoring PUBLIC execute).
commit;
