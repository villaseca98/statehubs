# Phase 1 — Consolidation audit (2026-10-15)

## Baseline and limits

Audited GitHub `main` at `89b6c8d6bf954ce65ac61eb218da802565072145` and the available PR metadata, source files and prior repository audit. This is **not** a browser, production, Supabase, or integration verification. Prior documents describe 2026-10-12 state and must not be treated as current release evidence.

**Product:** StateHubs, international real estate CRM/ERP. **English is the default UI language**, but existing Spanish blueprint identifiers must be preserved. **Multiple business verticals can be enabled simultaneously**. Existing functionality and data must survive each increment.

## What is already in main

| Phase 1 capability | Current evidence | Classification |
| --- | --- | --- |
| Configurable CRM | Blueprint-driven workspace, local/server API and CRUD components; `docs/FEATURE_MATRIX.md` | Partial; production not verified |
| Card-first UI | `CardsView.tsx`, `Workspace.tsx`, CRM component library | Partial; interaction coverage varies |
| Ivory/coral design | Merged PR #18; `theme.ts` | Implemented in code; visual QA pending |
| Microinteractions and accessibility | Existing dialog keyboard tests, motion library, phase 08 | Partial; not end-to-end tested |
| Role-based login and permissions | Merged PRs #12–#17; auth, organization membership and RLS migrations | Partial; live JWT/RLS deployment not verified |
| Role dashboards | `OperationsDashboard.tsx`, Today and analytics | Partial; not fully tailored to roles |
| Card-based onboarding | Workspace creation flow and agency entry | Partial; vertical selection not fully integrated |
| Multi-vertical simultaneous | Blueprint modules support different entities; PR #21 proposes module planner | Partial; per-organization persistence/UX not verified |
| Composable modules | `supabase/functions/_shared/blueprint/modules.ts`; PR #21 typed registry | Partial; PR #21 unmerged |
| English-first UI | `src/i18n/index.tsx` defaults to English, merged PRs #15/#19 | Partial; many inner strings remain Spanish |
| Contextual actionable cards | CardsView, Today and RecordPanel | Partial; action coverage varies |

**No Phase 1 capability is certified as production-ready by this audit.** Some are locally implemented, but no new deployment verification was performed.

## Active parallel work — avoid duplication

| PR | Workstream | Status at audit | Integration concern |
| --- | --- | --- | --- |
| #20 | Match Intelligence cards | Open | Session-only shortlist and exclusive business-mode selector must not supersede multi-vertical model |
| #21 | OS module planner, domain types, booking calendar/overlap work | Open | Overlap migration must be validated against actual `crm_records` schema and SQL test harness before application |
| #22 | Currency-aware matching and persistent shortlists | Open | Likely overlaps #20; reconcile on a common base rather than merging both blindly |
| #23 | Audited offers and negotiation history | Open | Review against current deals/contacts domain |
| #24 | Commission ledger | Open | Dependencies on deals and receipt integrity |
| #25 | Commission reversals | Open | Depends on #24; preserve ordering and ledger invariants |

All five workstreams after #20 were observed open; this document does not assert CI or merge readiness for them.

## Priority decisions for Phase 1

1. **Integrate, don't rewrite:** review #20–#25 and #21 for overlap and dependency order. Keep `main` protected from failing or unreviewed merges.
2. **Finish English UI:** inventory remaining user-facing Spanish strings in `AppPage`, booking calendar, record forms and dynamic blueprint labels. Add translations without changing stored keys. Use catalog entries for new UI.
3. **Multi-vertical organization setup:** persist a *set* of enabled business modules per organization; toggling a module must never delete records. Replace exclusive selector patterns.
4. **Role-aware dashboard:** confirm real permissions for owner/admin/agent/viewer, including read-only actions, and avoid fake KPI values.
5. **Accessibility:** verify 390px layout, keyboard navigation, focus restoration, accessible names and reduced motion with actual browser tests.
6. **Reliability:** maintain tenant RLS negative tests, mutation acknowledgement, conflict recovery, and separate Edge Function validation.
7. **Update tracker:** after each PR, record file evidence, tests, local status and independently verified deployment status.

## Release gates

- Run repository scripts: `npm run lint`, `npm test -- --maxWorkers=4`, `npm run build`.
- Run SQL negative/security tests for any database migration and inspect the exact target schema.
- Verify UI in a real browser at 390px and desktop; do not claim browser QA from unit tests.
- Never mark external integrations, signature providers, AI workflows or production deployment live based on mocks.
- Never silently merge branches or apply production migrations.

## Next code increment

Build a small, tested, organization-scoped **multi-vertical selection** utility and wire it into the existing workspace after reconciling PR #21. Then audit/translate remaining visible strings in the working CRM, without changing legacy entity keys.
