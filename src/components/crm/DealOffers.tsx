import { useEffect, useRef, useState } from 'react';
import type { AppRecord } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import { localCrmApi, isLocalApp } from '@/lib/crm/localApi';
import { CURRENCY_CODES } from '@/lib/crm/currencies';
import { isOfferOpen, validateOffer, type OfferStatus, type OfferRevision } from '@/lib/crm/offers';
import { offerText as t, offerStatusText } from '@/i18n/offers';
const control='mt-1 block min-h-11 w-full rounded-lg border p-2';
const style={background:'var(--crm-surface)',borderColor:'var(--crm-border)'};
export function DealOffers({appId,record,readOnly}:{appId?:string;record:AppRecord;readOnly:boolean}) {
 const api=appId&&isLocalApp(appId)?localCrmApi:crmApi;
 const [rows,setRows]=useState<OfferRevision[]>([]);const [loaded,setLoaded]=useState(false);const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
 const [amount,setAmount]=useState('');const [currency,setCurrency]=useState('');const [status,setStatus]=useState<OfferStatus>('submitted');const [note,setNote]=useState('');
 const request=useRef<string|null>(null);const latest=rows[0];
 useEffect(()=>{
  if(!appId)return;let active=true;setLoading(true);setLoaded(false);setError('');
  api.offerRevisions(record.id).then(data=>{if(active){setRows(data);setLoaded(true);const last=data[0];setStatus(last?'countered':'submitted');if(last){setAmount(String(last.amount));setCurrency(last.currency);}request.current=null;}},e=>{if(active)setError(e instanceof Error?e.message:t.failure);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[api,appId,record.id,refresh]);
 const edit=()=>{request.current=null;setNotice('');};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(readOnly||busy||!loaded||!appId)return;
  const input={amount:Number(amount),currency,status,note};setError('');setNotice('');
  try{validateOffer(input,latest);setBusy(true);request.current??=crypto.randomUUID();const row=await api.appendOffer(record.id,input,latest?.revision??0,request.current);setRows(previous=>[row,...previous.filter(r=>r.id!==row.id)].slice(0,100));setStatus('countered');setNote('');request.current=null;setNotice(t.saved);}
  catch(e){setError(e instanceof Error?e.message:t.failure);}finally{setBusy(false);}
 };
 const fixedTerms=!!latest&&status!=='countered';const linked=!!record.data.contacto&&!!record.data.inmueble;
 return <section aria-label={t.title} className="mb-6 space-y-3 border-b pb-5" style={{borderColor:'var(--crm-border)'}}>
  <h3 className="font-semibold">{t.title}</h3><p className="text-xs" style={{color:'var(--crm-muted)'}}>{t.description}</p>
  {!appId?<p>{t.unavailable}</p>:<>
   {loading&&<p role="status">{t.loading}</p>}
   {error&&<p role="alert" className="break-words text-sm">{error}</p>}
   <button type="button" disabled={busy||loading} onClick={()=>setRefresh(n=>n+1)} className="min-h-11 text-sm underline">{t.reload}</button>
   {notice&&<p role="status">{notice}</p>}
   {!linked&&<p className="text-sm">{t.missing}</p>}
   {loaded&&isOfferOpen(latest)&&!readOnly&&<form onSubmit={submit} className="space-y-3">
    <fieldset disabled={busy||!linked} className="space-y-3">
     <label className="block text-sm">{t.status}<select className={control} style={style} value={status} onChange={e=>{edit();const value=e.target.value as OfferStatus;setStatus(value);if(latest&&value!=='countered'){setAmount(String(latest.amount));setCurrency(latest.currency);}}}>{(latest?['countered','accepted','rejected','withdrawn'] as const:['submitted'] as const).map(s=><option key={s} value={s}>{t[s]}</option>)}</select></label>
     <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{t.amount}<input required type="number" min="0.000001" max="999999999999" step="any" readOnly={fixedTerms} value={amount} onChange={e=>{edit();setAmount(e.target.value);}} className={control} style={style}/></label>
     <label className="block text-sm">{t.currency}<select required disabled={fixedTerms} value={currency} onChange={e=>{edit();setCurrency(e.target.value);}} className={control} style={style}><option value="">—</option>{CURRENCY_CODES.map(c=><option key={c}>{c}</option>)}</select></label></div>
     <label className="block text-sm">{t.note}<textarea maxLength={4000} value={note} rows={3} onChange={e=>{edit();setNote(e.target.value);}} className={control} style={style}/></label>
     <button className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{background:'var(--crm-primary)',color:'var(--crm-primary-text)'}}>{t.save}</button>
    </fieldset>
   </form>}
   {loaded&&!isOfferOpen(latest)&&<p className="text-sm">{t.terminal}</p>}
   {loaded&&!rows.length&&<p className="text-sm">{t.empty}</p>}
   {!!rows.length&&<ol aria-label={t.history} className="space-y-3">{rows.map(r=><li key={r.id} className="rounded-lg border p-3" style={style}><strong className="text-sm">{t.revision} {r.revision} · {offerStatusText[r.status]}</strong><p className="mt-1 font-semibold">{new Intl.NumberFormat('en',{style:'currency',currency:r.currency,currencyDisplay:'code',maximumFractionDigits:20}).format(r.amount)}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.note}</p><time className="text-xs" dateTime={r.created_at}>{new Date(r.created_at).toLocaleString('en')}</time><p className="break-all text-xs">{t.actor}: {r.actor_id??(appId&&isLocalApp(appId)?t.local:t.formerActor)}</p></li>)}</ol>}
  </>}
 </section>;
}
