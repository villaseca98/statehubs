begin;
insert into public.crm_records(id,app_id,entity,data) values('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','operacion','{}');
insert into public.crm_org_members(org_id,user_id,role) select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.crm_create_commission('66666666-6666-4666-8666-666666666666','EUR',1000,'[{"recipient":"Agency","units":1000}]',gen_random_uuid());
select public.crm_record_commission_receipt('66666666-6666-4666-8666-666666666666',0,1000,'Original','88888888-8888-4888-8888-888888888888');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 begin perform public.crm_reverse_commission_receipt('88888888-8888-4888-8888-888888888888','Other agency',gen_random_uuid());raise exception 'Cross tenant reversal';exception when raise_exception then if sqlerrm='Cross tenant reversal' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 begin perform public.crm_reverse_commission_receipt('88888888-8888-4888-8888-888888888888','Viewer',gen_random_uuid());raise exception 'Viewer reversal';exception when raise_exception then if sqlerrm='Viewer reversal' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ declare r public.crm_commission_receipts; req uuid:=gen_random_uuid(); original uuid:='88888888-8888-4888-8888-888888888888'; begin
 begin perform public.crm_reverse_commission_receipt(original,' ',req);raise exception 'Blank reason';exception when raise_exception then if sqlerrm='Blank reason' then raise;end if;end;
 r:=public.crm_reverse_commission_receipt(original,'Incorrect receipt',req);
 if r.units<>-1000 or r.reverses<>original or r.actor_id<>auth.uid() then raise exception 'Invalid reversal metadata';end if;
 perform public.crm_reverse_commission_receipt(original,'Incorrect receipt',req);
 if (select count(*) from public.crm_commission_receipts)<>2 or (select sum(units) from public.crm_commission_receipts)<>0 then raise exception 'Duplicate reversal or wrong balance';end if;
 if (select reference from public.crm_commission_receipts where id=original)<>'Original' then raise exception 'Original changed';end if;
 begin perform public.crm_reverse_commission_receipt(original,'Changed reason',req);raise exception 'Altered retry';exception when raise_exception then if sqlerrm='Altered retry' then raise;end if;end;
 begin perform public.crm_reverse_commission_receipt(original,'Second reversal',gen_random_uuid());raise exception 'Reversed twice';exception when raise_exception then if sqlerrm='Reversed twice' then raise;end if;end;
 begin perform public.crm_reverse_commission_receipt(r.id,'Reverse reversal',gen_random_uuid());raise exception 'Negative reversal';exception when raise_exception then if sqlerrm='Negative reversal' then raise;end if;end;
 perform public.crm_record_commission_receipt(r.deal_id,0,1000,'Corrected receipt',gen_random_uuid());
 if (select sum(units) from public.crm_commission_receipts)<>1000 then raise exception 'Corrected collection failed';end if;
 if (select count(*) from public.crm_record_events where body like 'Commission receipt reversed%')<>1 then raise exception 'Duplicate reversal audit';end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.crm_reverse_commission_receipt('88888888-8888-4888-8888-888888888888','Anonymous',gen_random_uuid());raise exception 'Anonymous reversal';exception when insufficient_privilege then null;end;
end $$;
rollback;
