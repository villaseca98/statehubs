create table public.crm_commission_ledgers (
 deal_id uuid primary key references public.crm_records(id) on delete cascade,
 app_id uuid not null references public.crm_apps(id) on delete cascade,
 request_id uuid not null unique,
 currency text not null,
 total_units bigint not null check(total_units>0 and total_units<=9000000000000),
 shares jsonb not null,
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.crm_commission_receipts (
 id uuid primary key,
 deal_id uuid not null references public.crm_commission_ledgers(deal_id) on delete cascade,
 share_index integer not null check(share_index>=0),
 units bigint not null check(units>0 and units<=9000000000000),
 reference text not null check(length(reference) between 1 and 500),
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
create index crm_commission_receipts_deal on public.crm_commission_receipts(deal_id);
alter table public.crm_commission_ledgers enable row level security;
alter table public.crm_commission_receipts enable row level security;
revoke all on public.crm_commission_ledgers,public.crm_commission_receipts from public,anon,authenticated;
grant select on public.crm_commission_ledgers,public.crm_commission_receipts to authenticated;
create policy commission_read on public.crm_commission_ledgers for select to authenticated using(public.crm_can_access_app(app_id,false));
create policy commission_receipt_read on public.crm_commission_receipts for select to authenticated using(exists(select 1 from public.crm_commission_ledgers l where l.deal_id=crm_commission_receipts.deal_id));
create function public.crm_create_commission(p_deal uuid,p_currency text,p_total bigint,p_shares jsonb,p_request uuid)
returns public.crm_commission_ledgers language plpgsql security definer set search_path='' as $$
declare d public.crm_records; l public.crm_commission_ledgers; s jsonb; total numeric:=0; names text[]:='{}'; recipient text; units numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into d from public.crm_records where id=p_deal for update;
 if d.id is null or d.entity<>'operacion' or not public.crm_can_access_app(d.app_id,true) then raise exception 'Deal unavailable'; end if;
 if p_request is null or p_currency is null or not(p_currency=any(ARRAY['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL'])) or p_total is null or p_total<=0 or p_total>9000000000000 or p_shares is null or jsonb_typeof(p_shares)<>'array' then raise exception 'Invalid commission plan'; end if;
 if jsonb_array_length(p_shares) not between 1 and 50 then raise exception 'Invalid allocations'; end if;
 for s in select value from jsonb_array_elements(p_shares) loop
  recipient:=lower(btrim(s->>'recipient'));
  if jsonb_typeof(s->'recipient') is distinct from 'string' or recipient is null or recipient='' or length(s->>'recipient')>200 or recipient=any(names) or jsonb_typeof(s->'units') is distinct from 'number' then raise exception 'Invalid recipient or amount'; end if;
  units:=(s->>'units')::numeric;
  if units<=0 or units>p_total or trunc(units)<>units then raise exception 'Invalid allocation amount'; end if;
  names:=array_append(names,recipient);total:=total+units;
 end loop;
 if total<>p_total then raise exception 'Allocations must equal the total commission exactly'; end if;
 select * into l from public.crm_commission_ledgers where deal_id=p_deal;
 if l.deal_id is not null then
  if l.request_id=p_request and l.actor_id=auth.uid() and l.currency=p_currency and l.total_units=p_total and l.shares=p_shares then return l; end if;
  raise exception 'Commission plan already exists. Reload the ledger';
 end if;
 insert into public.crm_commission_ledgers(deal_id,app_id,request_id,currency,total_units,shares,actor_id)
 values(d.id,d.app_id,p_request,p_currency,p_total,p_shares,auth.uid()) returning * into l;
 insert into public.crm_record_events(app_id,record_id,actor_id,kind,body) values(d.app_id,d.id,auth.uid(),'note','Commission allocation plan recorded · '||p_currency);
 return l;
end $$;
create function public.crm_record_commission_receipt(p_deal uuid,p_share integer,p_units bigint,p_reference text,p_request uuid)
returns public.crm_commission_receipts language plpgsql security definer set search_path='' as $$
declare l public.crm_commission_ledgers; r public.crm_commission_receipts; received numeric; allocated bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.crm_commission_ledgers where deal_id=p_deal for update;
 if l.deal_id is null or not public.crm_can_access_app(l.app_id,true) then raise exception 'Commission unavailable'; end if;
 if p_request is null or p_share is null or p_share<0 or p_share>=jsonb_array_length(l.shares) or p_units is null or p_units<=0 or p_units>9000000000000 or p_reference is null or btrim(p_reference)='' or length(p_reference)>500 then raise exception 'Invalid receipt'; end if;
 select * into r from public.crm_commission_receipts where id=p_request;
 if r.id is not null then
  if r.deal_id=p_deal and r.share_index=p_share and r.units=p_units and r.reference=p_reference and r.actor_id=auth.uid() then return r; end if;
  raise exception 'Receipt request already used';
 end if;
 allocated:=(l.shares->p_share->>'units')::numeric::bigint;
 select coalesce(sum(units),0) into received from public.crm_commission_receipts where deal_id=p_deal and share_index=p_share;
 if p_units>allocated-received then raise exception 'Receipt exceeds the outstanding allocation'; end if;
 insert into public.crm_commission_receipts(id,deal_id,share_index,units,reference,actor_id) values(p_request,p_deal,p_share,p_units,p_reference,auth.uid()) returning * into r;
 insert into public.crm_record_events(app_id,record_id,actor_id,kind,body) values(l.app_id,p_deal,auth.uid(),'note','Commission receipt recorded · '||p_reference);
 return r;
end $$;
revoke all on function public.crm_create_commission(uuid,text,bigint,jsonb,uuid),public.crm_record_commission_receipt(uuid,integer,bigint,text,uuid) from public,anon;
grant execute on function public.crm_create_commission(uuid,text,bigint,jsonb,uuid),public.crm_record_commission_receipt(uuid,integer,bigint,text,uuid) to authenticated;
