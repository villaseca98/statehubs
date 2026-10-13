# D4a — contact lifecycle, 2026-10-13

## Delivered

In real-estate packs, `contacto_inmo` is already the shared identity referenced by visits, deals and properties. The contact drawer now supports explicit lead/client classification, conversion, reversible archive and multiple relationship roles. Conversion patches the same record rather than creating a second person. The contact view offers all/unclassified/leads/clients/archived filters, combined with existing search and advanced filters. New controls have English and Spanish catalogs.

Old contacts remain unclassified until an agent chooses their lifecycle; neither calls nor a closed temperature automatically imply conversion. The existing `tipo` remains the primary role; additional buyer, seller, owner, tenant, investor, guest and partner roles are independent flags. Archive is reversible and does not delete records, linked deals or pending tasks.

## Persistence and permissions

Additive JSON fields in existing `crm_records.data`: `crm_lifecycle` (`lead`/`client`), `crm_archived` (boolean), and `crm_role_<role>` (boolean). No table migration or rewrite of existing blueprints is required. Existing per-record atomic patches, conflict checks and agency RLS apply. Conversion and role controls are unavailable in read-only/preview mode. Browser mode uses the matching local API; demo mode remains explicitly temporary.

Roles describe commercial relationships, never authorization. These fields are mutable record data, not an immutable audit log. Preserve the current blueprint keys and record IDs. Generic legacy `lead` and `cliente` entities are not automatically merged or migrated by this delivery.

## Verification and limits

Build/typecheck and 230 tests pass; lint has zero errors and five existing warnings. Tests cover legacy classification, repeat conversion, multi-role selection, read-only controls, restoration and persistence without losing linked records. Browser verification covers mobile (390 px) and desktop (1440 px).

This is part of D4, not the complete Clients module. Separate navigation destinations, audited transition history, actor/timestamps, canonical legacy mapping, duplicate review, bulk operations and client-specific dossier still remain. Contact-stage filter selection currently lasts for the mounted workspace and is independent of named saved views. Production Supabase/Vercel activation is still unverified.

Next: a tenant-scoped activity/transition history and client dossier, followed by legacy identity reconciliation and duplicate review. Booking integrity remains an independent P0 release gate before production reservation use.
