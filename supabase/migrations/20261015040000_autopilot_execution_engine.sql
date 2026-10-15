-- Autopilot engine: idempotent, bounded, server-side execution of explicitly approved INTERNAL CRM notes.
-- No email, WhatsApp, lead outreach, or arbitrary external action is supported.
alter table public.crm_automation_approvals
 add column if not exists execute_after timestamptz,
 add column if not exists attempts integer not null default 0,
 add column if not exists last_error text,
 add column if not exists executed_at timestamptz;
create index if not exists crm_autopilot_ready_idx on public.crm_automation_approvals(execute_after,id)
 where status='approved';

-- Owner can schedule or reschedule an approved action for the future.
create or replace function public.crm_schedule_approved_automation(p_id uuid,p_when timestamptz)
returns public.crm_automation_approvals
language plpgsql security definer set search_path = ''
as $$
declare result public.crm_automation_approvals;
begin
 if p_when is null or p_when < now() or p_when > now()+interval '365 days' then
  raise exception 'Schedule must be within the next 365 days';
 end if;
 update public.crm_automation_approvals
 set execute_after=p_when, updated_at=now(),last_error=null
 where id=p_id and owner_id=auth.uid() and status='approved'
 and exists(select 1 from public.crm_apps a where a.id=app_id and a.owner_id=auth.uid())
 returning * into result;
 if result.id is null then raise exception 'Approved action not found'; end if;
 return result;
end $$;
revoke all on function public.crm_schedule_approved_automation(uuid,timestamptz) from public;
grant execute on function public.crm_schedule_approved_automation(uuid,timestamptz) to authenticated;

-- Owner can cancel a scheduled action, returning it to manual approved status.
create or replace function public.crm_unschedule_approved_automation(p_id uuid)
returns public.crm_automation_approvals
language plpgsql security definer set search_path = ''
as $$
declare result public.crm_automation_approvals;
begin
 update public.crm_automation_approvals
 set execute_after=null,updated_at=now(),last_error=null
 where id=p_id and owner_id=auth.uid() and status='approved'
 and exists(select 1 from public.crm_apps a where a.id=app_id and a.owner_id=auth.uid())
 returning * into result;
 if result.id is null then raise exception 'Approved action not found'; end if;
 return result;
end $$;
revoke all on function public.crm_unschedule_approved_automation(uuid) from public;
grant execute on function public.crm_unschedule_approved_automation(uuid) to authenticated;

-- Service-only worker. SKIP LOCKED prevents concurrent workers from processing the same row.
-- The record event ID is the approval ID, ensuring idempotency across retries and crashes.
create or replace function public.crm_run_approved_automations(p_limit integer default 25)
returns table(processed integer, failed integer)
language plpgsql security definer set search_path = ''
as $$
declare item public.crm_automation_approvals;
declare success_count integer:=0;
declare failure_count integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid batch limit'; end if;
 for item in
  select * from public.crm_automation_approvals
  where status='approved' and execute_after<=now() and attempts<5
  order by execute_after,id
  for update skip locked
  limit p_limit
 loop
  begin
   if not exists(select 1 from public.crm_apps a where a.id=item.app_id and a.owner_id=item.owner_id)
    or not exists(select 1 from public.crm_records r where r.id=item.source_record_id and r.app_id=item.app_id)
   then raise exception 'Workspace or source record unavailable'; end if;
   insert into public.crm_record_events(id,record_id,actor_id,kind,body,fields)
   values(item.id,item.source_record_id,item.owner_id,'note',
    'Autopilot approved action: '||item.title||'. '||item.reason,ARRAY[]::text[])
   on conflict (id) do nothing;
   update public.crm_automation_approvals
   set status='completed',decided_at=now(),updated_at=now(),executed_at=now(),
       attempts=attempts+1,last_error=null
   where id=item.id and status='approved';
   success_count:=success_count+1;
  exception when others then
   update public.crm_automation_approvals
   set attempts=attempts+1,last_error=left(SQLERRM,500),
       execute_after=now()+(interval '5 minutes'*power(2,least(attempts,4))),
       updated_at=now()
   where id=item.id and status='approved';
   failure_count:=failure_count+1;
  end;
 end loop;
 return query select success_count,failure_count;
end $$;
revoke all on function public.crm_run_approved_automations(integer) from public, anon, authenticated;
grant execute on function public.crm_run_approved_automations(integer) to service_role;
