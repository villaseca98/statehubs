-- Phase 09 rollback: run ONLY if no collaboration has been enabled.
-- Existing crm_apps, crm_records, blueprints and their IDs remain intact.
do $$
begin
 if exists (select 1 from public.crm_org_members where role <> 'owner') then
   raise exception 'Rollback blocked: agency members exist; export and migrate them first';
 end if;
end $$;
drop policy if exists crm_apps_member_select on public.crm_apps;
drop policy if exists crm_records_select on public.crm_records;
drop policy if exists crm_records_insert on public.crm_records;
drop policy if exists crm_records_update on public.crm_records;
drop policy if exists crm_records_delete on public.crm_records;
create policy crm_records_all on public.crm_records for all
 using (public.crm_owns_app(app_id)) with check (public.crm_owns_app(app_id));
drop trigger if exists crm_set_record_org on public.crm_records;
drop trigger if exists crm_set_app_org on public.crm_apps;
drop function if exists public.crm_set_record_org();
drop function if exists public.crm_set_app_org();
drop function if exists public.crm_set_org_member(uuid,uuid,text);
drop function if exists public.crm_remove_org_member(uuid,uuid);
drop function if exists public.crm_can_access_app(uuid,boolean);
drop function if exists public.crm_org_role(uuid);
alter table public.crm_records drop constraint if exists crm_records_app_org_fk;
alter table public.crm_records drop column if exists org_id;
alter table public.crm_apps drop constraint if exists crm_apps_id_org_unique;
alter table public.crm_apps drop column if exists org_id;
drop table if exists public.crm_org_members;
drop table if exists public.crm_organizations;
revoke update on public.crm_records from authenticated;
grant update on public.crm_records to authenticated;
revoke update on public.crm_apps from authenticated;
grant update(name,updated_at) on public.crm_apps to authenticated;
