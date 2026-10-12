-- Instagram assistant (crm-instagram): one connected Instagram professional
-- account per app, and the events already handled (Meta retries webhooks).
-- Only the edge function (service role) reads or writes these tables.

create table if not exists public.crm_instagram_accounts (
  app_id uuid primary key references public.crm_apps(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ig_user_id text not null unique,
  username text,
  access_token text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_instagram_events (
  id text primary key,                 -- c:<comment id> or m:<message id>
  app_id uuid not null references public.crm_apps(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists crm_instagram_events_created_idx on public.crm_instagram_events(created_at);

-- [SECURITY] Row level security with no policies: the access tokens never reach
-- a browser, not even the owner's. The app asks crm-instagram for the status.
alter table public.crm_instagram_accounts enable row level security;
alter table public.crm_instagram_events enable row level security;
revoke all on public.crm_instagram_accounts from anon, authenticated;
revoke all on public.crm_instagram_events from anon, authenticated;
