-- Google Calendar connections (crm-google). One row per person: the
-- permission Google gave (refresh token) and the short-lived access token.
-- Only the crm-google function (service role) reads or writes it: RLS is on
-- and no policy lets a signed-in user or the public see the tokens.

create table if not exists public.crm_google_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [SECURITY] RLS on with no policies: tokens never reach the browser.
alter table public.crm_google_accounts enable row level security;
alter table public.crm_google_accounts force row level security;
-- [SECURITY] And no table privileges for the API roles either.
revoke all on table public.crm_google_accounts from anon, authenticated;
