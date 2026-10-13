# Architecture: current and target

## Current

React SPA → `crmApi` (Supabase browser client) or `localCrmApi` (localStorage). `AppPage` coordinates records, proposals and integrations; `Workspace` renders blueprint-defined views. Shared pure code under `supabase/functions/_shared/blueprint` validates/composes blueprints and calculates operations, analysis, calendars and automation matches. Supabase persists apps, versions, records, organizations and memberships. Deno functions call provider APIs with server credentials.

Retain this structure and the stable entity keys. It enables reversible module changes and tested local workflows. Its limits are broad orchestration in AppPage, weakly typed database access (`any`), JSON domain relationships, owner-only blueprint administration, and missing backend mutation/audit contracts.

## Target, incrementally

1. **Presentation:** shared CRM shell, navigation groups, tokens, translated domain labels, accessible dialogs and reusable table/filter/record states. Do not add empty menu destinations.
2. **Application services:** typed contact conversion, record patch, stage transition, booking and document commands. Resolve organization/user permissions once for presentation; always verify again on the server.
3. **Domain:** pure validation/matching/formatting functions; explicit original currency, local dates versus instants, and contact roles. Keep existing blueprint extensibility for optional fields.
4. **Persistence:** additive relational invariants for core operations alongside legacy JSON; RPC transactions, optimistic version checks, typed Supabase schema, scoped pagination and aggregates. See DATABASE.
5. **Integrations:** provider adapters for calendar, lead ingress, messaging, storage, AI and future billing; durable inbound event status and outbox/retry jobs. No network side effects before authorization/consent and successful persistence.
6. **Operations:** versioned migrations, staged RLS tests, redacted errors/audit, measured browser performance and backup/restore rehearsal before release.

Do not split into microservices or replace the runtime to achieve these boundaries. Existing calendar/iCal/bot helpers remain shared domain code; extract orchestration only when a delivery needs it. A transaction's authoritative state belongs to Postgres, not a component's optimistic copy.

Collaboration must expose the current runtime blueprint to authorized members while keeping proposal/history/AI administration owner-restricted until explicitly designed. Agency admin, manager, offices and platform administrator need a written permission matrix; do not infer superuser permissions from labels.
