# PR #37 stabilization and Supabase activation

Primary product reference: [CODEX_STATEHUBS_MASTER_CONTEXT](CODEX_STATEHUBS_MASTER_CONTEXT.md), read in full from `fix/clean-crm-home-no-duplicate-panels` at `a6f3ed6d45f48ddee14cf28a239421216336cfa2`.

## Scope delivered locally

- Property workspaces open on one photo-forward property card, including blueprints whose first view is the old operations center. Non-property workspaces retain their existing Today/operations workflow.
- Primary navigation uses Properties, Inbox (only when an existing conversation view is installed), Calendar (existing calendar/timeline views), and More. Existing views remain reachable; no new conversation backend is implied.
- Market filters read persisted `operacion` values and supported English operation fields. Unknown categories remain reachable without guessing a transaction from descriptions or property types. Titles use blueprint title fields, including `direccion`; holiday prices use nightly fields. Missing currency is explicit rather than defaulting to EUR.
- Details, Leads, Activity and Bookings/Viewings are reachable. Property changes reset contextual tabs. Property navigation remains valid after deletion/filter changes.
- The gallery reuses private Storage assets and short-lived signed URLs; photo buttons, horizontal touch gestures, loading, retry and missing-photo states are covered. Signed URLs are not persisted in records.
- Leads reuse `contacto_inmo` and existing CRM relationships, including contacts connected through viewings/deals. IDs are deduplicated. Archived contacts and sample/live mixtures are excluded. Qualification requires an explicit recorded flag/status, not temperature or a generated score. Only authorized records supplied by Workspace are displayed. Expanding a contact reveals recorded contact details.
- Activity uses the existing record-events API/RPC, with durable internal notes, calls and meetings, idempotent retries and viewer restrictions. It is explicitly labeled internal CRM activity, never Instagram content.
- The contextual match action opens the existing property dossier and persistent Match Intelligence implementation. The older optional global MatchDesk still labels its own shortlist/dismissals as session-only; it has not been promoted into persistent functionality.
- Bookings and viewings use actual relationship fields (`alojamiento`, `inmueble` and declared relations) and recorded dates. No inference from arbitrary text values.
- Delete actions retain permission gating and confirmation. Existing server API/RLS remains authoritative.
- Secondary intelligence surfaces are selected individually, rather than stacking three dashboards inside one tool.

No new migration is needed for this slice: it connects existing schema, Storage, record events, matching and record editing. Booking creation with transactional overlap prevention, a unified provider Inbox, official Meta/AI acquisition and persistent Autopilot remain separate pending vertical slices. PR #21 already contains a candidate booking-overlap migration (`20261013150000_booking_overlap_guard.sql`); reconcile that work rather than create a parallel guard. Before integration, validate draft creation, nullable dates, sample/live separation, tenant boundaries and concurrent transactions against real PostgreSQL. PR #26 already contains a monthly rent-schedule helper and PR #31 the registration-navigation fix; avoid duplicating them. Do not describe linked-booking display as double-booking protection.

## Local evidence

Validation is recorded against this checkout, not a live deployment:

- Required commands: `npm run build`, `npm test -- --maxWorkers=4`, `npm run lint`, with the isolated SWC environment from [DEPLOYMENT](DEPLOYMENT.md).
- Full suite: 301 tests pass in 60 files; TypeScript/Vite build passes; lint passes with five pre-existing warnings.
- Added regression suites cover real schema classification, relationships, qualification, sample separation, card navigation after record removal, delete permission/confirmation, existing activity persistence across remounts, gallery signing failures/retry and touch navigation.
- Chromium at 390 px and 1440 px: property home without stacked dashboard, next property, market switches, booking display, menu Enter/Escape, record drawer and command bar; no page overflow or uncaught page errors observed.
- PostgreSQL 16, network disabled and no exposed ports: all 11 migrations, legacy fixtures and the four SQL suites (`phase10_negative_rls`, `workspace_access`, `record_activity`, `match_decisions`) pass with `ON_ERROR_STOP=1`. Test container removed afterward. Real Supabase auth, Storage and Edge behavior are not established by these tests.
- Existing warnings: five ESLint warnings (PropertyCover dependency, i18n fast refresh), React act/router warnings in tests and Vite chunk-size warning.

