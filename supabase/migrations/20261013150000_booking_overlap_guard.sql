-- Protect holiday booking inventory at the database boundary.
-- Existing conflicts remain untouched; new conflicting inserts/updates are rejected.
-- This trigger complements (not replaces) tenant RLS.
create or replace function public.crm_prevent_booking_overlap()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_asset text;
  v_start date;
  v_end date;
begin
  if new.entity <> 'reserva' or coalesce(new.data->>'estado','') = 'cancelada' then
    return new;
  end if;
  v_asset := nullif(btrim(new.data->>'alojamiento'),'');
  if v_asset is null then
    raise exception 'Booking requires a property' using errcode = '23514';
  end if;
  if (new.data->>'entrada') !~ '^\d{4}-\d{2}-\d{2}$'
    or (new.data->>'salida') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Booking requires ISO check-in and check-out dates' using errcode = '22007';
  end if;
  v_start := (new.data->>'entrada')::date;
  v_end := (new.data->>'salida')::date;
  if v_start >= v_end then
    raise exception 'Check-out must be later than check-in' using errcode = '23514';
  end if;
  -- Serialize writers for the same organization/app/property. Prevents simultaneous
  -- inserts from both seeing an empty availability window.
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text || ':' || new.app_id::text || ':' || v_asset, 0));
  if exists (
    select 1 from public.crm_records r
    where r.org_id = new.org_id and r.app_id = new.app_id and r.entity = 'reserva'
      and r.id <> new.id and coalesce(r.data->>'estado','') <> 'cancelada'
      and r.data->>'alojamiento' = v_asset
      and (r.data->>'entrada') ~ '^\d{4}-\d{2}-\d{2}$'
      and (r.data->>'salida') ~ '^\d{4}-\d{2}-\d{2}$'
      and (r.data->>'entrada')::date < v_end
      and (r.data->>'salida')::date > v_start
  ) then
    raise exception 'Property is unavailable for these dates' using errcode = '23P01';
  end if;
  return new;
end;
$$;
drop trigger if exists crm_booking_overlap_guard on public.crm_records;
create trigger crm_booking_overlap_guard
before insert or update of data, entity, app_id, org_id on public.crm_records
for each row execute function public.crm_prevent_booking_overlap();

comment on function public.crm_prevent_booking_overlap() is
'Booking overlap guard; validates new stays, serializes same-property writes and leaves pre-existing conflicting rows for manual reconciliation.';
