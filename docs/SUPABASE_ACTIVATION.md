# StateHubs Supabase activation — 2026-10-15

Project: `evnhkxnpdctbsbwppcen`, region `eu-west-1`. Application origin: `https://statehubs.vercel.app`. No future .com hostname is assumed.

## Applied and verified

The project previously hosted Mewhub. Inspection found no `crm_*` tables/functions, no Storage buckets/policies, no auth-user triggers and no pg_cron extension. Existing non-CRM tables, functions, users and migration history were preserved. The platform returned no managed backups; this operation did not reset or replace existing data. Non-secret prior Auth settings and the original table inventory were retained in `/workspace/.statehubs-activation/baseline-metadata.json`.

- The initial 11 CRM migrations passed a full transaction with rollback on the actual target before application. They were then applied atomically and registered in migration history. No test bootstrap or legacy fixtures were applied to the live project.
- Migration 12, `20261015130000_crm_patch_conflict_status.sql`, makes optimistic write conflicts return HTTP 409 (`PT409`) instead of a database serialization error mapped to HTTP 500. The first live stale-write request timed out; the corrected endpoint returns 409 and preserves the confirmed record.
- The Storage hardening migration now avoids a redundant `ALTER TABLE` when RLS is already active. Actual Supabase rejects that operation on its managed Storage table; creating the bucket-specific policies succeeds. Isolated test substrates still enable RLS when required.
- All 14 CRM tables have RLS. The property bucket is private. Public-key-only requests cannot read CRM records.
- Auth Site URL points to StateHubs. Its callback and the local cloud callback are allowlisted; prior redirects were retained. Email confirmation is enabled. Existing Google login configuration was preserved; its external provider consent/login journey still needs user verification.
- Six functions are deployed: `crm-agent`, `crm-automate`, `crm-ical`, `crm-google`, `crm-instagram`, `instagram-lead-webhook`. Core functions retain gateway JWT checks. The OAuth/webhook functions accept external callbacks and enforce user JWTs, signed state or webhook signatures in their handlers; their gateway JWT switch is off intentionally.
- Server `APP_URL` is set. Missing Google/Instagram state-signing secrets were generated directly into Supabase without logging their values. Existing provider credentials were preserved. An Anthropic secret is present by name; no paid AI inference was performed or claimed verified.
- Public client configuration is in ignored `.env.local`; private management/service/session keys are not written to the repository or setup scripts.

## Real-user and browser evidence

`verify-supabase-live.py` uses temporary users and isolated test apps, and removes their users, organizations, records and media afterward. It sends no emails or provider messages. Real authenticated HTTP checks passed for:

- App/organization creation and owner-assigned agent, administrator and viewer membership.
- The deployed builder's validated card proposal and atomic version application.
- Property/contact CRUD, acknowledged patches, stale-write rejection, idempotent activity and persistent match decisions.
- Denied cross-agency reads/writes, notes and matching. Viewers can read but cannot mutate; agents can edit but cannot delete; administrators can delete.
- Private media upload, persisted paths, signed downloads and denied foreign-agency/viewer writes.
- Deployed automation without outbound targets, iCal without feeds, owner checks and anonymous rejection.
- Google Calendar/Instagram status correctly reports missing provider configuration. Deployment is not provider activation.

Chromium at 390 px and 1440 px exercised the actual frontend against this Supabase project: auth callback, connected property feed, signed image, note creation and persistence after reload. A viewer session reads the saved note with no mutation form or delete action. Browser traffic used the supported HTTPS proxy with certificate verification enabled. Temporary test sessions were held in memory and never logged.

The isolated PostgreSQL 16 suite also passes all 12 migrations, legacy backfill fixtures and four real SQL permission/activity/matching suites. This complements, rather than substitutes for, the real JWT/Storage checks.

## Repeatable commands

Use the Node/SWC initialization in [DEPLOYMENT](DEPLOYMENT.md). For a read-only audit:

```bash
cd /workspace/statehubs
node scripts/verify-supabase.mjs
```

The audit reads public `.env.local` bindings and a securely supplied `SUPABASE_ACCESS_TOKEN`; it automatically enables Node's environment-proxy support. It intentionally reports SMTP as blocked until public email delivery is configured.

To repeat the mutating verification, explicitly opt in and use a project where temporary verification accounts/apps are appropriate:

```bash
python3 scripts/verify-supabase-live.py --run
```

For optional real-browser checks, first run Vite and provide Playwright/Chromium. This cloud instance has Playwright 1.64.1 in `/workspace/.browser-check/node_modules/playwright` and Chromium in `/usr/bin/chromium`:

```bash
python3 scripts/verify-supabase-live.py --run --browser
```

Other machines can set `STATEHUBS_PLAYWRIGHT_MODULE` to the installed Playwright entry module and `STATEHUBS_CHROMIUM` to their Chromium executable. Use Node 24 for proxy and TypeScript transform support. Do not put private tokens in commands saved to files or shell history; use secure environment settings.

## Outstanding external configuration

1. **Published frontend:** HTTP 200 at `statehubs.vercel.app`, but all 11 inspected JavaScript chunks lack the selected Supabase project URL. Backend activation does not recompile frontend assets. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel for the intended preview/production scopes, then rebuild the approved commit. `VERCEL_TOKEN` is a saved environment requirement for API-assisted configuration; no token is currently bound. No PR merge or production release has been performed here.
2. **Email:** the owner selected Resend, but currently has only the Vercel subdomain. That is usable for the app, not an owned email-sending domain. Resend public delivery requires a verified owned domain and a sender address. `onboarding@resend.dev` is restricted testing, not a public registration solution. `RESEND_API_KEY` and `STATEHUBS_EMAIL_FROM` are registered requirements; no SMTP password or sender has been invented. Auth still has no custom SMTP. Do not call public email signup ready.
3. **Google Calendar:** needs its OAuth client credentials and the function callback in Google Cloud. Existing Google sign-in configuration is a separate integration and does not establish Calendar permission.
4. **Instagram/Meta:** application credentials, approved capabilities, webhook setup and actual account consent are missing. Existing retry/idempotency limitations must be resolved before live acquisition or automated replies. No conversations or comments were invented.
5. **AI/provider behavior:** a server secret name is present, but model access, actual inference and external costs have not been validated. No provider action is claimed operational based solely on deployment.
6. **Booking collisions:** display and relationship navigation are verified. The unmerged PR #21 guard has confirmed defects: overlapping inserts succeed when its trigger runs before organization assignment, and SQL NULL dates bypass validation. Do not deploy it without correction and concurrency tests.

Resend and Vercel API destinations were added additively in the environment draft. Draft persistence, runtime configuration, live Supabase changes, GitHub CI, Vercel builds and environment publication are separate outcomes.

Final local checks for this delivery: TypeScript/Vite build and lint pass (five existing ESLint warnings and the existing Vite chunk-size warning). There are 302 passing frontend/shared tests across 60 suites: a full run passed 58 suites and hit module-loader timeouts in two during an execution-environment disruption; both affected suites then passed their 13 tests after recovery. The 12-migration PostgreSQL run passes independently. The reusable live/browser verification passes all 15 workflow groups and confirms cleanup. The default property home also offers an owner/agent-only Add property action, so an empty agency can create its first record through the existing persisted editor.
