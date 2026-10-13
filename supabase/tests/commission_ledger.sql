begin;
insert into public.crm_records(id,app_id,entity,data) values('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','operacion','{}');
insert into public.crm_org_members(org_id,user_id,role) select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ declare d uuid:='66666666-6666-4666-8666-666666666666'; req uuid:='88888888-8888-4888-8888-888888888888'; shares jsonb:='[{"recipient":"Agency","units":60000},{"recipient":"Partner","units":40000}]'; l public.crm_commission_ledgers; r public.crm_commission_receipts; begin
 begin
  perform public.crm_create_commission(d,'EUR',99999,shares,req);raise exception 'Unequal allocation accepted';
 exception when raise_exception then if sqlerrm='Unequal allocation accepted' then raise; end if; end;
 begin
  perform public.crm_create_commission(d,'ABC',100000,shares,req);raise exception 'Invalid currency accepted';
 exception when raise_exception then if sqlerrm='Invalid currency accepted' then raise; end if; end;
 l:=public.crm_create_commission(d,'EUR',100000,shares,req);
 if l.actor_id<>auth.uid() then raise exception 'Wrong actor'; end if;
 perform public.crm_create_commission(d,'EUR',100000,shares,req);
 if (select count(*) from public.crm_commission_ledgers)<>1 then raise exception 'Duplicate plan'; end if;
 begin
  perform public.crm_create_commission(d,'USD',100000,shares,req);raise exception 'Changed plan accepted';
 exception when raise_exception then if sqlerrm='Changed plan accepted' then raise; end if; end;
 r:=public.crm_record_commission_receipt(d,0,20000,'Receipt 1',req);
 perform public.crm_record_commission_receipt(d,0,20000,'Receipt 1',req);
 if (select count(*) from public.crm_commission_receipts)<>1 then raise exception 'Duplicate receipt'; end if;
 begin
  perform public.crm_record_commission_receipt(d,0,1,'Changed retry',req);raise exception 'Changed retry accepted';
 exception when raise_exception then if sqlerrm='Changed retry accepted' then raise; end if; end;
 begin
  perform public.crm_record_commission_receipt(d,0,40001,'Overcollection',gen_random_uuid());raise exception 'Overcollection accepted';
 exception when raise_exception then if sqlerrm='Overcollection accepted' then raise; end if; end;
 begin
  perform public.crm_record_commission_receipt(d,2,1,'Invalid share',gen_random_uuid());raise exception 'Invalid share accepted';
 exception when raise_exception then if sqlerrm='Invalid share accepted' then raise; end if; end;
 perform public.crm_record_commission_receipt(d,0,40000,'Receipt 2',gen_random_uuid());
 perform public.crm_record_commission_receipt(d,1,40000,'Receipt 3',gen_random_uuid());
 if (select sum(units) from public.crm_commission_receipts)<>100000 then raise exception 'Wrong receipt total'; end if;
 if (select count(*) from public.crm_record_events where record_id=d and body like 'Commission %')<>4 then raise exception 'Audit mismatch'; end if;
 begin update public.crm_commission_ledgers set total_units=1;raise exception 'Direct plan update';exception when insufficient_privilege then null;end;
 begin delete from public.crm_commission_receipts;raise exception 'Direct receipt delete';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if exists(select 1 from public.crm_commission_ledgers) or exists(select 1 from public.crm_commission_receipts) then raise exception 'Cross tenant read'; end if;
 begin perform public.crm_record_commission_receipt('66666666-6666-4666-8666-666666666666',0,1,'Unauthorized',gen_random_uuid());raise exception 'Cross tenant write';exception when raise_exception then if sqlerrm='Cross tenant write' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 if (select count(*) from public.crm_commission_receipts)<>3 then raise exception 'Viewer cannot read'; end if;
 begin perform public.crm_record_commission_receipt('66666666-6666-4666-8666-666666666666',0,1,'Viewer',gen_random_uuid());raise exception 'Viewer write';exception when raise_exception then if sqlerrm='Viewer write' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
 begin perform public.crm_record_commission_receipt('66666666-6666-4666-8666-666666666666',0,1,'Anonymous',gen_random_uuid());raise exception 'Anonymous execution';exception when insufficient_privilege then null;end;
end $$;
rollback;
