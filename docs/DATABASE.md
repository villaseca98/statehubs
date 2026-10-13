# Database and domain model

## Existing schema

| Table | Purpose / relationships |
| --- | --- |
| crm_organizations | Owner in auth.users; unique owner; settings JSONB and phase 11 locale/country/currency/timezone/units/markets columns |
| crm_org_members | Composite PK org/user; owner/admin/agent/viewer; one owner index |
| crm_apps | Owner, immutable org, current blueprint version; unique id/org |
| crm_records | App FK and composite app/org FK; entity discriminator, JSON data, sample flag, timestamps, protected provider source/event ID |
| crm_app_versions | App/version unique; immutable snapshots of blueprint through privileged RPC flow |
| crm_proposals / crm_messages | App-scoped proposed blueprint changes and assistant conversation; not a general record activity log |
| crm_google_accounts | User OAuth credentials; server only |
| crm_instagram_accounts / crm_instagram_events | App connection and dedup event IDs; server only |
| storage.objects / crm-property-media | Private image/PDF paths `app/record/asset.ext`; permission helpers verify property and agency |

The nine migration files must run in timestamp order. Phase 09 backfills organizations and org IDs while preserving records. Phase 10 enforces non-null tenant scope and explicit privileges. Phase 11 adds optional localization metadata. The repository does not prove that any migration is installed on a live project.

`crm_records.entity` includes `lead`, `cliente`, `contacto_inmo`, `inmueble`, `operacion`, `oportunidad`, `cita_inmo`, `reserva`, etc. Their relationships are strings inside JSON, **not foreign keys to another record**. Money fields are JSON numbers. Blueprint versions are not record-data history.

## Target decisions (not migrated in this delivery)

- Canonical contact identity per org, plus multi-valued client roles. A lead references identity and retains source, lifecycle and conversion metadata; a client relationship is established explicitly, with agency-defined criteria.
- Introduce a legacy identity map `(org_id, legacy_record_id, contact_id)`. Preserve IDs, existing links and original values. Dedup by normalized phone/email suggests candidates; never automatically merge shared family/company contact details.
- Conversion is one authorized, idempotent transaction: qualify lead, attach/create identity, create client role(s), record conversion/activity and preserve existing links. Retried conversion must not duplicate clients.
- Relational opportunities, stage events, tasks and activities reference tenant-scoped contacts/properties. Use composite org foreign keys and server permission checks; audit actor/time/action without indiscriminate copies of PII.
- Separate residential lease/rent schedules from holiday reservations. Reservations use property/date range with exclusion constraints for conflicting active stays; concurrent attempts must yield one success and one clear conflict.
- Financial amounts use decimal NUMERIC or explicitly scaled integer minor units plus ISO 4217 code. Keep original/reporting/display currencies separate; add conversions only with sourced, dated rates.
- Property ownership supports multiple owners and contact roles; document metadata references authorized entities, with recoverable storage workflows.

## Migration discipline

Expand first, backfill with audited counts and explicit ambiguous cases, dual-read through adapters, compare results, then switch writes. No destructive contraction in the initial releases. Stage on a copy, test two agencies and every role, test concurrent transactions, and verify old blueprints/local data remain usable. Backup/rollback must be rehearsed before production execution; existing rollback scripts are not permission to run them.

## Contact lifecycle compatibility layer

D4a adds optional JSON record fields without migrations or automatic backfills. `contacto_inmo` keeps its ID; `crm_lifecycle`, `crm_archived` and `crm_role_<role>` describe its commercial state. Missing lifecycle is unclassified. These fields do not grant permissions and are not an audit log. See [CONTACT_LIFECYCLE](CONTACT_LIFECYCLE.md).
