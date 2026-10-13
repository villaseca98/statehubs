# D4b — linked dossier and activity, 2026-10-13

## Scope

The record drawer now groups declared incoming and outgoing relations with clickable links and a return-to-previous-record action. Contact dossiers additionally include properties referenced by their own deals and appointments. Only authorized records already loaded in the workspace are candidates; free text is never interpreted as a relation, and duplicate property links appear once.

Saved workspaces support notes, logged calls and logged meetings. These are internal activity records and do not send communications. A failed submission retains its text and idempotency key for retry. Read-only users can inspect the history but cannot submit activities. EN/ES catalogs cover new controls. Public demo mode explicitly reports that it does not persist activity; saved browser workspaces support local history without verified authors.

## Database

Apply `20261013120000_record_activity.sql` after the previous nine migrations. It adds `crm_record_events`, a record insert/update trigger and `crm_add_record_activity`. The trigger records the authenticated actor, database timestamp and changed field names; it does not copy entire records or sensitive old/new field values. No-op patches do not create events. Explicit notes contain the user-submitted text, limited to 4,000 characters.

Authenticated clients have SELECT only, scoped by app membership/RLS. All explicit inserts use the authorized RPC; actor, record scope and timestamp are derived server-side. Request UUIDs deduplicate exact retries and reject reuse with another payload or record. Direct client INSERT/UPDATE/DELETE is denied.

History starts at migration activation; earlier activity is not invented or backfilled. Deleting a parent record/workspace cascades to its events, preserving existing deletion behavior. This is operational history, not a permanent forensic retention system. Detailed old/new stage transitions, retention policies, export, team-friendly author names and full paginated history remain future work; the UI displays the latest 50 events with local-time formatting. Browser history is not a trusted audit source.

## Verification

236 tests pass across 41 files; production build/typecheck pass; lint has zero errors and five existing warnings. PostgreSQL 16 tests cover tenant boundaries, viewer read/write, forged/edited/deleted events, request deduplication, payload conflict, blank activity rejection, automatic events and no-op updates. Existing tenant and workspace suites also pass with the new trigger installed.

## Deployment diagnosis

GitHub deployment metadata confirmed that PR #16 (`feat/unified-crm-access` → `main`) was still open and recent successful Vercel builds were **Preview** deployments. Production pointed to `536ed3e`; therefore a Ready preview did not update the production domain `statehubs.vercel.app`. Integrating the PR changes the production source; database migrations and environment configuration remain separate release requirements. No live Supabase migration was executed by this delivery.

Browser checks at 390 and 1440 px verified saving a note, navigating to a linked deal, returning to the contact with activity retained, Escape and no horizontal overflow. Duplicate React sibling keys in the record drawer were also corrected to prevent repeated field/calendar sections during reconciliation.
