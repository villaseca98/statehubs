-- Autopilot v1: durable, owner-scoped approval queue. No background execution or outbound messaging.
create table if not exists public.crm_automation_approvals (
 id uuid primary key default gen_random_uuid(),
 app_id uuid not null references public.crm_apps(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 source_record_id uuid not null references public.crm_records(id) on delete cascade,
 action_type text not null check (action_type in ('follow_up','confirm_appointment','review_deadline')),
 title text not null check (length(trim(title)) between 1 and 300),
 reason text not null default '',
 status text not null default 'pending' check (status in ('pending','approved','dismissed','completed')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint approval_decision_timestamp check ((status = 'pending' and decided_at is null) or (status <> 'pending' and decided_at is not null))
);
create unique index if not exists crm_automation_approvals_one_pending on public.crm_automation_approvals(app_id,source_record_id,action_type) where status='pending';
create index if not exists crm_automation_approvals_owner_queue on public.crm_automation_approvals(owner_id,app_id,status,created_at desc);
alter table public.crm_automation_approvals enable row level security;
revoke all on public.crm_automation_approvals from anon;
grant select, insert, update on public.crm_automation_approvals to authenticated;
create policy "Autopilot owner read" on public.crm_automation_approvals for select to authenticated using (
 owner_id = (select auth.uid()) and exists (select 1 from public.crm_apps a where a.id=app_id and a.owner_id=(select auth.uid()))
);
create policy "Autopilot owner create" on public.crm_automation_approvals for insert to authenticated with check (
 owner_id=(select auth.uid()) and status='pending' and decided_at is null
 and exists(select 1 from public.crm_apps a where a.id=app_id and a.owner_id=(select auth.uid()))
 and exists(select 1 from public.crm_records r where r.id=source_record_id and r.app_id=app_id)
);
-- Updates are performed through the narrow RPC below, never by arbitrary client UPDATE.
revoke update on public.crm_automation_approvals from authenticated;
create or replace function public.crm_decide_automation_approval(p_id uuid,p_status text)
returns public.crm_automation_approvals
language plpgsql security definer set search_path = public
as $$
declare result public.crm_automation_approvals;
begin
 if p_status not in ('approved','dismissed','completed') then raise exception 'Invalid approval transition'; end if;
 update public.crm_automation_approvals
 set status=p_status,decided_at=now(),updated_at=now()
 where id=p_id and owner_id=auth.uid() and exists (select 1 from public.crm_apps a where a.id=app_id and a.owner_id=auth.uid())
 and ((status='pending' and p_status in ('approved','dismissed')) or (status='approved' and p_status='completed'))
 returning * into result;
 if result.id is null then raise exception 'Approval not found or transition not permitted'; end if;
 return result;
end $$;
revoke all on function public.crm_decide_automation_approval(uuid,text) from public;
grant execute on function public.crm_decide_automation_approval(uuid,text) to authenticated;
comment on table public.crm_automation_approvals is 'Human approval ledger; approved means authorized for review, not executed or sent.';
