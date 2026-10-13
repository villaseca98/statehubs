# StateHubs — development contract

StateHubs is an international real-estate CRM/ERP. Evolve the existing React/TypeScript/Supabase product in small, verified deliveries. The current product direction is [PRODUCT_VISION](docs/PRODUCT_VISION.md); the evidence baseline is [TECHNICAL_AUDIT](docs/TECHNICAL_AUDIT.md).

## Preserve the product

- Use the existing checkout. Cloud tasks are already isolated; do not create a worktree unless requested.
- Read a file and its callers before editing it. Preserve user changes and working modules.
- Keep blueprint entity/field keys stable: stored records depend on them. Removing a module hides data; it must not delete it.
- Blueprint changes remain proposals with previews and append-only version history. AI produces validated JSON, never executable code.
- Keep local/demo and server API contracts compatible; mark sample data explicitly. Never replace production data with samples.
- Do not invent or redraw the official logo. Existing assets are listed in DESIGN_SYSTEM; the original corporate asset is still pending.

## International product and security

- English is the default/fallback product language. New UI strings belong in translation catalogs. Spanish domain keys are stable identifiers, not presentation strings.
- Preserve useful implementation guidance in CLAUDE.md. Its Spain-only language rule and historical branding descriptions are superseded by the user's international product brief and these documents.
- Every server mutation must enforce organization membership and permissions. Hiding controls is not authorization. Service-role functions must explicitly authorize callers and scope records.
- Never place private keys in VITE_* variables or logs. Keep external integrations explicitly distinguished as implemented, configured, verified, or planned.
- Never invent prices, FX rates, metrics, legal compliance, or deployment status.
- Destructive data changes, risky production infrastructure changes, external costs and fundamental business decisions require explicit authorization. Stage migrations and preserve IDs/data first.

## Validate each delivery

- Run `npm run build`, `npm test -- --maxWorkers=4`, and `npm run lint`; preserve command exit statuses and report existing warnings.
- Add regression tests for behavioral fixes. Run tenant-security SQL for database/security changes; mocks do not prove RLS.
- Edge handlers are outside the frontend TypeScript build. Do not call their production runtime verified based on Vite or Vitest alone.
- Check visible changes on mobile (390 px) and desktop; include keyboard, empty, loading, error and permission states.
- Use tokens and reusable CRM components. Keep decorative 3D out of the working CRM.
- Update the feature matrix and roadmap with evidence; separate local checks from real Supabase/Vercel validation. Report objective, changes, files, database, tests, build, deployment, limits and next priority.

For cloud-specific SWC startup instructions and the isolated PostgreSQL test flow, see [DEPLOYMENT](docs/DEPLOYMENT.md).
