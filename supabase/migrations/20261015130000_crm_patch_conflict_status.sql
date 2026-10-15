-- Optimistic concurrency conflicts are client HTTP 409 responses, not retryable
-- database serialization failures/HTTP 500s. Preserve invoker RLS and atomic patches.
create or replace function public.crm_patch_record(p_id uuid,p_patch jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.crm_records;
begin
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid record patch'; end if;
 select * into r from public.crm_records where id=p_id for update;
 if not found or not public.crm_can_access_app(r.app_id,true) then raise exception 'Record unavailable or read only'; end if;
 if p_expected_updated_at is not null and r.updated_at is distinct from p_expected_updated_at
 then raise exception 'Record changed; reload before saving' using errcode='PT409'; end if;
 update public.crm_records set data=data||p_patch,updated_at=clock_timestamp() where id=p_id returning * into r;
 if not found then raise exception 'Record unavailable or read only'; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.crm_patch_record(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.crm_patch_record(uuid,jsonb,timestamptz) to authenticated;
