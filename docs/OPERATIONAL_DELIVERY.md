# Operational workspace delivery — 2026-10-13

This change adds the white/red CRM shell, desktop sidebar/mobile hub navigation, `/login`, `/register`, `/workspace`, workspace creation, organization membership management and platform administration. New account screens have EN/ES catalogs. Existing interior CRM translations remain partial.

## Database and access

Apply migrations in timestamp order, including `20261013090000_workspace_access_platform_admin.sql`. The new migration is additive and preserves existing records and owners. It adds member access to the current blueprint, atomic JSON patches with conflict detection, role discovery and explicit platform administration RPCs. Browser writes await database acknowledgment; edits to one record are serialized.

The first confirmed Supabase identity with `villaseca.managements@gmail.com` can claim platform administration when opening `/workspace`. Unconfirmed email and client metadata do not grant access. The bootstrap binds once to the account UUID. Platform administration lists agencies and manages membership; it does not expose integration secrets or bypass business-record RLS. Team additions currently require an existing user's UUID; email invitations are not implemented.

## Activation requirements

1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the cloud environment and deployment settings. Never use a service-role key in a VITE variable.
2. Apply the repository migrations to the intended Supabase project after checking its existing migration history. The test bootstrap is only for ephemeral databases and must never run on Supabase.
3. Deploy the existing `crm-agent` function for workspace proposals/creation. Configure Supabase Auth's Site URL and allowed redirects for the actual deployment's `/workspace` and `/app/*` flows. Enable email confirmation; enable Google only with its provider configured.
4. Build/deploy the frontend. Confirm signup email delivery, callback, administrator claim, team access and persistence with real identities before declaring production ready.

No live project URL, publishable key, database connection or deployment credentials were available during this delivery. Local verification does not activate the production site. The official attached logo still needs an accessible original file; the old mark remains rather than inventing a replacement.

## Verification

Frontend build, regression tests and lint; isolated PostgreSQL 16 migrations plus tenant negative tests and `workspace_access.sql`; browser rendering at 390 and 1440 pixels. PostgreSQL tests cover confirmed/unconfirmed bootstrap, one-time claim, private admin grants, business RLS, member blueprint visibility, patch preservation and stale-write rejection. These do not prove live Supabase Auth, email, Storage or Edge deployment.

## Remaining product work

The CRM is not feature-complete: canonical contacts and lead conversion, full activity history, transactional booking constraints, email invitations, audited administration, billing, complete localization and live integration verification remain. See FEATURE_MATRIX and ROADMAP.
