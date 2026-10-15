# StateHubs Intelligence Experience — v1

## Product principle
**One operation, one canonical source of truth, one next action.** This iteration reuses the existing CRM record model, Today queue, and matching engine. It does not introduce competing lead, property, or deal tables.

## Delivered in this PR
1. **Today Intelligence** — deduplicated, explainable priority queue for overdue/due/upcoming CRM records. Opens the real record for action. It does not send messages.
2. **Autopilot proposals (supervised)** — suggested next steps from actual CRM deadlines; opens the record for review. No automatic outbound communication, writes, or jobs.
3. **Deal Momentum** — review of existing deals for overdue/missing next actions, without invented AI probabilities.
4. **Opportunity Universe** — responsive, cinematic dark relationship visualization with SVG curves and focus transitions. Uses the existing `matchOpportunities` scoring and real CRM records. Node selection and opening the record are interactive; no fictional nodes.
5. **No duplicate matching surface** — one switch between existing Match Cards and Opportunity Universe, powered by the same engine.

## Still to build before marketing as autonomous AI
- Persisted workflow rules, scheduled execution, retries, tenant-scoped RBAC/RLS, audit logs, approval queue and consent checks.
- Command Bar with safe structured intents and action previews (current Ctrl/⌘K remains search/navigation).
- Full opportunity graph controls (zoom/pan, keyboard node navigation, motion preference support, performance at scale).
- Persistent next-action ownership and deal health analytics with historical data.
- Backend verification, tests and end-to-end validation.

## Quality gate
Run typecheck, lint, unit tests, build, auth/RLS regression and responsive UX checks. This PR must not be considered production-ready until verified.
