# Roadmap — independently verifiable deliveries

Priorities describe risk and dependency, not arbitrary dates. P0 blocks the affected production workflow; P1 is core product quality; P2 expands international operations; P3 adds commercial/advanced capabilities. Do not interpret this plan as implemented features.

| Delivery | Priority | Scope | Acceptance gate |
| --- | --- | --- | --- |
| D0 audit + outbound-address fix | P0 | This delivery: diagnosis, persistent docs, normalize IPv6 filter | Pre-fix regressions fail; post-fix public/private URL tests, full suite/build/lint and isolated RLS suite pass |
| D1 reliable authorized workspace | P0 | Member access to current blueprint, role-aware controls, acknowledgment of mutations, atomic patch/conflict handling, auth failure states | Owner/admin/agent/viewer can perform exactly permitted operations; A/B isolation; zero-row writes surface errors; concurrent edits preserve data; no false save status |
| D2 reservation and relation integrity | P0 for bookings | Additive domain constraints/RPC, validate target org/entity, overlap prevention | Concurrent overlapping stays cannot both commit; adjacent/cancelled stays allowed; existing IDs/counts preserved |
| D3 shared CRM visual shell | P1 | Consolidate tokens and internal navigation/forms/dialogs; preserve all module routes | Light/dark, 390 px/desktop, keyboard and loading/empty/error/denied tests; official logo only from supplied asset |
| D4 professional Leads/Clients | P1 | Canonical contact mapping, multi-role clients, explicit conversion, archive, activities, duplicate review | Create/edit/assign/filter lead; convert twice without duplication; history and property/deal links survive; rollback on failure; migration reconciles legacy data |
| D5 pipeline and daily priorities | P1 | Stage events, activities/tasks, agent identity resolution, complete scoped dashboard | Metrics reconcile to authorized stored records; sample data excluded/identified; transitions recorded and reminders deduplicated |
| D6 property/lease/document operations | P2 | Rich property lifecycle/matching, residential leases separate from holiday stays, recoverable media | Validated record/asset lifecycle with role tests; lease renewals/date boundaries; failures leave recoverable state |
| D7 international runtime | P2, before international release | Complete EN/ES first, org preferences, source currencies, timezone-aware operations; then additional languages/RTL/SEO | Full catalog coverage; currency never relabeled/implicitly converted; DST tests; public localized URLs exist and index correctly |
| D8 reliable integrations | P1 for existing live connectors; P2 expansion | Durable inbound jobs/outbox/retry, adapter contracts, Google/Meta staging, optional new providers | Signature/expiry/duplicate/out-of-order/partial-failure tests; consent honored; provider sandbox verified per agency |
| D9 SaaS administration/commercial layer | P3 | Invitations/offices/team management; configurable entitlements, future billing provider | Role matrix enforced server-side; invite expiry/single-use; signed billing events/retries; plan limits and cancellation verified; prices supplied by owner |
| D10 measured scale and AI | P3 | Pagination/aggregates/performance budgets, provider-independent useful AI | Large agency dataset correctness; Safari/Chrome real-browser measurements; no secrets in client; AI accuracy/cost controls before activation |

Cross-cutting gates: migrations staged with backups, live JWT/Storage/Edge tests, production build, regression suite, error observability and restore rehearsal. Resolve existing Instagram retry integrity before enabling live automation; do not wait for every future integration.

D1 and the white/red navigation portion of D3 are implemented locally in the operational delivery. Live Supabase activation and the original logo asset remain pending. Next product block: D4, alongside D2 booking integrity. Do not replace the working CRM with placeholder screens while these deliveries progress.

D4a delivered: explicit contact lifecycle, same-identity conversion, reversible archive, multi-role relationships and stage filters. Full D4 remains partial; see [CONTACT_LIFECYCLE](CONTACT_LIFECYCLE.md). Next D4 block is audited activity/transition history and the client dossier.

D4b delivered: linked dossier navigation, server-attributed changed-field events, manual notes/calls/meetings and idempotent retries. Complete before/after stage audit, global contact reconciliation and duplicate review remain; see [RECORD_ACTIVITY](RECORD_ACTIVITY.md). PR #16 has now merged and Vercel reports production success for its earlier CRM changes. D4b is a separate subsequent PR; its database activation remains pending.

D6a / Master prompt 2: deterministic matching, editable profiles, persistent shortlists/dismissals and contact/property-linked viewing creation implemented and locally verified. The 75-capability tracker records partial vertical and sales coverage without declaring Phase 2 complete. Next sales deliveries: auditable offer revisions, commission allocation/payment ledger, followed by specialized leases/development/co-brokerage workflows. See [MATCH_INTELLIGENCE](MATCH_INTELLIGENCE.md).

2026-10-15 property-first handoff: the primary execution order is now [CODEX_STATEHUBS_MASTER_CONTEXT](CODEX_STATEHUBS_MASTER_CONTEXT.md). PR #37 stabilization connects existing gallery assets, contact relationships, record activity and contextual matching without adding parallel modules; see [PR37_STABILIZATION](PR37_STABILIZATION.md). Next: activate and verify the owner-specified Supabase project, then transactional booking integrity and the remaining acquisition/Autopilot journeys. Linked booking display alone does not satisfy D2 collision protection.

Supabase core activation is now verified against the real project, including CRUD, roles, notes, matching decisions and private Storage. Next release prerequisites are Vercel client configuration and Resend domain/SMTP, followed by correcting the existing PR #21 booking guard rather than duplicating it. Evidence and limitations: [SUPABASE_ACTIVATION](SUPABASE_ACTIVATION.md).
