-- Append-only activity for existing records. Existing data is not backfilled.
create table public.crm_record_events (
 id uuid primary key default gen_random_uuid(),
 app_id uuid not null references public.crm_apps(id) on delete cascade,
 record_id uuid not null references public.crm_records(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null check (kind in ('created','changed','note','call','meeting')),
 body text check (body is null or char_length(body) between 1 and 4000),
 fields text[] not null default '{}',
 created_at timestamptz not null default clock_timestamp()
);
create index crm_record_events_timeline on public.crm_record_events(record_id,created_at desc,id desc);
alter table public.crm_record_events enable row level security;
revoke all on public.crm_record_events from public,anon,authenticated;
grant select on public.crm_record_events to authenticated;
create policy crm_record_events_read on public.crm_record_events for select to authenticated
 using (public.crm_can_access_app(app_id,false));

create function public.crm_record_event_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed text[];
begin
 if TG_OP='UPDATE' then
  select array_agg(k order by k) into changed from
   (select jsonb_object_keys(old.data) k union select jsonb_object_keys(new.data) k) keys
   where old.data->k is distinct from new.data->k;
  if changed is null then return new; end if;
 end if;
 insert into public.crm_record_events(app_id,record_id,actor_id,kind,fields)
 values(new.app_id,new.id,auth.uid(),case when TG_OP='INSERT' then 'created' else 'changed' end,coalesce(changed,'{}'));
 return new;
end $$;
revoke all on function public.crm_record_event_trigger() from public,anon,authenticated;
create trigger crm_record_event after insert or update of data on public.crm_records
 for each row execute function public.crm_record_event_trigger();

create function public.crm_add_record_activity(p_record uuid,p_kind text,p_body text,p_request uuid)
returns public.crm_record_events language plpgsql security definer set search_path = '' as $$
declare r public.crm_records; e public.crm_record_events;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_kind is null or p_kind not in ('note','call','meeting')
  or p_body is null or char_length(btrim(p_body)) not between 1 and 4000
 then raise exception 'Invalid activity'; end if;
 select * into r from public.crm_records where id=p_record for key share;
 if not found or not public.crm_can_access_app(r.app_id,true) then raise exception 'Forbidden'; end if;
 insert into public.crm_record_events(id,app_id,record_id,actor_id,kind,body)
 values(p_request,r.app_id,r.id,auth.uid(),p_kind,btrim(p_body)) on conflict(id) do nothing;
 select * into e from public.crm_record_events where id=p_request;
 if e.record_id<>p_record or e.actor_id is distinct from auth.uid() or e.kind<>p_kind or e.body<>btrim(p_body)
 then raise exception 'Activity request already used'; end if;
 return e;
end $$;
revoke all on function public.crm_add_record_activity(uuid,text,text,uuid) from public,anon;
grant execute on function public.crm_add_record_activity(uuid,text,text,uuid) to authenticated;
