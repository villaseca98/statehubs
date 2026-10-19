# Development, verification and deployment

Current live Supabase activation and remaining Vercel/email/provider requirements: [SUPABASE_ACTIVATION](SUPABASE_ACTIVATION.md). Historical audit results below are not current deployment claims.

## Local development

Use `/workspace/statehubs` in the cloud checkout. Node 24.19.0 / npm 11.9.0 validated here; GitHub quality CI currently selects Node 20. No package engine pin is present. The actual Vercel Node version remains unknown; align runtimes deliberately after checking its settings/logs.

```bash
npm ci --cache /workspace/.npm --no-audit --no-fund
npm run dev -- --strictPort
npm test -- --maxWorkers=4
npm run lint
npm run build
```

Vite binds loopback port 8080; use internal HTTP checks, not a published preview link. `build` runs TypeScript (`tsconfig.app.json --noEmit`) then Vite. Edge entry points are not included in that TypeScript build. `dist` is the static output; Vercel rewrites client routes to index.html.

This cloud container's ancestor ownership prevents SWC 1.16.18 from materializing its verified native payload with default cache policy. Its documented isolated-executor setting, already tested during onboarding:

```bash
mkdir -p /workspace/.swc-native-cache
chmod 700 /workspace/.swc-native-cache
export SWC_NATIVE_BINDING_CACHE=/workspace/.swc-native-cache
export SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1
```

This bypasses cache ancestor ownership checks only; payload integrity checks remain enabled. Restrict it to this trusted isolated environment. Do not copy it into Vercel or shared machines without the same diagnosed condition. It is not a Vercel build fix. Install/start instructions are already saved in the cloud environment draft.

## Supabase and integrations

Without VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY the app runs locally. The current cloud instance has these public bindings in ignored `.env.local`; Vercel still needs its own build-time bindings. No private credentials should ever be VITE_* values. Reconcile all 12 migration files in timestamp order; this instance has applied and verified them against the owner-supplied project. For other targets, stage first; README's initial migration alone is insufficient for the current code. Review subsequent migrations explicitly before production.

Auth requires configured callback URLs/provider settings. Provider credentials belong to Edge secrets (Google, Meta/Instagram, Anthropic); see existing CLAUDE.md and integration docs for exact current names. No live provider or production project was configured by this audit. SQL changes and Edge code are not deployed by merely building the frontend.

SEC-01 changes a shared module imported by `crm-automate` and `crm-ical`; both functions must be redeployed to an authorized staging project and tested before production protection can be claimed. No deployment has been performed.

## Isolated SQL verification

Use an ephemeral PostgreSQL 16 database, never a real Supabase project for `phase10_bootstrap.sql`. A container with `--network none`, no published ports and a temporary database was used here. Apply, with `psql -v ON_ERROR_STOP=1`:

1. `supabase/tests/phase10_bootstrap.sql`.
2. Legacy migrations through `20261012180000_property_media.sql` in timestamp order.
3. `supabase/tests/phase10_legacy_fixtures.sql`.
4. Organization expansion, security hardening and global preferences migrations in order.
5. `supabase/tests/phase10_negative_rls.sql` (assertions run under authenticated roles, then rollback).

The same order is encoded in `.github/workflows/tenant-security.yml`. Test only synthetic data; remove the temporary container after the run. These checks exercise real PostgreSQL policies with emulated auth/storage tables. Follow up with two real users, JWTs, signed Storage requests and each Edge action in staging before commercial rollout.

## Historical audit execution record

- Initial `npm ci`: 344 packages installed reproducibly at baseline; no manifest/lock changes.
- Before SEC-01 correction: focused address suite **12 failed / 7 passed**, demonstrating the regression.
- After correction: focused pure/helper boundary suite **25 passed** across two files. DNS and fetch mocked; local/private network endpoints never contacted.
- `npm test -- --maxWorkers=4`: **216 passed, 31 files**, no skipped/failed tests (32.99 seconds). Existing React duplicate-key, act and router-future warnings remain.
- `npm run build`: **passed**, TypeScript and 2,104 transformed modules. Largest entry chunk 570.68 kB (175.07 kB gzip); existing >500 kB warning remains.
- `npm run lint`: **passed**, zero errors and five existing warnings (PropertyCover hook dependency and i18n fast-refresh exports).
- PostgreSQL 16: all eight migrations, legacy backfill fixtures and `phase10_negative_rls.sql` **passed** with `ON_ERROR_STOP=1`; no changes to migration files.
- No production database touched; no new migration; no Vercel release published or verified.

## Production release gate

Obtain the failing Vercel build log, commit, root directory, build command, Node version and variable **names/status only** before diagnosing an external failure. Local successful build does not establish Vercel health. Then verify the exact preview commit, authenticated CRUD, each role, two-agency isolation, assets, deep links and browser compatibility. Production migrations, provider activation, billing and rollback need their respective verified prerequisites.
