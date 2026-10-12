-- Private property assets. Apply this migration in the target Supabase project
-- before enabling uploads. RLS ties every object to the existing crm_apps owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-property-media', 'crm-property-media', false, 12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crm_property_media_select" on storage.objects;
create policy "crm_property_media_select" on storage.objects for select to authenticated
using (bucket_id = 'crm-property-media'
  and public.crm_owns_app((split_part(name, '/', 1))::uuid)
  and exists (
    select 1 from public.crm_records r
    where r.id::text = split_part(name, '/', 2)
      and r.app_id::text = split_part(name, '/', 1)
      and r.entity in ('inmueble', 'alojamiento')
  ));

drop policy if exists "crm_property_media_insert" on storage.objects;
create policy "crm_property_media_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'crm-property-media'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  and public.crm_owns_app((split_part(name, '/', 1))::uuid)
  and exists (
    select 1 from public.crm_records r
    where r.id::text = split_part(name, '/', 2)
      and r.app_id::text = split_part(name, '/', 1)
      and r.entity in ('inmueble', 'alojamiento')
  ));

drop policy if exists "crm_property_media_delete" on storage.objects;
create policy "crm_property_media_delete" on storage.objects for delete to authenticated
using (bucket_id = 'crm-property-media'
  and public.crm_owns_app((split_part(name, '/', 1))::uuid)
  and exists (
    select 1 from public.crm_records r
    where r.id::text = split_part(name, '/', 2)
      and r.app_id::text = split_part(name, '/', 1)
      and r.entity in ('inmueble', 'alojamiento')
  ));
-- No update policy: object keys are immutable; replacement uses a new UUID.
