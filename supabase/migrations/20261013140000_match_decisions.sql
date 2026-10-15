-- Match decisions are shared within the workspace, never across tenants.
create table public.crm_match_decisions (
 app_id uuid not null references public.crm_apps(id) on delete cascade,
 contact_id uuid not null references public.crm_records(id) on delete cascade,
 property_id uuid not null references public.crm_records(id) on delete cascade,
 status text not null check(status in ('saved','dismissed','suggested')),
 actor_id uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(contact_id,property_id)
);
create index crm_match_decisions_app on public.crm_match_decisions(app_id);
alter table public.crm_match_decisions enable row level security;
revoke all on public.crm_match_decisions from public,anon,authenticated;
grant select on public.crm_match_decisions to authenticated;
create policy crm_match_decisions_read on public.crm_match_decisions for select to authenticated
 using(public.crm_can_access_app(app_id,false));
create function public.crm_set_match_decision(p_contact uuid,p_property uuid,p_status text)
returns public.crm_match_decisions language plpgsql security definer set search_path='' as $$
declare c public.crm_records; p public.crm_records; d public.crm_match_decisions; previous text;
begin
 if auth.uid() is null or p_status is null or p_status not in ('saved','dismissed','suggested') then raise exception 'Invalid match decision'; end if;
 -- Lock endpoints in a stable order to serialize decisions and record deletion.
 perform 1 from public.crm_records where id in (p_contact,p_property) order by id for update;
 select * into c from public.crm_records where id=p_contact;
 select * into p from public.crm_records where id=p_property;
 if c.id is null or p.id is null or c.app_id<>p.app_id or c.entity not in ('contacto_inmo','lead','cliente') or p.entity<>'inmueble'
  or c.is_sample is distinct from p.is_sample or not public.crm_can_access_app(c.app_id,true)
 then raise exception 'Match unavailable'; end if;
 select status into previous from public.crm_match_decisions where contact_id=p_contact and property_id=p_property;
 insert into public.crm_match_decisions(app_id,contact_id,property_id,status,actor_id)
 values(c.app_id,c.id,p.id,p_status,auth.uid()) on conflict(contact_id,property_id) do update
 set status=excluded.status,actor_id=excluded.actor_id,updated_at=clock_timestamp()
 returning * into d;
 if previous is distinct from p_status then
  insert into public.crm_record_events(app_id,record_id,actor_id,kind,body)
  values(c.app_id,c.id,auth.uid(),'note','Match '||p_status||': property '||p.id::text);
 end if;
 return d;
end $$;
revoke all on function public.crm_set_match_decision(uuid,uuid,text) from public,anon;
grant execute on function public.crm_set_match_decision(uuid,uuid,text) to authenticated;
