# Phase 2 — matching delivery (2026-10-13)

Built on main `89b6c8d`, retaining the working contacts, Kanban, activities, integrations and English workspace shell. This is a verified increment of Master Prompt 2, not completion of all its verticals.

## Implemented

- Purchase and long-term rental matching, reversed from a property to explicitly qualified contacts by default. Mixed buyer/tenant roles require explicit transaction intent.
- Criteria cover availability, intent, ISO currency, budget, exact normalized areas, type, rooms, bathrooms, floor area, use, must-have/excluded features and timeframe. Unverified absence of features remains unknown. Invalid dates and unknown currencies are not compared.
- Explainable heuristic score: matched criteria divided by applicable criteria. Missing essentials suppress the score; hard conflicts exclude suggestions. It is neither trained ML nor conversion probability. Existing dashboard matching now shares these strict rules.
- Editable additive JSON preference fields; no rewriting stored entity IDs or blueprint field keys. No currency or FX assumption. Property overview uses the recorded currency and marks unspecified currency explicitly.
- English cards with save/dismiss/restore, persistent workspace shortlist, links to related records, email handoff and creation of a linked viewing through the existing acknowledged record API. Explicit property-type feedback updates the contact; save/dismiss does not secretly train or modify preferences.
- Dormant contacts flagged after 30 days only when last meaningful contact is recorded. No automatic outreach. Sample and real records are never paired.

## Database and permissions

Apply `20261013140000_match_decisions.sql` after all earlier migrations, including record activity. It adds a workspace-scoped decision table and an authenticated RPC. The RPC validates both endpoints, entity types, sample boundaries, workspace and write permission, derives the actor on the server and records changed decisions in the contact activity history. Stable endpoint locking and the pair primary key prevent duplicate rows. Viewers may read; direct client writes are denied. Record deletion removes its decisions. Existing CRM data is not rewritten or deleted by this migration.

Shortlists are shared within a workspace, not personal lists. Decision reads are paginated; large-scale property/contact search still inherits the existing record loader's limitations. Browser-local workspaces use their existing local persistence and are not production database evidence.

## Verification

- `npm run build`: passed; existing large-chunk advisory remains.
- `npm test -- --maxWorkers=4`: 254 tests across 44 files. Includes matching conflicts/missing facts, duplicate decisions, save failure, read-only controls, linked viewing creation and existing CRM/duplicate-detection/sales regressions.
- `npm run lint`: no errors; five existing warnings.
- PostgreSQL 16: negative tenant RLS, workspace access, record activity and match decisions suites pass. Decision suite checks duplicate pair/audit behavior, cross-tenant rejection, invalid endpoint roles, direct-write denial and viewer read/write separation. CI includes the additive migration and tests.
- Chromium at 390 and 1440 px: keyboard search, save, reload/reopen persistence, schedule viewing, dismiss, restore and reverse matching pass; no page errors or horizontal page overflow. Screenshots inspected locally.

## Deployment and remaining scope

No live Supabase or Vercel activation is asserted. This environment lacks the project credentials needed to apply the migration or exercise authenticated live-provider responses. Review/apply the migration before deploying the frontend; then verify owner/agent/viewer sessions against the real project. Google/Instagram adapters were reviewed and retained, but no provider integration is claimed live.

Instagram matching only consumes already authorized, captured CRM records; it does not scrape social profiles. Calendar creation is an internal viewing; external synchronization still depends on existing configured credentials and provider success. Workspace-local appointment times inherit the existing calendar model; multi-timezone scheduling remains partial.

Offers/negotiations with revision history, commission split/payment ledger, full lead merge/dedup resolution, reminders, development inventory, renovation accounting, co-brokerage mandates, leases/renewals and owner portals remain unfinished. The existing generic modules are retained, not recreated or represented as complete specialized workflows. Legacy field labels still need full localization. See CAPABILITIES_75.md and FEATURE_MATRIX.md for scope.

## Concurrent proposals

At publication, PR #20 independently proposes a workspace matching desk with session-only decisions and a different engine; PR #21 proposes broader module foundations. Neither is part of verified main `89b6c8d`. Do not merge two independent matching engines unchanged: any retained workspace desk should consume this shared engine and decision API. This PR preserves main and does not overwrite those branches. Capability trackers also need consolidation if #21 is adopted.
