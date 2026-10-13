-- Additive operational access. No data rewrites or ownership changes.
-- Bootstrap is consumed once, from a server-verified auth.users email only.
create table public.crm_platform_admins (
 user_id uuid primary key references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.crm_platform_bootstrap (
 email text primary key check (email = lower(email)),
 claimed_user_id uuid unique references auth.users(id) on delete restrict,
 claimed_at timestamptz
);
insert into public.crm_platform_bootstrap(email) values ('villaseca.managements@gmail.com');
alter table public.crm_platform_admins enable row level security;
alter table public.crm_platform_bootstrap enable row level security;
revoke all on public.crm_platform_admins,public.crm_platform_bootstrap from public,anon,authenticated;

create function public.crm_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.crm_platform_admins where user_id=auth.uid());
$$;
revoke all on function public.crm_is_platform_admin() from public,anon;
grant execute on function public.crm_is_platform_admin() to authenticated;

create function public.crm_platform_status()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text; v_claim uuid; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select lower(email) into v_email from auth.users
 where id=v_user and email_confirmed_at is not null;
 if v_email is not null then
  select claimed_user_id into v_claim from public.crm_platform_bootstrap
  where email=v_email for update;
  if found and (v_claim is null or v_claim=v_user) then
   insert into public.crm_platform_admins(user_id) values(v_user) on conflict do nothing;
   update public.crm_platform_bootstrap set claimed_user_id=v_user,claimed_at=coalesce(claimed_at,now())
    where email=v_email;
  end if;
 end if;
 return public.crm_is_platform_admin();
end $$;
revoke all on function public.crm_platform_status() from public,anon;
grant execute on function public.crm_platform_status() to authenticated;

-- Platform administration is explicit, separate from agency business-data RLS.
-- No impersonation, token access or SQL-superuser privilege is granted.
create function public.crm_platform_organizations()
returns table(id uuid,name text,owner_id uuid,settings jsonb,updated_at timestamptz,member_count bigint,app_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.crm_is_platform_admin() then raise exception 'Forbidden'; end if;
 return query select o.id,o.name,o.owner_id,o.settings,o.updated_at,
  (select count(*) from public.crm_org_members m where m.org_id=o.id),
  (select count(*) from public.crm_apps a where a.org_id=o.id)
 from public.crm_organizations o order by o.created_at desc;
end $$;
revoke all on function public.crm_platform_organizations() from public,anon;
grant execute on function public.crm_platform_organizations() to authenticated;

create function public.crm_organization_members(p_org uuid)
returns setof public.crm_org_members language plpgsql stable security definer set search_path = '' as $$
begin
 if public.crm_org_role(p_org) is null and not public.crm_is_platform_admin()
 then raise exception 'Forbidden'; end if;
 return query select * from public.crm_org_members where org_id=p_org order by joined_at;
end $$;
revoke all on function public.crm_organization_members(uuid) from public,anon;
grant execute on function public.crm_organization_members(uuid) to authenticated;

create or replace function public.crm_set_org_member(p_org uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_org is null or p_user is null or
  (coalesce(public.crm_org_role(p_org),'') not in ('owner','admin') and not public.crm_is_platform_admin())
 then raise exception 'Forbidden'; end if;
 if p_role is null or p_role not in ('admin','agent','viewer') then raise exception 'Invalid role'; end if;
 if p_user=(select owner_id from public.crm_organizations where id=p_org) then raise exception 'Cannot change owner'; end if;
 insert into public.crm_org_members(org_id,user_id,role) values(p_org,p_user,p_role)
 on conflict(org_id,user_id) do update set role=excluded.role;
end $$;
create or replace function public.crm_remove_org_member(p_org uuid,p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_org is null or p_user is null or
  (coalesce(public.crm_org_role(p_org),'') not in ('owner','admin') and not public.crm_is_platform_admin())
 then raise exception 'Forbidden'; end if;
 delete from public.crm_org_members where org_id=p_org and user_id=p_user and role<>'owner';
end $$;

create function public.crm_workspace_access(p_app uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('role',public.crm_org_role(a.org_id),
  'can_edit',public.crm_can_access_app(a.id,true),
  'can_delete',public.crm_org_role(a.org_id) in ('owner','admin'),
  'can_manage',a.owner_id=auth.uid())
 from public.crm_apps a where a.id=p_app and public.crm_can_access_app(a.id,false);
$$;
revoke all on function public.crm_workspace_access(uuid) from public,anon;
grant execute on function public.crm_workspace_access(uuid) to authenticated;

-- Members need the current runtime blueprint, not proposal/history privileges.
create function public.crm_visible_versions(p_app uuid)
returns table(version integer,summary text,created_at timestamptz,blueprint jsonb)
language sql stable security definer set search_path = '' as $$
 select v.version,v.summary,v.created_at,v.blueprint
 from public.crm_app_versions v join public.crm_apps a on a.id=v.app_id
 where a.id=p_app and public.crm_can_access_app(a.id,false)
 and (a.owner_id=auth.uid() or v.version=a.current_version)
 order by v.version desc;
$$;
revoke all on function public.crm_visible_versions(uuid) from public,anon;
grant execute on function public.crm_visible_versions(uuid) to authenticated;

-- Invoker RLS is retained; lock, compare and patch occur in one transaction.
create function public.crm_patch_record(p_id uuid,p_patch jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.crm_records;
begin
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid record patch'; end if;
 select * into r from public.crm_records where id=p_id for update;
 if not found or not public.crm_can_access_app(r.app_id,true) then raise exception 'Record unavailable or read only'; end if;
 if p_expected_updated_at is not null and r.updated_at is distinct from p_expected_updated_at
 then raise exception 'Record changed; reload before saving' using errcode='40001'; end if;
 update public.crm_records set data=data||p_patch,updated_at=clock_timestamp() where id=p_id returning * into r;
 if not found then raise exception 'Record unavailable or read only'; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.crm_patch_record(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.crm_patch_record(uuid,jsonb,timestamptz) to authenticated;
