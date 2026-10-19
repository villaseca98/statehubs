# Feature matrix — repository evidence, 2026-10-12

Implemented means code exists and the indicated local workflow is covered; it does not mean deployed. Partial means material acceptance criteria remain. External providers were not configured or contacted in this delivery.

| Capability | Status | Evidence / missing acceptance |
| --- | --- | --- |
| Blueprint modules, proposal/preview/apply/restore | Implemented locally | modules/validate/localApi + AppPage tests; server RPCs still owner-only |
| Browser demo CRUD | Implemented locally | localApi tests; storage errors silently fall back, not durable SaaS storage |
| Server CRUD | Partial | api.ts + RLS; live JWT workflow unverified, acknowledged writes and atomic conflict-aware patches now implemented; live deployment pending |
| Leads | Partial | worklist/stages/filters/actions; no conversion, archive, bulk actions or activity ledger |
| Clients/contact identity | Partial | contacto_inmo lifecycle conversion, reversible archive and multiple roles implemented; legacy cliente/lead reconciliation and independent client dossier pending |
| Pipeline | Partial | Kanban and stored stage values; no event history or transactional transition rules |
| Activities/tasks | Partial | cita/tarea/servicio and Today; record activity timeline and linked dossier implemented; reminder worker and cross-record timeline pending |
| Dashboard | Partial | real-record counts, priorities and tests; no role-specific or complete organization metrics |
| Advanced search/filter/saved views | Partial | filters + CommandPalette tests; local datasets and browser-local saved views |
| Duplicate detection | Partial | analysis.ts reporting; no identity merge/uniqueness workflow |
| Properties | Partial | card grid with real indicators, universe/deal filters, search, sort; per-property mini-CRM (leads, conversations, viewings/bookings, deals, activity); maps/listing syndication absent |
| Property matching | Implemented locally | One deterministic engine (`matching.ts`, English aliases) for record panel, Matcher, map and search; swipe Matcher persists saved/dismissed through `crm_set_match_decision`; session-only MatchDesk removed (AUDITORIA_CONSOLIDACION_2026-10-19.md) |
| Holiday rentals | Partial | reservations/services/incidents/timeline tests; transactional booking exclusion absent |
| Residential rentals | Planned | no dedicated lease, rent schedule or renewal domain |
| Calendar | Partial | timeline day/week/month, appointment helpers; global timezone migration pending |
| Google Calendar | Implemented; configuration/verification pending | crm-google OAuth/status/push/busy, helper tests; no live credentials/JWT/provider check |
| iCal | Implemented; live verification pending | crm-ical + parser/sync tests; availability import only, no prices/messages/payments |
| Instagram assistant | Partial; live release blocked | OAuth/signed webhook/bot; retry/idempotency failure window, Meta approval/credentials unverified |
| Meta lead ingestion | Partial; configuration pending | signed ingress, source/event dedup; fixed destination app, potential invisible entity in pack |
| Conversation inbox | Partial | three-column inbox over `conversacion` records, transcript bubbles, context panel, internal notes; outbound replies and WhatsApp/email/web adapters not implemented and shown as not connected |
| WhatsApp/email | Link actions only | tel/mailto/wa.me; no WhatsApp Business or email inbox adapter |
| Webhook automation | Partial | matching/payload/public URL checks; no durable jobs/retries/audit, before data from caller |
| AI blueprint assistant | Implemented; provider verification pending | crm-agent + shared validation; no general AI CRM copilot |
| Private photos/PDF | Partial | private bucket/RLS helpers/upload/signed URLs; non-atomic metadata and no document versioning |
| Organizations/roles | Partial | migrations + SQL negative tests; current member blueprint and team administration implemented; email invitations pending |
| Offices/teams/manager/platform roles | Partial | confirmed-email platform bootstrap and agency/team administration implemented; offices/manager hierarchy pending |
| Native EN/ES localization | Partial | entry points and helpers only; interior translation/browser detection pending |
| Other eight languages/RTL/international SEO | Planned | no complete catalogs, routes, hreflang or sitemap |
| Multi-currency/global org settings | Partial | columns/helpers; runtime still EUR/Madrid in many paths |
| Analytics | Partial | pure analysis/reporting/CSV; incomplete datasets, no audited revenue/FX model |
| Billing/plans/entitlements | Planned | no provider, subscription model or enforced plan limits |
| Audit/retention/export/backup recovery | Partial/planned | blueprint history and analysis CSV exist; server-attributed creation/changed-field events and manual activity implemented; before/after audit, tenant export and tested restore pending |
| Vercel production release | Unverified | local build succeeds; actual deployment logs/status unavailable |

Release dependencies and verification scope: [DEPLOYMENT](DEPLOYMENT.md). Proposed implementation order: [ROADMAP](ROADMAP.md).

Current operational delivery and activation: [OPERATIONAL_DELIVERY](OPERATIONAL_DELIVERY.md). Competitive proposal and research limits: [COMPETITIVE_PROPOSAL](COMPETITIVE_PROPOSAL.md).

D4a contact lifecycle implementation and limits: [CONTACT_LIFECYCLE](CONTACT_LIFECYCLE.md).

D4b linked dossier and activity evidence: [RECORD_ACTIVITY](RECORD_ACTIVITY.md).

PR #37 stabilization: property-first home, contextual gallery/leads/internal activity/linked bookings and simplified navigation now reuse existing records and services. Local verification and external activation limits are recorded in [PR37_STABILIZATION](PR37_STABILIZATION.md). No new schema or live deployment is claimed; transactional booking collision prevention and official provider Inbox remain pending.

Supabase activation update: all 12 migrations and six Edge functions are deployed to the owner-supplied project. Real JWT/role/tenant/Storage tests and connected browser note persistence pass. Public email, Vercel build-time variables and live provider integrations remain external blockers; see [SUPABASE_ACTIVATION](SUPABASE_ACTIVATION.md).
