begin;
insert into public.crm_org_members(org_id,user_id,role)
select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ declare e public.crm_record_events; n integer; begin
 e:=public.crm_add_record_activity('33333333-3333-4333-8333-333333333333','call','Spoke to owner','99999999-9999-4999-8999-999999999999');
 perform public.crm_add_record_activity(e.record_id,'call','Spoke to owner',e.id);
 if (select count(*) from public.crm_record_events where id=e.id)<>1 or e.actor_id<>auth.uid() then raise exception 'Dedup or actor failed'; end if;
 begin
  perform public.crm_add_record_activity(e.record_id,'note','different',e.id);
  raise exception 'Request reused with different payload';
 exception when raise_exception then if sqlerrm='Request reused with different payload' then raise; end if; end;
 begin
  perform public.crm_add_record_activity('44444444-4444-4444-8444-444444444444','note','Other agency',gen_random_uuid());
  raise exception 'Cross tenant activity';
 exception when raise_exception then if sqlerrm='Cross tenant activity' then raise; end if; end;
 begin
  perform public.crm_add_record_activity(e.record_id,'note','  ',gen_random_uuid());
  raise exception 'Blank activity allowed';
 exception when raise_exception then if sqlerrm='Blank activity allowed' then raise; end if; end;
 perform public.crm_patch_record(e.record_id,'{"crm_lifecycle":"client","notas":"private value"}');
 if not exists(select 1 from public.crm_record_events where record_id=e.record_id and kind='changed' and fields @> array['crm_lifecycle','notas'] and actor_id=auth.uid() and body is null) then raise exception 'Trigger missing'; end if;
 select count(*) into n from public.crm_record_events where record_id=e.record_id;
 perform public.crm_patch_record(e.record_id,'{"crm_lifecycle":"client"}');
 if (select count(*) from public.crm_record_events where record_id=e.record_id)<>n then raise exception 'No-op created event'; end if;
 begin
  delete from public.crm_record_events where id=e.id;
  raise exception 'History deleted';
 exception when insufficient_privilege then null; end;
 begin
  update public.crm_record_events set body='tamper' where id=e.id;
  raise exception 'History rewritten';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.crm_record_events(app_id,record_id,kind) values('11111111-1111-4111-8111-111111111111',e.record_id,'created');
  raise exception 'Forged history';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if exists(select 1 from public.crm_record_events where record_id='33333333-3333-4333-8333-333333333333') then raise exception 'History leaks across tenants'; end if;
end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 if not exists(select 1 from public.crm_record_events where record_id='33333333-3333-4333-8333-333333333333') then raise exception 'Viewer cannot read history'; end if;
 begin
  perform public.crm_add_record_activity('33333333-3333-4333-8333-333333333333','note','Viewer write',gen_random_uuid());
  raise exception 'Viewer wrote activity';
 exception when raise_exception then if sqlerrm='Viewer wrote activity' then raise; end if; end;
end $$;
rollback;
