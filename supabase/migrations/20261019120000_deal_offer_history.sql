-- One immutable negotiation stream per deal. Closing and payments are separate workflows.
create table public.crm_offer_revisions (
 id uuid primary key,
 app_id uuid not null references public.crm_apps(id) on delete cascade,
 deal_id uuid not null references public.crm_records(id) on delete cascade,
 contact_id uuid not null,
 property_id uuid not null,
 revision integer not null check(revision>0),
 amount numeric not null check(amount>0 and amount<=999999999999),
 currency text not null,
 status text not null check(status in ('submitted','countered','accepted','rejected','withdrawn')),
 note text not null check(length(note)<=4000),
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 unique(deal_id,revision)
);
alter table public.crm_offer_revisions enable row level security;
revoke all on public.crm_offer_revisions from public,anon,authenticated;
grant select on public.crm_offer_revisions to authenticated;
create policy crm_offer_read on public.crm_offer_revisions for select to authenticated
 using(public.crm_can_access_app(app_id,false));
create function public.crm_append_offer(p_deal uuid,p_amount numeric,p_currency text,p_status text,p_note text,p_expected integer,p_request uuid)
returns public.crm_offer_revisions language plpgsql security definer set search_path='' as $$
declare d public.crm_records; c public.crm_records; p public.crm_records; previous public.crm_offer_revisions; result public.crm_offer_revisions;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into d from public.crm_records where id=p_deal for update;
 if d.id is null or d.entity<>'operacion' or not public.crm_can_access_app(d.app_id,true) then raise exception 'Deal unavailable'; end if;
 if p_request is null or p_expected is null or p_amount is null or p_amount<=0 or p_amount>999999999999 or p_amount::text in ('NaN','Infinity','-Infinity')
  or p_currency is null or p_status is null or p_note is null or length(p_note)>4000 then raise exception 'Invalid offer terms'; end if;
 -- ISO list shared with the client; no inferred currency or FX conversion.
 if not (p_currency = any(ARRAY['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL'])) then raise exception 'Invalid currency'; end if;
 select * into result from public.crm_offer_revisions where id=p_request;
 if result.id is not null then
  if result.deal_id<>p_deal or result.actor_id is distinct from auth.uid() or result.amount<>p_amount or result.currency<>p_currency or result.status<>p_status or result.note<>p_note or result.revision<>p_expected+1 then raise exception 'Request already used'; end if;
  return result;
 end if;
 select * into previous from public.crm_offer_revisions where deal_id=p_deal order by revision desc limit 1;
 if coalesce(previous.revision,0)<>p_expected then raise exception 'Offer changed. Reload before saving'; end if;
 if previous.id is null then
  if p_status<>'submitted' then raise exception 'The first revision must be submitted'; end if;
 else
  if previous.status not in ('submitted','countered') or p_status not in ('countered','accepted','rejected','withdrawn') then raise exception 'Invalid offer transition'; end if;
  if p_status<>'countered' and (p_amount<>previous.amount or p_currency<>previous.currency) then raise exception 'Counter the offer before changing its terms'; end if;
 end if;
 -- String comparison tolerates legacy malformed relation values without unsafe casts.
 select * into c from public.crm_records where id::text=d.data->>'contacto' and app_id=d.app_id and entity in ('contacto_inmo','lead','cliente');
 select * into p from public.crm_records where id::text=d.data->>'inmueble' and app_id=d.app_id and entity='inmueble';
 if c.id is null or p.id is null or c.is_sample is distinct from d.is_sample or p.is_sample is distinct from d.is_sample then raise exception 'Link a contact and property from this workspace'; end if;
 if previous.id is not null and (previous.contact_id<>c.id or previous.property_id<>p.id) then raise exception 'Deal relationships changed. Use a separate deal for this negotiation'; end if;
 insert into public.crm_offer_revisions(id,app_id,deal_id,contact_id,property_id,revision,amount,currency,status,note,actor_id)
 values(p_request,d.app_id,d.id,c.id,p.id,p_expected+1,p_amount,p_currency,p_status,p_note,auth.uid()) returning * into result;
 insert into public.crm_record_events(app_id,record_id,actor_id,kind,body)
 values(d.app_id,d.id,auth.uid(),'note','Offer revision '||result.revision||': '||p_status||' · '||p_amount||' '||p_currency);
 return result;
end $$;
revoke all on function public.crm_append_offer(uuid,numeric,text,text,text,integer,uuid) from public,anon;
grant execute on function public.crm_append_offer(uuid,numeric,text,text,text,integer,uuid) to authenticated;
