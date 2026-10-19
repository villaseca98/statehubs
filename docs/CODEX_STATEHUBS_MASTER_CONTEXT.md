# StateHubs — Product vision and Codex handoff

Last updated: 2026-10-15. This document records the founder's intended experience and is NOT a claim that every feature is implemented.

## Non-negotiable direction

StateHubs is an English-first, internationally usable CRM for real estate sales, long-term rentals, and holiday rentals. The product must feel modern, exceptionally elegant, minimal and intuitive. **One property, one card, one authoritative record.** Avoid stacked dashboards, duplicate intelligence views, dead buttons, decorative fake metrics, and modules that repeat the same workflow. Prefer progressive disclosure: reveal advanced functions only inside the relevant property or one secondary tools menu. Mobile responsiveness and accessibility matter.

## Core navigation

- **Properties**: default home, immersive property-first feed, photo-forward cards and swipe-like navigation. Top-level visual tabs: **Real Estate** and **Holiday Rentals**. Under Real Estate: **For sale** and **For rent**. Avoid Notion-style dense filter forms. Optional advanced filters for location, price, rooms, availability.
- **Inbox**: unified, permission-aware conversations, with actual provenance.
- **Calendar**: visits and rental bookings, with conflict prevention.
- **More**: configuration, reporting and other infrequent tools. Command Bar (Cmd/Ctrl+K) for fast search and creating records.

## Each property card is a contextual mini-CRM

- Photo gallery, title, price, location, specifications, property status; next/previous or swipe gestures. Clear upper-left overflow menu: open/edit, delete (permission check + confirmation), and contextual actions.
- **Details**: description, photos, documents, owners, status.
- **Leads**: separate **Qualified** and **Potential interest**. Expand a lead to show email/phone **only if explicitly recorded and authorized to view**. Explain qualification; do not fabricate scores. Link to Match Engine to find alternatives or buyers.
- **Social / Activity**: Instagram-like comments and conversation timeline, but distinguish Instagram comments, Instagram DMs, internal notes and AI-generated responses. Only show actual synchronized content; never invent comments or pretend CRM notes are public Instagram comments.
- **Bookings**: sale/rental viewings vs holiday rental reservations (nights, availability, check-in/out). Use existing calendar and booking entities; prevent overlaps and double booking.
- **Management**: offers, pipeline, tasks, follow-up, documents, agent assignment, approved automations and history, progressively disclosed.

## Lead acquisition and AI

Desired journey: someone comments on a connected Instagram property post or sends a DM -> permitted official Meta integration/webhook receives event -> AI responds only within authorized platform capabilities and consent rules -> asks relevant qualification questions (budget, needs, timeline, viewing preference) and optionally requests email/phone voluntarily -> stores source, consent/provenance, message IDs, property link, qualification evidence -> creates/updates one CRM contact, deduplicating by stable identifiers -> routes to agent or Match Engine -> offers booking/visit when appropriate -> logs outcomes. **Never claim unsolicited DMs are always permitted, or that comments reveal private email/phone.** Integrations require actual Meta app, permissions, tokens, webhook setup, policies and data protection safeguards.

## Existing feature families — integrate, don't clone

Today Intelligence (daily priority actions), Match Engine (explainable buyer/property matches), Autopilot (owner-approved internal automation and eventual authorized outbound actions), Deal Momentum (stage/next-action health), Command Bar (search/create/navigation), Opportunity Universe (optional high-quality visual alternative to match cards). These are engines/views, not six dashboards to stack on Home. Every action must be grounded in real data and route to a useful operation.

## Implementation and verification rules for Codex

1. Inspect actual `main`, open PRs, database migrations, and existing components BEFORE implementing. This document may be ahead of deployed code.
2. Preserve a single source of truth in existing CRM records and Supabase. No fake contacts, comments, bookings, scores or AI conversations.
3. Integrate existing engines into property card and Inbox/Calendar, not duplicated panels.
4. Build complete vertical slices: schema/RLS -> service/API -> UI -> permissions -> loading/empty/error states -> automated tests -> responsive and keyboard accessibility -> deployment documentation.
5. Never assume Supabase migrations, secrets, Meta permissions or worker schedules have been deployed. Flag external configuration explicitly.
6. Run typecheck, tests and build. Fix failures before marking a PR merge-ready. Distinguish CI failures from Vercel quota/rate-limit errors.
7. Keep UI copy English by default, ready for international localization.
8. Prioritize useful daily workflows over visual extravagance; optional animated Opportunity Universe only when practical and performant.

## GitHub workstream status at handoff

- PR #32 Deal Momentum, #33 Match Intelligence, #35 Command Bar: merged into main in the prior session.
- PR #34 Autopilot and #36 Focused Home: had merge/check blockers; **verify live GitHub status** rather than relying on this note.
- PR #37 Property-first CRM: branch `fix/clean-crm-home-no-duplicate-panels`. Work in progress: property feed, visual market filters, property actions, linked bookings and qualified/potential leads. **Not a complete Instagram integration, not an end-to-end AI lead funnel, not fully tested or necessarily merged.**
- Existing components may include `PropertyFeed.tsx`, `PropertyLeads.tsx`, `Workspace.tsx`, `MatchDesk.tsx`, `CommandPalette.tsx`, `DealMomentumBoard.tsx`; inspect before changing.

## Recommended next execution order

1. Stabilize and test PR #37, repair all JSX/type errors, review navigation and remove stacked duplicate dashboards.
2. Implement polished property card interactions and responsive media gallery; preserve edit/delete permissions.
3. Implement actual persistent property-specific notes/comments, lead relations and evidence-based qualification.
4. Integrate viewings/bookings with real availability and collision detection.
5. Integrate existing Match Engine and approved Autopilot with these records.
6. Design official Meta connector + webhook + deduped conversation storage and opt-in AI qualification, with security and tests.
7. Validate complete user journeys with real Supabase setup and deployment, not mocked demos.

## Founder experience requirement

The owner explicitly dislikes the current chaos: too many open, repeated, often nonfunctional features. Before adding any UI, ask whether an existing contextual surface can own it. Default home should be visually calm: a beautiful property card, two market filters, sale/rent toggle, four concise card tabs, and one collapsed area for secondary tools. The value must be real operations completed, not the number of features displayed.
