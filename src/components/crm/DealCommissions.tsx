import { useEffect, useRef, useState } from 'react';
import type { AppRecord } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { CURRENCY_CODES } from '@/lib/crm/currencies';
import { moneyUnits,formatUnits,validateCommission,shareBalance,type CommissionLedger,type CommissionReceipt } from '@/lib/crm/commissions';
import { commissionText as t } from '@/i18n/commissions';
const control='mt-1 block min-h-11 w-full rounded-lg border p-2';
const button='min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50';
const style={background:'var(--crm-surface)',borderColor:'var(--crm-border)'};
export function DealCommissions({appId,record,readOnly}:{appId?:string;record:AppRecord;readOnly:boolean}){
 const local=!!appId&&isLocalApp(appId),api=local?localCrmApi:crmApi;
 const [ledger,setLedger]=useState<CommissionLedger|null>(null),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[currency,setCurrency]=useState(''),[total,setTotal]=useState('');
 const [shares,setShares]=useState([{recipient:'',amount:''}]);const [share,setShare]=useState('0'),[amount,setAmount]=useState(''),[reference,setReference]=useState('');const request=useRef<string|null>(null);
 useEffect(()=>{if(!appId)return;let active=true;setLoading(true);setLoaded(false);setError('');api.commissionLedger(record.id).then(value=>{if(active){setLedger(value);setLoaded(true);}},e=>{if(active)setError(e instanceof Error?e.message:t.error);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[appId,record.id,api,refresh]);
 const [reversing,setReversing]=useState<CommissionReceipt|null>(null),[reason,setReason]=useState('');const reversalRequest=useRef<string|null>(null);
 const reverse=async(e:React.FormEvent)=>{
  e.preventDefault();if(!ledger||!reversing||readOnly||busy||!loaded)return;setBusy(true);setError('');setNotice('');
  try{reversalRequest.current??=crypto.randomUUID();const row=await api.reverseCommissionReceipt(reversing.id,reason,reversalRequest.current);setLedger({...ledger,receipts:[...ledger.receipts.filter(r=>r.id!==row.id),row]});setReversing(null);setReason('');reversalRequest.current=null;setNotice(t.saved);}
  catch(e){setError(e instanceof Error?e.message:t.error);}finally{setBusy(false);}
 };
 const edit=()=>{request.current=null;setNotice('');};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!appId||!loaded||busy||readOnly)return;setError('');setNotice('');setBusy(true);
  try{
   if(!ledger){const input={currency,total_units:moneyUnits(total,currency),shares:shares.map(s=>({recipient:s.recipient.trim(),units:moneyUnits(s.amount,currency)}))};validateCommission(input);request.current??=crypto.randomUUID();const result=await api.createCommission(record.id,input,request.current);setLedger({...result,receipts:[]});}
   else {const index=Number(share),units=moneyUnits(amount,ledger.currency);if(units>shareBalance(ledger,index))throw new Error('Receipt exceeds the outstanding allocation');request.current??=crypto.randomUUID();const result=await api.recordCommissionReceipt(record.id,index,units,reference,request.current);setLedger({...ledger,receipts:[...ledger.receipts.filter(r=>r.id!==result.id),result]});setAmount('');setReference('');}
   request.current=null;setNotice(t.saved);
  }catch(e){setError(e instanceof Error?e.message:t.error);}finally{setBusy(false);}
 };
 const actor=(id:string|null)=>id??(local?t.local:t.former);
 const received=ledger?.receipts.reduce((sum,r)=>sum+r.units,0)??0;
 return <section aria-label={t.title} className="mb-6 space-y-3 border-b pb-5" style={{borderColor:'var(--crm-border)'}}><h3 className="font-semibold">{t.title}</h3><p className="text-xs" style={{color:'var(--crm-muted)'}}>{t.description}</p>
 {!appId?<p className="text-sm">{t.unavailable}</p>:<>
  {loading&&<p role="status">{t.loading}</p>}{error&&<p role="alert" className="break-words text-sm">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" className={button} disabled={busy||loading} onClick={()=>setRefresh(n=>n+1)}>{t.refresh}</button>
  {loaded&&!ledger&&<p className="text-sm">{t.empty}</p>}
  {ledger&&<><dl className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-3" style={style}>{[[t.allocated,ledger.total_units],[t.received,received],[t.outstanding,ledger.total_units-received]].map(([label,value])=><div key={label}><dt className="text-xs">{label}</dt><dd className="break-words text-sm font-semibold">{formatUnits(Number(value),ledger.currency)}</dd></div>)}</dl>
   <ul className="space-y-2">{ledger.shares.map((s,i)=><li key={i} className="rounded-lg border p-3 text-sm" style={style}><strong className="break-words">{s.recipient}</strong><p>{t.allocated}: {formatUnits(s.units,ledger.currency)}</p><p>{t.outstanding}: {formatUnits(shareBalance(ledger,i),ledger.currency)}</p></li>)}</ul><p className="break-all text-xs">{t.actor}: {actor(ledger.actor_id)}</p>
   {received===ledger.total_units&&<p className="text-sm">{t.settled}</p>}
  </>}
  {loaded&&!readOnly&&(!ledger||received<ledger.total_units)&&<form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
   {!ledger?<><p className="text-sm">{t.locked}</p><label className="block text-sm">{t.currency}<select required aria-label={t.currency} value={currency} onChange={e=>{edit();setCurrency(e.target.value);}} className={control} style={style}><option value="">—</option>{CURRENCY_CODES.map(c=><option key={c}>{c}</option>)}</select></label><label className="block text-sm">{t.total}<input required inputMode="decimal" value={total} onChange={e=>{edit();setTotal(e.target.value);}} className={control} style={style}/></label>
    {shares.map((s,i)=><div key={i} className="space-y-2 rounded-lg border p-3" style={style}><label className="block text-sm">{t.recipient} {i+1}<input required maxLength={200} value={s.recipient} onChange={e=>{edit();setShares(rows=>rows.map((r,j)=>j===i?{...r,recipient:e.target.value}:r));}} className={control} style={style}/></label><label className="block text-sm">{t.allocation} {i+1}<input required inputMode="decimal" value={s.amount} onChange={e=>{edit();setShares(rows=>rows.map((r,j)=>j===i?{...r,amount:e.target.value}:r));}} className={control} style={style}/></label><button type="button" className={button} disabled={shares.length===1} onClick={()=>{edit();setShares(rows=>rows.filter((_,j)=>i!==j));}}>{t.remove}</button></div>)}
    <button type="button" className={button} disabled={shares.length>=50} onClick={()=>{edit();setShares(rows=>[...rows,{recipient:'',amount:''}]);}}>{t.add}</button>
   </>:<><label className="block text-sm">{t.share}<select aria-label={t.share} value={share} onChange={e=>{edit();setShare(e.target.value);}} className={control} style={style}>{ledger.shares.map((s,i)=><option key={i} value={i}>{s.recipient}</option>)}</select></label><label className="block text-sm">{t.receiptAmount}<input required inputMode="decimal" value={amount} onChange={e=>{edit();setAmount(e.target.value);}} className={control} style={style}/></label><label className="block text-sm">{t.reference}<input required maxLength={500} value={reference} onChange={e=>{edit();setReference(e.target.value);}} className={control} style={style}/></label></>}
   <button className={`${button} block`} style={{background:'var(--crm-primary)',color:'var(--crm-primary-text)'}}>{ledger?t.receipt:t.create}</button>
  </fieldset></form>}
  {!!ledger?.receipts.length&&<ol aria-label={t.history} className="space-y-2">{[...ledger.receipts].reverse().map(r=><li key={r.id} className="rounded-lg border p-3 text-sm" style={style}><strong>{formatUnits(r.units,ledger.currency)} · {ledger.shares[r.share_index].recipient}</strong><p className="break-words">{r.reference}</p>{r.reverses&&<p className="text-xs">{t.reversal}</p>}{ledger.receipts.some(entry=>entry.reverses===r.id)&&<p className="text-xs">{t.reversed}</p>}<time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString('en')}</time><p className="break-all text-xs">{t.actor}: {actor(r.actor_id)}</p>{!readOnly&&r.units>0&&!ledger.receipts.some(entry=>entry.reverses===r.id)&&<button type="button" disabled={busy||!loaded} className={button} onClick={()=>{setReversing(r);setReason('');reversalRequest.current=null;setNotice('');}}>{t.reverse}</button>}</li>)}</ol>}
  {reversing&&ledger&&!readOnly&&<form onSubmit={reverse} className="space-y-3 rounded-lg border p-3" style={style} aria-label={t.reverse}><p className="text-sm">{t.reversalHelp}</p><p className="break-words text-sm font-semibold">{formatUnits(reversing.units,ledger.currency)} · {reversing.reference}</p><label className="block text-sm">{t.reason}<textarea autoFocus required maxLength={500} disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);reversalRequest.current=null;}} className={control} style={style}/></label><div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!reason.trim()}>{t.confirm}</button><button type="button" className={button} disabled={busy} onClick={()=>setReversing(null)}>{t.cancel}</button></div></form>}
 </>}
 </section>;
}
