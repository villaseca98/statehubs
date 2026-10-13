# StateHubs technical audit — 2026-10-12

## Scope and conclusion

Baseline: branch `work`, HEAD `536ed3ecbafc4b1b1802c6ed0731f346ae696faf` (merge of phase 11). Initial working tree clean; 198 tracked files. This delivery reviews repository architecture, domain definitions, frontend API/mutations, runtime views, design/i18n, all migration stages and Edge integration boundaries. It is a repository audit with local execution, not a penetration test or production certification.

The product has a functioning configurable CRM runtime, persistent browser demo, server CRUD interfaces, property views, calendars, analysis and integration implementations. It is **not yet a verified commercial multi-user international SaaS**. The main gaps are the fragmented contact model, incomplete collaboration path, absent server domain invariants, inconsistent design and partial localization. Preserve and evolve these modules rather than rewrite the application.

Historic phase documents remain useful but are snapshots: phase 07's owner-only Storage description is superseded by phase 10; phase 09's CI limitations are superseded by tenant-security.yml. The old SaaS launch plan predates organization tables. This audit and FEATURE_MATRIX describe the current code, without asserting its migrations are installed in production.

## Architecture actually present

| Area | Evidence | Finding |
| --- | --- | --- |
| Frontend | package.json, src/App.tsx, vite.config.ts | React 18, TypeScript, Vite 5, React Router 6, Tailwind, Framer Motion; SPA, not Next.js |
| Routes | src/App.tsx | `/`, `/entrar`, `/demo`, `/app/:appId`, `/reels`, `/reels/:reelKey`; lazy-loaded working app/login/demo/reels |
| Domain | supabase/functions/_shared/blueprint/{types,modules,validate}.ts | JSON blueprints define entities, fields, views, actions; stable Spanish keys |
| Persistence | src/lib/crm/{api,localApi}.ts | Supabase crm_* tables or browser localStorage; local mode is not a server-backed account |
| Server | supabase/functions/*/index.ts | Deno Edge functions with service-role clients, caller checks and provider-specific implementations |
| Quality | .github/workflows/{quality,tenant-security}.yml | Node 20 frontend CI; separate PostgreSQL 16 RLS suite; no real-browser or live-provider release gate |
| Delivery | vercel.json | SPA rewrite; no evidence here of actual Vercel project/runtime settings or deployment logs |

## Leads and Clients: why separation is insufficient

`modules.ts` defines `lead`, `cliente`, and `contacto_inmo` independently. Each stores its own name, phone and email. `cliente.tipo` is a loyalty/status classification (new/regular/VIP/inactive); `contacto_inmo.tipo` is a **single** commercial role (buyer/seller/owner/etc.). Neither represents several roles for the same canonical person.

The Leads worklist changes `estado` between new/contacted/appointment/won/lost. Its `Ganado` action only changes a field; it does not create/link a client, preserve a conversion event, or move activity relationships transactionally. Calling a person does not currently convert them either. No shared contact identity or conversion RPC was found. `RecordPanel` shows fields and related records, not an append-only commercial activity log.

`hubs.ts` puts leads, contacts, clients, pipelines and appointments in a broad `Clientes` hub. The agency packs use `contacto_inmo`/`operacion`, while generic modules and the Meta lead endpoint also use `lead`/`cliente`/`oportunidad`. This affects search, dashboard counts and integration visibility: an imported `lead` can be stored even when the active blueprint exposes another entity. Duplicate analysis exists in `blueprint/analysis.ts`; canonical identity merging and conversion do not.

Target: separate identity, opportunity lifecycle and client roles; preserve legacy IDs through explicit mappings. See DATABASE and ROADMAP for the incremental path and acceptance criteria.

## Working modules and limits

- **Dashboard:** `dashboard.ts` excludes `is_sample` records and computes real loaded-record metrics over 7/30/90 days; `today.ts` provides actionable pending/overdue work. Counts cover `lead`, not all `contacto_inmo` activity. Agent breakdown may display raw relation IDs. No role-specific dashboard or server aggregation/pagination. Other operations charts use the supplied records, including clearly marked demo datasets; there is no global organization reporting model.
- **Properties:** `CardsView`, `PropertyOverview`, `PropertyMedia`, `propertyMedia.ts` provide editable records, details, photo/PDF upload, private paths and five-minute signed links. `estate.matchesFor` matches budget/type/zone and sale versus rental; minimum rooms/area and currency equivalence are not enforced. Maps, listing distribution, video/order management and full lifecycle audit are absent. Asset upload/deletion and metadata update are not atomic.
- **Rentals:** `reserva`, `servicio`, `incidencia` and `TimelineView` provide bookings, housekeeping, incidents, occupancy and net calculations. `findConflicts` flags overlaps in loaded data; it is not a transactional exclusion constraint. Residential lease/rent schedule/renewal models are absent.
- **Calendar:** month/week/day booking timeline, appointment views, `.ics` export and Google link helpers exist. `blueprint/calendar.ts` defaults to `Europe/Madrid`; org timezone columns are not wired through all event flows. Date-only stays and timed appointments are already separate concepts worth preserving.
- **Pipeline/tasks:** persisted field changes and Kanban exist, but no immutable stage event history, server enforcement of loss reasons or task automation queue. `WorklistView.launch` reports creation before awaiting every write.
- **Filters/search:** rule filters, sort, presets, saved views and command palette exist. Saved views are browser-local; filtering/search operate on loaded records, not a paginated organization query.
- **Accessibility:** `RecordDialog` has focus trapping/restoration and Escape tests. `AppPage.SidePanel` does not share this dialog behavior. Responsive styles exist; this audit has not verified Safari/Chrome rendering or mobile screenshots.

## Security, integrity and authentication findings

| ID / priority | Evidence and consequence | Disposition |
| --- | --- | --- |
| SEC-01 / P0 | `isPrivateAddress` recognized only dotted IPv4-mapped IPv6. URL parsing converts it to hex, so loopback/private/metadata destinations passed. Expanded loopback and parts of fe80::/10 also passed. Both `crm-automate` and `crm-ical` depend on this boundary. | Fixed in this delivery; 12 regression cases failed before, now pass. Requests are mocked; no internal endpoint was contacted. Actual SSRF impact depends on deployment network routing. |
| COLLAB-01 / P0 before team rollout | Records/apps readable by members, but `crm_app_versions` remains owner-only. AppPage derives the working blueprint from `api.versions`; a non-owner cannot obtain it through that path. | Pending: current-blueprint read permission/API plus real member UI tests, without opening proposal/admin privileges. |
| DATA-01 / P0 before production use | `crmApi.updateRecord/deleteRecord` only check error, not affected rows. PostgreSQL RLS can filter to zero rows without SQL error, leaving optimistic UI apparently saved/deleted. Whole JSON replacements also risk lost concurrent edits. | Pending: mutation acknowledgment, scoped atomic patch/version conflict semantics and rollback/concurrency tests. |
| BOOK-01 / P0 before accepting bookings | JSON relationships lack FK validation to target record and reservations lack transactional overlap prevention; client warnings are bypassable. | Pending: additive constrained domain storage/RPC and concurrent booking tests. |
| INT-01 / P1, release gate for Instagram | `crm-instagram` records event ID before applying operations; catches errors and returns HTTP 200. Partial failures can become permanently deduplicated. | Pending: durable processing states/retry/outbox, idempotent effects and failure tests before enabling live messaging. |
| AUTH-01 / P1 | `useAuth.getSession` has no rejection handler; failure can leave loading unresolved. Async loaders do not consistently cancel stale results. | Pending: explicit auth/error states, session invalidation and route-change tests. |
| MODEL-01 / P1 | `crm_records.data` JSONB bypasses blueprint field rules when written directly. Relation keys are not SQL FKs; record audit/archival is absent. | Pending: shared validation backed by server constraints and audit events. |
| MEDIA-01 / P1 | Asset operations and record metadata are separate writes; signed URLs expire without scheduled renewal. | Pending: recoverable metadata workflow, orphan cleanup and role-aware UI. |

Organization/record isolation is implemented by phases 09/10: immutable org ownership, composite `(app_id,org_id)` FK, RLS per role, restricted RPC privileges and private Storage. Secret tables are denied to browser roles. Existing negative SQL tests cover two agencies, owner/admin/agent/viewer, cross-tenant writes, member escalation, Storage paths and secret-table access. Their results are recorded in DEPLOYMENT. They emulate auth/storage and do not verify real JWT issuance, Storage signed requests or Edge endpoints.

The IPv6 correction is a bounded defense fix, **not a complete SSRF guarantee**. DNS lookup and fetch still resolve separately; DNS rebinding and provider/network-specific translation ranges need an egress-level solution and deployment review. Redirect blocking, timeouts and response-size limits remain intact.

## Design and official assets

Tailwind's public palette is white/black/red. `LOOK`, `LOOK_DARK` and `BRAND` in `blueprint/look.ts` remain green, as do `src/design/tokens.ts` and several fixed dashboard/CSS colors. This explains the internal/external mismatch directly. There are reusable SHButton/SHSurface/SHStatus/SHSkeleton components, but not one shared token source.

`Logo.tsx` draws the existing layered mark; `public/favicon.svg` is an orange/pink variant. No separate supplied official artwork is present among tracked assets; phase 11 explicitly records it as missing. `imageToLogo` and LogoSetup concern each customer's workspace logo, not the corporate identity. Preserve current assets until the user supplies the original corporate file. DESIGN_SYSTEM records this dependency.

## Internationalization, performance and release

EN/ES provider, manual persistence, English fallback, Intl helpers and additive organization preference columns exist. Browser-language detection, full CRM catalogs, RTL, eight further requested languages, localized routes/hreflang/sitemap and localized transactional emails do not. Runtime money formatting is still es-ES/EUR; raw JSON numbers are not a decimal accounting model. No FX provider or billing integration exists.

`api.records` loads records without pagination and `versions` loads all historical blueprints; PostgREST server row limits can make datasets incomplete. Client scans/filters and repeated relational lookup limit scale. Initial bundle warning exceeds 500 kB; public landing imports and animation should be profiled before optimizing. No measured Safari/MacBook 2018 performance claim is made.

Local frontend build was already successful at this exact baseline during onboarding; its earlier startup failure was SWC cache ownership in the cloud container. This is **not evidence of a Vercel failure or repair**. Current build/tests/lint and SQL results are in DEPLOYMENT. No Vercel logs or authenticated Supabase staging were provided, so live deployment and provider behavior remain unverified.

## Delivery scope

This first delivery adds persistent product/architecture/audit/roadmap documentation and fixes SEC-01 with unit and request-boundary regressions. No database migration, data deletion, dependency upgrade, branding replacement or production deployment is included. Next work should close COLLAB-01 and DATA-01, then deliver the shared CRM shell and traceable lead-to-client lifecycle as distinct verified increments.
