-- MewHub CRM/ERP builder.
-- An app is a blueprint (JSON) plus records. Every applied change is a new
-- version; undo restores an older one as yet another version, so nothing is lost.
-- Blueprints only change through crm_apply_proposal / crm_restore_version.

create table if not exists public.crm_apps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Nueva aplicación' check (char_length(name) between 1 and 80),
  current_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_apps_owner_idx on public.crm_apps(owner_id);

create table if not exists public.crm_app_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.crm_apps(id) on delete cascade,
  version integer not null,
  blueprint jsonb not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (app_id, version)
);

create table if not exists public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.crm_apps(id) on delete cascade,
  base_version integer,
  blueprint jsonb not null,
  summary text not null default '',
  changes jsonb not null default '[]'::jsonb,
  samples jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'applied', 'discarded')),
  created_at timestamptz not null default now()
);
create index if not exists crm_proposals_app_idx on public.crm_proposals(app_id, created_at);

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.crm_apps(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  proposal_id uuid references public.crm_proposals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_messages_app_idx on public.crm_messages(app_id, created_at);

create table if not exists public.crm_records (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.crm_apps(id) on delete cascade,
  entity text not null,
  data jsonb not null default '{}'::jsonb,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_records_app_entity_idx on public.crm_records(app_id, entity);

-- [SECURITY] Row level security: each person only sees their own apps and data.
alter table public.crm_apps enable row level security;
alter table public.crm_app_versions enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_records enable row level security;

create or replace function public.crm_owns_app(p_app uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_apps where id = p_app and owner_id = auth.uid());
$$;

drop policy if exists crm_apps_select on public.crm_apps;
create policy crm_apps_select on public.crm_apps for select using (owner_id = auth.uid());
drop policy if exists crm_apps_insert on public.crm_apps;
create policy crm_apps_insert on public.crm_apps for insert with check (owner_id = auth.uid() and current_version is null);
drop policy if exists crm_apps_update on public.crm_apps;
create policy crm_apps_update on public.crm_apps for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists crm_apps_delete on public.crm_apps;
create policy crm_apps_delete on public.crm_apps for delete using (owner_id = auth.uid());
-- [SECURITY] People may rename an app, but the version pointer only moves through the functions below.
revoke update on public.crm_apps from anon, authenticated;
grant update (name, updated_at) on public.crm_apps to authenticated;

drop policy if exists crm_versions_select on public.crm_app_versions;
create policy crm_versions_select on public.crm_app_versions for select using (public.crm_owns_app(app_id));
drop policy if exists crm_proposals_select on public.crm_proposals;
create policy crm_proposals_select on public.crm_proposals for select using (public.crm_owns_app(app_id));
drop policy if exists crm_messages_select on public.crm_messages;
create policy crm_messages_select on public.crm_messages for select using (public.crm_owns_app(app_id));

drop policy if exists crm_records_all on public.crm_records;
create policy crm_records_all on public.crm_records for all
  using (public.crm_owns_app(app_id)) with check (public.crm_owns_app(app_id));

-- Apply a pending proposal. Refuses if the app changed since the proposal was
-- made, so nobody applies a change computed against an older version.
create or replace function public.crm_apply_proposal(p_proposal uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  p public.crm_proposals;
  a public.crm_apps;
  next_version integer;
begin
  select * into p from public.crm_proposals where id = p_proposal for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  select * into a from public.crm_apps where id = p.app_id for update;
  -- [SECURITY] Only the owner can apply.
  if a.owner_id is distinct from auth.uid() then raise exception 'Propuesta no encontrada'; end if;
  if p.status <> 'pending' then raise exception 'Esta propuesta ya no está pendiente'; end if;
  if a.current_version is distinct from p.base_version then
    raise exception 'La aplicación ha cambiado desde esta propuesta; pide el cambio otra vez';
  end if;

  next_version := coalesce((select max(version) from public.crm_app_versions where app_id = a.id), 0) + 1;
  insert into public.crm_app_versions (app_id, version, blueprint, summary)
    values (a.id, next_version, p.blueprint, p.summary);
  update public.crm_apps
    set current_version = next_version,
        name = coalesce(left(nullif(p.blueprint->>'name', ''), 80), name),
        updated_at = now()
    where id = a.id;

  -- Card proposals carry ids (made by crm-agent) so sample rows can link to each other.
  insert into public.crm_records (id, app_id, entity, data, is_sample)
    select coalesce((s->>'id')::uuid, gen_random_uuid()), a.id, s->>'entity', coalesce(s->'data', '{}'::jsonb), true
    from jsonb_array_elements(p.samples) s
    where s ? 'entity';

  update public.crm_proposals set status = 'applied' where id = p.id;
  update public.crm_proposals set status = 'discarded' where app_id = a.id and status = 'pending' and id <> p.id;
  return next_version;
end $$;

-- Undo = restore an earlier version as a new version. History is never rewritten.
create or replace function public.crm_restore_version(p_app uuid, p_version integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  a public.crm_apps;
  v public.crm_app_versions;
  next_version integer;
begin
  select * into a from public.crm_apps where id = p_app for update;
  -- [SECURITY] Only the owner can restore.
  if not found or a.owner_id is distinct from auth.uid() then raise exception 'Aplicación no encontrada'; end if;
  select * into v from public.crm_app_versions where app_id = p_app and version = p_version;
  if not found then raise exception 'Esa versión no existe'; end if;
  if a.current_version = p_version then raise exception 'Esa ya es la versión actual'; end if;

  next_version := coalesce((select max(version) from public.crm_app_versions where app_id = a.id), 0) + 1;
  insert into public.crm_app_versions (app_id, version, blueprint, summary)
    values (a.id, next_version, v.blueprint, 'Vuelta a la versión ' || p_version);
  update public.crm_apps set current_version = next_version, updated_at = now() where id = a.id;
  update public.crm_proposals set status = 'discarded' where app_id = a.id and status = 'pending';
  return next_version;
end $$;

create or replace function public.crm_discard_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.crm_proposals p set status = 'discarded'
    where p.id = p_proposal and p.status = 'pending'
      and exists (select 1 from public.crm_apps a where a.id = p.app_id and a.owner_id = auth.uid());
end $$;

-- Sample records can be cleared in one go once the person adds real data.
create or replace function public.crm_clear_samples(p_app uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.crm_owns_app(p_app) then raise exception 'Aplicación no encontrada'; end if;
  delete from public.crm_records where app_id = p_app and is_sample;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.crm_apply_proposal(uuid) from public, anon;
revoke execute on function public.crm_restore_version(uuid, integer) from public, anon;
revoke execute on function public.crm_discard_proposal(uuid) from public, anon;
revoke execute on function public.crm_clear_samples(uuid) from public, anon;
grant execute on function public.crm_apply_proposal(uuid) to authenticated;
grant execute on function public.crm_restore_version(uuid, integer) to authenticated;
grant execute on function public.crm_discard_proposal(uuid) to authenticated;
grant execute on function public.crm_clear_samples(uuid) to authenticated;
