begin;
insert into public.crm_records(id,app_id,entity,data) values
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','contacto_inmo','{"nombre":"Buyer"}'),
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','operacion','{"contacto":"55555555-5555-4555-8555-555555555555","inmueble":"33333333-3333-4333-8333-333333333333"}'),
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','operacion','{"contacto":"55555555-5555-4555-8555-555555555555","inmueble":"44444444-4444-4444-8444-444444444444"}');
insert into public.crm_org_members(org_id,user_id,role)
select org_id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer' from public.crm_apps where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ declare r public.crm_offer_revisions; d uuid:='66666666-6666-4666-8666-666666666666'; req uuid:='88888888-8888-4888-8888-888888888888'; begin
 r:=public.crm_append_offer(d,250000,'USD','submitted','Initial',0,req);
 if r.actor_id<>auth.uid() or r.revision<>1 then raise exception 'Wrong actor/revision'; end if;
 perform public.crm_append_offer(d,250000,'USD','submitted','Initial',0,req);
 if (select count(*) from public.crm_offer_revisions)<>1 then raise exception 'Duplicate retry'; end if;
 begin
  perform public.crm_append_offer(d,1,'USD','submitted','Initial',0,req);
  raise exception 'Changed retry accepted';
 exception when raise_exception then if sqlerrm='Changed retry accepted' then raise; end if; end;
 begin
  perform public.crm_append_offer(d,260000,'USD','countered','Stale',0,gen_random_uuid());
  raise exception 'Stale write accepted';
 exception when raise_exception then if sqlerrm='Stale write accepted' then raise; end if; end;
 begin
  perform public.crm_append_offer(d,260000,'USD','accepted','Changed terms',1,gen_random_uuid());
  raise exception 'Changed acceptance accepted';
 exception when raise_exception then if sqlerrm='Changed acceptance accepted' then raise; end if; end;
 begin
  perform public.crm_append_offer(d,260000,'ABC','countered','Currency',1,gen_random_uuid());
  raise exception 'Invalid currency accepted';
 exception when raise_exception then if sqlerrm='Invalid currency accepted' then raise; end if; end;
 begin
  perform public.crm_append_offer('77777777-7777-4777-8777-777777777777',1,'USD','submitted','Cross agency property',0,gen_random_uuid());
  raise exception 'Cross agency relation accepted';
 exception when raise_exception then if sqlerrm='Cross agency relation accepted' then raise; end if; end;
 perform public.crm_append_offer(d,260000,'USD','countered','Counter',1,gen_random_uuid());
 perform public.crm_append_offer(d,260000,'USD','accepted','Accepted terms',2,gen_random_uuid());
 begin
  perform public.crm_append_offer(d,270000,'USD','countered','Reopened',3,gen_random_uuid());
  raise exception 'Terminal offer reopened';
 exception when raise_exception then if sqlerrm='Terminal offer reopened' then raise; end if; end;
 if (select count(*) from public.crm_offer_revisions)<>3 then raise exception 'History lost'; end if;
 if (select count(*) from public.crm_record_events where record_id=d and body like 'Offer revision %')<>3 then raise exception 'Audit mismatch'; end if;
 begin
  update public.crm_offer_revisions set amount=1;
  raise exception 'Direct update allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.crm_offer_revisions;
  raise exception 'Direct delete allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if exists(select 1 from public.crm_offer_revisions) then raise exception 'Cross tenant read'; end if;
 begin
  perform public.crm_append_offer('66666666-6666-4666-8666-666666666666',1,'USD','submitted','Unauthorized',0,gen_random_uuid());
  raise exception 'Cross tenant write';
 exception when raise_exception then if sqlerrm='Cross tenant write' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$ begin
 if (select count(*) from public.crm_offer_revisions)<>3 then raise exception 'Viewer cannot read'; end if;
 begin
  perform public.crm_append_offer('66666666-6666-4666-8666-666666666666',1,'USD','submitted','Viewer',0,gen_random_uuid());
  raise exception 'Viewer wrote offer';
 exception when raise_exception then if sqlerrm='Viewer wrote offer' then raise; end if; end;
end $$;
rollback;
