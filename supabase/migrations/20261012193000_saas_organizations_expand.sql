-- Phase 09 / expand: preserve all existing app and record IDs.
-- One organization per existing owner; multiple apps can belong to one agency.
create table if not exists public.crm_organizations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check (length(trim(name)) between 1 and 100),
 settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists crm_organizations_owner_unique on public.crm_organizations(owner_id);
create table if not exists public.crm_org_members (
 org_id uuid not null references public.crm_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','agent','viewer')),
 joined_at timestamptz not null default now(),
 primary key (org_id,user_id)
);
create index if not exists crm_org_members_user_idx on public.crm_org_members(user_id,org_id);
create unique index if not exists crm_org_members_one_owner_idx on public.crm_org_members(org_id) where role='owner';

alter table public.crm_apps add column if not exists org_id uuid references public.crm_organizations(id) on delete restrict;
create index if not exists crm_apps_org_idx on public.crm_apps(org_id);
-- Backfill existing owners without overwriting any existing records.
insert into public.crm_organizations(owner_id,name)
select distinct a.owner_id,'Inmobiliaria de '||left(a.owner_id::text,8)
from public.crm_apps a
where not exists (select 1 from public.crm_organizations o where o.owner_id=a.owner_id)
on conflict (owner_id) do nothing;
insert into public.crm_org_members(org_id,user_id,role)
select id,owner_id,'owner' from public.crm_organizations
on conflict (org_id,user_id) do nothing;
update public.crm_apps a set org_id=o.id
from public.crm_organizations o where a.owner_id=o.owner_id and a.org_id is null;

-- Each record inherits the agency through its existing app FK. Composite FK
-- prevents cross-agency reassignment even if a privileged integration writes.
alter table public.crm_apps add constraint crm_apps_id_org_unique unique (id,org_id);
alter table public.crm_records add column if not exists org_id uuid;
update public.crm_records r set org_id=a.org_id from public.crm_apps a
where r.app_id=a.id and r.org_id is null;
alter table public.crm_records add constraint crm_records_app_org_fk
 foreign key (app_id,org_id) references public.crm_apps(id,org_id) on update restrict on delete cascade;
create index if not exists crm_records_org_entity_idx on public.crm_records(org_id,entity,created_at desc);