Git read access confirms main at `f8065f8` and the original PR #37 head at the reference above. GitHub REST and GraphQL returned Forbidden, but the normal GitHub HTML pages were accessible and were reviewed as a fallback:

- Open PRs: #37 (property-first CRM), #31 (direct registration navigation), #26 (pure rental schedule foundation, explicitly not persisted/UI-integrated), and #21 (composable domain foundation/configuration preview).
- #34 (persistent Autopilot proposal) and #36 (Focused Home) are closed; this is not evidence their proposed features were merged. Do not recreate or cherry-pick them blindly.
- #37 is open with no reviews recorded in the page. Its original `a6f3ed6d` preview is shown as deployed by Vercel, following an earlier free-plan deployment-limit failure. Neither that preview nor the historical quota error establishes deployment of this new stabilization commit.
- Current CI/check-run detail is not established by the logged-out HTML snapshot. Git refs do not prove check status. No merge or production release has been performed.

## Supabase project activation

Owner-supplied project: `https://evnhkxnpdctbsbwppcen.supabase.co`. Current application domain: `https://statehubs.vercel.app`; a future .com must be added when known, not guessed. The project was previously used for Mewhub. The owner authorizes dedicating it to StateHubs, including replacement if necessary. First inspect its schema and existing migrations, preserve recoverable backups, and prefer non-destructive separation where possible. Do not run the test bootstrap or synthetic fixtures on that project.

The environment draft requests:

- `VITE_SUPABASE_URL`: the project URL above.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: public publishable/legacy anon key from the project API Keys settings. Never use a service-role or secret key in VITE variables.
- `SUPABASE_ACCESS_TOKEN`: Supabase account management token, entered securely in environment settings and routed only to `api.supabase.com` through the supported proxy. Do not copy it into files or logs. No database password or service-role key has been requested in chat.
- Custom network destinations: the project hostname, `api.supabase.com`, `api.github.com` and `statehubs.vercel.app`; package-manager presets are preserved.

Draft persistence does not inject values or apply network changes. The initial request to the project health endpoint was rejected by the egress proxy (HTTP 403 CONNECT). Recheck after settings are saved/applied. Do not interpret this as evidence of project health or invalid credentials.

After runtime configuration is available, run from `/workspace/statehubs`:

```bash
node scripts/verify-supabase.mjs
```

This read-only audit checks public-key connectivity, management project status, Auth settings, deployed Edge function presence, required CRM tables/RLS, recorded migration versions and the private media bucket. It prints no credential values or customer records. Its actual live requests remain unverified until credentials and network are supplied. A clean audit is only a configuration checkpoint, not an end-to-end readiness claim.

Activation sequence:

1. Inspect existing Mewhub schemas, Auth users, Storage, function inventory and migration history through read-only access. Establish a recoverable backup before changing existing data or replacing configuration.
2. Reconcile existing objects with all 11 repository migrations; stage the exact migration plan and apply it only after compatibility is established. Never blindly reset the project or replay every migration against an unknown schema.
3. Configure Auth Site URL for `https://statehubs.vercel.app`, verified callback routes and redirect allowlist. Configure email delivery/confirmation; configure Google only with an actual authorized OAuth client. Vercel needs the same public VITE variables and a fresh build because Vite embeds them at build time.
4. Deploy required Edge functions with their authentication contracts preserved. Built-in Supabase runtime bindings belong in Edge, not the frontend. Provider-specific secrets belong in Supabase Edge settings. Request Google, Meta and Anthropic credentials only for integrations the owner intends to activate, after inventorying existing bindings by name/status.
5. Test with real authenticated users from two agencies and with owner/admin/agent/viewer roles: login callback; property create/edit/delete permissions; record-event notes and retry; persistent matching; private image/PDF upload and signed read; denied cross-agency reads/writes/storage; expired/invalid sessions. Preserve IDs and data. Verify Edge handlers individually; frontend TypeScript does not compile them.
6. Enable external integrations only after their official authorization, webhook signatures, retries/deduplication, consent and real sandbox journeys pass. Existing provider-related repository blockers remain blockers, even if their functions deploy successfully.

Live Supabase readiness, Vercel deployment, GitHub CI status and environment publication are separate outcomes and must be reported separately.
