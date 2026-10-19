# Deal negotiation history

This delivery extends the existing `operacion` record drawer, on top of matching PR #22. It does not introduce a parallel deal module.

## Workflow

A deal with a contact and property can record its initial offer with an explicit amount and ISO currency. Each counteroffer appends new terms. Acceptance, rejection and withdrawal preserve the last terms and end that negotiation. A new negotiation after a terminal decision uses a separate deal. Acceptance records an internal commercial decision; it does not change the pipeline stage, execute a contract, reserve a property, calculate commissions or move money.

The history displays the latest 100 revisions; all revisions remain in the database. Each stores the original contact/property IDs, amount, currency, notes, actor and server time. No FX conversion is performed. The interface uses English strings and existing white/red CRM tokens. Viewers see the history without mutation controls.

## Persistence and concurrency

Migration `20261019120000_deal_offer_history.sql` creates an additive RLS-protected table and a security-definer RPC with an empty search path. Only members with write access can append. Every append validates the deal, associated contact and property in the same workspace and sample/real boundary. The actor is derived from the session. Direct insert, update and delete permissions are absent for authenticated clients.

A row lock on the deal serializes concurrent submissions; expected revision rejects stale edits. A request UUID makes retries idempotent and rejects reuse with altered terms. The client retains the request UUID after a failed request and regenerates it when the draft changes. The history and an activity note are inserted in the same transaction. Relationships cannot switch mid-negotiation; create a separate deal instead. Deleting the deal or workspace cascades its history, consistent with existing CRM deletion semantics; this is not a statutory immutable retention archive. Deleted contact/property IDs remain historical references.

The local demo API mirrors the transitions and validation using existing browser storage. That storage does not demonstrate live SaaS persistence. No existing records or blueprint fields are migrated or rewritten.

## Verification and activation

- Production build passes.
- Full suite: 267 tests in 46 files, including offer lifecycle, immutable prior terms, retry deduplication, stale writes, invalid currencies/amounts, changed relationships, read-only UI and failed-request draft preservation.
- Lint: zero errors, five pre-existing warnings.
- PostgreSQL 16: all existing tenant/access/activity/matching suites and the new deal-offer suite pass. New checks cover cross-agency reads/writes/relations, viewer access, direct-write denial, stale revisions, altered retries, terminal transitions and audit counts.
- Responsive Chromium workflow at 390 and 1440 px: submit, counter, reload, accept and retain revision history. No page errors or horizontal overflow.

Apply this migration after the preceding migrations, including record activity, before enabling this frontend in a live Supabase project. Actual authenticated production sessions and Vercel production publication remain unverified. No new external integration or provider credentials are needed for this internal workflow; existing production access is still needed for activation.

## Remaining scope

One negotiation stream per deal; parallel competing offers, expiry, attached signed documents, approval limits, seller/buyer-side attribution and legal acceptance are not yet modeled. Commission allocation/payment ledger, controlled pipeline transitions and specialized lease/development/ownership workflows remain separate unfinished milestones. See CAPABILITIES_75.md.
