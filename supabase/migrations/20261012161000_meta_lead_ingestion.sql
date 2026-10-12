-- Meta / Instagram lead intake (pilot)
-- Webhook events are stamped on CRM records for idempotency. The webhook uses
-- the service role only on the server; never expose it to the browser.
alter table public.crm_records
  add column if not exists source text,
  add column if not exists external_event_id text;

create unique index if not exists crm_records_external_event_unique
  on public.crm_records (source, external_event_id)
  where source is not null and external_event_id is not null;

comment on column public.crm_records.source is
  'Origin connector, e.g. meta_leadgen. Set by trusted server-side ingestion.';
comment on column public.crm_records.external_event_id is
  'Provider event/lead ID used to prevent duplicate imports.';