-- SECURITY DEFINER avoids recursive RLS checks on membership.
create or replace function public.crm_org_role(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
 select m.role from public.crm_org_members m
 where m.org_id=p_org and m.user_id=(select auth.uid()) limit 1;
$$;
create or replace function public.crm_can_access_app(p_app uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.crm_apps a join public.crm_org_members m
   on m.org_id=a.org_id and m.user_id=(select auth.uid())
   where a.id=p_app and (not p_write or m.role in ('owner','admin','agent')));
$$;
revoke all on function public.crm_org_role(uuid) from public,anon;
revoke all on function public.crm_can_access_app(uuid,boolean) from public,anon;
grant execute on function public.crm_org_role(uuid) to authenticated;
grant execute on function public.crm_can_access_app(uuid,boolean) to authenticated;

-- New apps get an agency automatically. Prevent agency/owner reassignment.
create or replace function public.crm_set_app_org()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_org uuid;
begin
 if tg_op='UPDATE' then
   if new.owner_id is distinct from old.owner_id or new.org_id is distinct from old.org_id then
     raise exception 'App ownership and organization are immutable';
   end if;
   return new;
 end if;
 select o.id into target_org from public.crm_organizations o where o.owner_id=new.owner_id;
 if target_org is null then
   insert into public.crm_organizations(owner_id,name)
   values(new.owner_id,'Mi inmobiliaria') on conflict(owner_id) do update set owner_id=excluded.owner_id
   returning id into target_org;
 end if;
 insert into public.crm_org_members(org_id,user_id,role) values(target_org,new.owner_id,'owner')
 on conflict(org_id,user_id) do nothing;
 if new.org_id is not null and new.org_id<>target_org then raise exception 'Invalid organization'; end if;
 new.org_id:=target_org;
 return new;
end $$;
drop trigger if exists crm_set_app_org on public.crm_apps;
create trigger crm_set_app_org before insert or update on public.crm_apps
for each row execute function public.crm_set_app_org();

create or replace function public.crm_set_record_org()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_org uuid;
begin
 if tg_op='UPDATE' and (new.app_id is distinct from old.app_id or new.org_id is distinct from old.org_id)
 then raise exception 'Record agency and app are immutable'; end if;
 select a.org_id into target_org from public.crm_apps a where a.id=new.app_id;
 if target_org is null then raise exception 'Unknown application organization'; end if;
 if new.org_id is not null and new.org_id<>target_org then raise exception 'Invalid record organization'; end if;
 new.org_id:=target_org;
 return new;
end $$;
drop trigger if exists crm_set_record_org on public.crm_records;
create trigger crm_set_record_org before insert or update on public.crm_records
for each row execute function public.crm_set_record_org();

-- Lock down columns even when RLS permits updates to record data.
revoke update on public.crm_apps from authenticated;
grant update(name,updated_at) on public.crm_apps to authenticated;
revoke update on public.crm_records from authenticated;
grant update(data,updated_at) on public.crm_records to authenticated;

alter table public.crm_organizations enable row level security;
alter table public.crm_org_members enable row level security;
create policy crm_org_select on public.crm_organizations for select to authenticated
 using (public.crm_org_role(id) is not null);
create policy crm_org_update on public.crm_organizations for update to authenticated
 using (public.crm_org_role(id) in ('owner','admin'))
 with check (public.crm_org_role(id) in ('owner','admin'));
-- Only RPCs manage membership; never grant table INSERT/UPDATE/DELETE.
create policy crm_org_members_select on public.crm_org_members for select to authenticated
 using (public.crm_org_role(org_id) is not null);
revoke insert,update,delete on public.crm_org_members from anon,authenticated;
revoke insert,delete on public.crm_organizations from anon,authenticated;
revoke update on public.crm_organizations from authenticated;
grant update(name,settings,updated_at) on public.crm_organizations to authenticated;

-- Existing owner access remains valid. Add member visibility to apps and
-- records; do not grant members blueprint/proposal admin RPCs yet.
create policy crm_apps_member_select on public.crm_apps for select to authenticated
 using (public.crm_can_access_app(id,false));
drop policy if exists crm_records_all on public.crm_records;
create policy crm_records_select on public.crm_records for select to authenticated
 using (public.crm_can_access_app(app_id,false));
create policy crm_records_insert on public.crm_records for insert to authenticated
 with check (public.crm_can_access_app(app_id,true));
create policy crm_records_update on public.crm_records for update to authenticated
 using (public.crm_can_access_app(app_id,true))
 with check (public.crm_can_access_app(app_id,true));
create policy crm_records_delete on public.crm_records for delete to authenticated
 using (public.crm_org_role(org_id) in ('owner','admin'));

-- Admins/owners can add existing auth users; prevent owner escalation and
-- owner removal. No public user enumeration endpoint.
create or replace function public.crm_set_org_member(p_org uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.crm_org_role(p_org) not in ('owner','admin') then raise exception 'Forbidden'; end if;
 if p_role not in ('admin','agent','viewer') then raise exception 'Invalid role'; end if;
 if p_user=(select owner_id from public.crm_organizations where id=p_org) then raise exception 'Cannot change owner'; end if;
 insert into public.crm_org_members(org_id,user_id,role) values(p_org,p_user,p_role)
 on conflict(org_id,user_id) do update set role=excluded.role;
end $$;
create or replace function public.crm_remove_org_member(p_org uuid,p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.crm_org_role(p_org) not in ('owner','admin') then raise exception 'Forbidden'; end if;
 delete from public.crm_org_members where org_id=p_org and user_id=p_user and role<>'owner';
end $$;
revoke all on function public.crm_set_org_member(uuid,uuid,text) from public,anon;
revoke all on function public.crm_remove_org_member(uuid,uuid) from public,anon;
grant execute on function public.crm_set_org_member(uuid,uuid,text) to authenticated;
grant execute on function public.crm_remove_org_member(uuid,uuid) to authenticated;

-- Deferred hardening after auditing preexisting data; never delete it.
-- Verify no nulls before a later NOT NULL constraint:
-- select count(*) from crm_apps where org_id is null;
-- select count(*) from crm_records where org_id is null;
