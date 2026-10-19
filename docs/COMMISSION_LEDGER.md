# Commission allocation and receipts

This increment extends the existing deal drawer on top of offers PR #23. It adds an explicit, fixed allocation plan and manual receipt ledger. It does not execute payouts, verify bank transactions, invoice customers, calculate tax or infer commission entitlement from a pipeline stage.

## Workflow

Choose a currency and agreed total; enter 1–50 distinct recipient labels and their allocated amounts. Allocations must equal the total exactly. Recipients are manually entered business labels, not verified bank payees or automatically linked agency members. The recorded plan is immutable; review the displayed warning before committing. Existing deal percentage/amount fields remain unchanged and do not automatically amend the ledger.

Record partial or full receipts against an allocation with a reference. The panel shows allocated, received and outstanding amounts, per-recipient balances and receipt history. Fully received plans hide the receipt form. Reload recovers persisted records. Failed requests preserve the draft and retry UUID. A receipt records the time it was entered; bank settlement dates are not inferred.

Amounts use integer minor units, with currency precision pinned in `currencyDecimals.ts` (for example JPY 0, EUR 2, KWD 3). Decimal input is parsed without floating-point multiplication; unsupported precision, negative amounts and unsafe ranges are rejected. Maximum plan size is 9,000,000,000,000 minor units. There are no exchange rates or implicit conversions.

## Database and security

Migration `20261019130000_commission_ledger.sql` adds ledger and receipt tables with RLS and authenticated read policies. Direct client writes are revoked. Creation/receipt RPCs require write access to the deal's workspace, derive the actor from the session and append activity notes in the same transaction. Viewers can read but not mutate. Anonymous calls and cross-agency reads/writes are denied.

Plan creation locks the deal and prevents replacing an existing plan. Receipt creation locks the ledger and sums existing receipts before admitting the next one; concurrent writers cannot collect beyond an allocation. Request UUIDs deduplicate exact retries and reject altered retries. All receipt pages are fetched for the displayed balances. Local/demo mode mirrors the contract with existing browser storage; it does not establish production database durability.

Deleting a deal/workspace cascades its ledger, consistent with existing CRM deletion behavior. This is not a statutory retention archive. No existing CRM records or historical amounts are rewritten by the migration.

## Evidence

- Production TypeScript/Vite build passes.
- 284 tests across 48 files pass, covering exact precision, allocation totals, duplicate recipients, partial/full receipts, overcollection, changed retries, permission UI and error recovery alongside existing CRM regressions.
- Lint: no errors, five existing warnings.
- PostgreSQL 16: existing isolation/access/activity/matching/offers suites plus commission ledger tests pass. Tests cover viewer and anonymous denial, cross-tenant visibility, direct-write denial, exact totals, retry deduplication, audit count and collection limits.
- Real concurrent PostgreSQL sessions compete to receive 700 units each from an allocation of 1,000. Exactly one commits; the other receives the outstanding-balance error. CI runs the same isolated test script.
- Chromium at 390 and 1440 px: allocate to two recipients, record a partial receipt, reload, settle both allocations; no horizontal overflow or page errors. Screenshots inspected locally.

## Activation and remaining work

PR depends on #23, which depends on #22. Apply the additive migrations before activating their frontends in production. No live Supabase application or authenticated production test is claimed; production credentials are still unavailable in this environment.

Commission rules/percentage calculation, automatic agent membership linking, editable plan amendments, partial refunds, tax/invoices, bank reconciliation and actual payouts remain unfinished. Do not use the ledger as a complete accounting system. Capability 38 remains partial, with this verified operational increment recorded in CAPABILITIES_75.md.

## M2.5 — full receipt reversals

Migration `20261019140000_commission_reversals.sql` adds a nullable, unique reference to the original receipt and an authenticated reversal RPC. Existing positive receipts remain unchanged. A reversal appends the exact opposite minor-unit amount to the same allocation, with a mandatory reason, server actor/time and an activity event. The original receipt remains visible and is marked reversed. This corrects the internal record, not a bank refund.

Reversals lock the same ledger as receipt creation. A receipt can be reversed only once; negative reversal entries cannot themselves be reversed. Request IDs make exact retries idempotent and reject changed retry payloads. Viewers, anonymous callers and other tenants cannot reverse. The restored balance can be collected again through the normal overcollection checks. Deletion still follows the existing deal/workspace cascade semantics.

The UI shows the selected amount/reference and requires an explicit confirmation with reason. Errors retain the reason and retry ID. Full reversals are supported; partial refunds, plan amendments, bank refunds and accounting approvals remain pending.

Verification: 289 tests in 48 files, build, lint (zero errors; five existing warnings), all existing PostgreSQL suites, dedicated reversal permissions/audit/retry tests and a two-session race proving only one reversal succeeds. Chromium at 390/1440 px verifies settled receipt reversal, persisted original/reason after reload, restored balance and corrected collection. No live production database activation is asserted.
