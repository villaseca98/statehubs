begin;
insert into public.crm_records(id,app_id,entity,data) values
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','contacto_inmo','{"nombre":"Buyer"}');
insert into public.crm_org_members(org_id,user_id,role)
select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ declare d public.crm_match_decisions; n integer; begin
 d:=public.crm_set_match_decision('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','saved');
 if d.actor_id<>auth.uid() then raise exception 'Actor mismatch'; end if;
 perform public.crm_set_match_decision(d.contact_id,d.property_id,'saved');
 if (select count(*) from public.crm_match_decisions)<>1 then raise exception 'Duplicate match'; end if;
 select count(*) into n from public.crm_record_events where record_id=d.contact_id and body like 'Match saved:%';
 if n<>1 then raise exception 'Duplicate audit event'; end if;
 perform public.crm_set_match_decision(d.contact_id,d.property_id,'dismissed');
 if (select status from public.crm_match_decisions where contact_id=d.contact_id)<>'dismissed' then raise exception 'Dismiss not persisted'; end if;
 begin
  perform public.crm_set_match_decision(d.contact_id,'44444444-4444-4444-8444-444444444444','saved');
  raise exception 'Cross-tenant match saved';
 exception when raise_exception then if sqlerrm='Cross-tenant match saved' then raise; end if; end;
 begin
  perform public.crm_set_match_decision(d.property_id,d.contact_id,'saved');
  raise exception 'Invalid entities saved';
 exception when raise_exception then if sqlerrm='Invalid entities saved' then raise; end if; end;
 begin
  update public.crm_match_decisions set actor_id=null;
  raise exception 'Direct match write';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin if exists(select 1 from public.crm_match_decisions) then raise exception 'Cross-tenant match read'; end if; end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 if (select count(*) from public.crm_match_decisions)<>1 then raise exception 'Viewer cannot read'; end if;
 begin
  perform public.crm_set_match_decision('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','saved');
  raise exception 'Viewer wrote match';
 exception when raise_exception then if sqlerrm='Viewer wrote match' then raise; end if; end;
end $$;
rollback;
