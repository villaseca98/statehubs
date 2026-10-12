-- Minimal Supabase auth/Storage substrate for ephemeral PostgreSQL 16 CI.
-- NEVER execute this bootstrap in a real Supabase project.
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claim.role',true),'')
$$;
create schema storage;
create table storage.buckets (
 id text primary key, name text not null, public boolean not null default false,
 file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null references storage.buckets(id),
 name text not null
);
grant usage on schema public,auth,storage to authenticated,anon;
grant execute on function auth.uid(),auth.role() to authenticated,anon;
-- Testing client privileges for the Storage API; RLS must restrict access.
grant select,insert,update,delete on storage.objects to authenticated;
