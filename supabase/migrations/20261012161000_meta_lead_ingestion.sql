-- Meta / Instagram lead intake (pilot)
-- External event identifiers are set by a trusted server-side webhook only.
-- Never expose the service-role key to the browser.
alter table public.crm_records
  add column if not exists source text,
  add column if not exists external_event_id text;

create unique index if not exists crm_records_external_event_unique
  on public.crm_records (app_id, source, external_event_id)
  where source is not null and external_event_id is not null;

create or replace function public.crm_protect_external_record_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and (new.source is not null or new.external_event_id is not null) then
      raise exception 'Los campos de origen externo solo los puede escribir el conector del servidor';
    end if;
    if tg_op = 'UPDATE' and (
      new.source is distinct from old.source or
      new.external_event_id is distinct from old.external_event_id
    ) then
      raise exception 'Los campos de origen externo solo los puede escribir el conector del servidor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_protect_external_record_fields on public.crm_records;
create trigger crm_protect_external_record_fields
before insert or update on public.crm_records
for each row execute function public.crm_protect_external_record_fields();

comment on column public.crm_records.source is
  'Origin connector, e.g. meta_leadgen. Set by trusted server-side ingestion.';
comment on column public.crm_records.external_event_id is
  'Provider lead ID used to prevent duplicate imports within an app.';
