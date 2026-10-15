-- Corrections append an equal opposite entry; original receipts remain untouched.
alter table public.crm_commission_receipts
 add column reverses uuid unique references public.crm_commission_receipts(id) on delete cascade;
alter table public.crm_commission_receipts drop constraint crm_commission_receipts_units_check;
alter table public.crm_commission_receipts add constraint crm_commission_receipts_units_check
 check(abs(units)<=9000000000000 and ((units>0 and reverses is null) or (units<0 and reverses is not null)));
create function public.crm_reverse_commission_receipt(p_receipt uuid,p_reason text,p_request uuid)
returns public.crm_commission_receipts language plpgsql security definer set search_path='' as $$
declare original public.crm_commission_receipts; ledger public.crm_commission_ledgers; result public.crm_commission_receipts;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into original from public.crm_commission_receipts where id=p_receipt;
 select * into ledger from public.crm_commission_ledgers where deal_id=original.deal_id for update;
 if ledger.deal_id is null or not public.crm_can_access_app(ledger.app_id,true) then raise exception 'Receipt unavailable'; end if;
 if p_request is null or p_reason is null or btrim(p_reason)='' or length(p_reason)>500 or original.units<=0 or original.reverses is not null then raise exception 'Invalid receipt reversal'; end if;
 select * into result from public.crm_commission_receipts where id=p_request;
 if result.id is not null then
  if result.reverses=p_receipt and result.reference=p_reason and result.actor_id=auth.uid() then return result; end if;
  raise exception 'Reversal request already used';
 end if;
 if exists(select 1 from public.crm_commission_receipts where reverses=p_receipt) then raise exception 'Receipt already reversed. Reload the ledger'; end if;
 insert into public.crm_commission_receipts(id,deal_id,share_index,units,reference,actor_id,reverses)
 values(p_request,original.deal_id,original.share_index,-original.units,p_reason,auth.uid(),original.id) returning * into result;
 insert into public.crm_record_events(app_id,record_id,actor_id,kind,body)
 values(ledger.app_id,ledger.deal_id,auth.uid(),'note','Commission receipt reversed · '||original.id::text||' · '||p_reason);
 return result;
end $$;
revoke all on function public.crm_reverse_commission_receipt(uuid,text,uuid) from public,anon;
grant execute on function public.crm_reverse_commission_receipt(uuid,text,uuid) to authenticated;
