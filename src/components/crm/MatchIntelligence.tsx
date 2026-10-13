import { useEffect, useMemo, useState } from 'react';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import type { MatchDecision } from '@/lib/crm/api';
import { localCrmApi, isLocalApp } from '@/lib/crm/localApi';
import { CONTACT_ENTITIES, matchesForRecord, matchProperty } from '@/lib/crm/matching';
import type { PropertyMatch } from '@/lib/crm/matching';
import { matchingText as t, criterionLabels, propertyTypeLabels, availabilityLabels } from '@/i18n/matching';
import { MatchingProfile } from './MatchingProfile';
import { useRuntime } from './runtimeContext';
const button='min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50';
export function MatchIntelligence({appId,record,records,blueprint,readOnly,onUpdate,onOpen}:{appId?:string;record:AppRecord;records:AppRecord[];blueprint:Blueprint;readOnly:boolean;onUpdate:(id:string,patch:RecordData)=>void;onOpen?:(id:string)=>void}) {
 const runtime=useRuntime();const api=appId&&isLocalApp(appId)?localCrmApi:crmApi;
 const [decisions,setDecisions]=useState<MatchDecision[]>([]);const [loading,setLoading]=useState(!!appId);const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);const [filter,setFilter]=useState<MatchDecision['status']>('suggested');const [qualified,setQualified]=useState(true);const [limit,setLimit]=useState(12);
 const [viewing,setViewing]=useState<PropertyMatch|null>(null);const [when,setWhen]=useState('');const [notice,setNotice]=useState('');
 useEffect(()=>{if(!appId)return;let active=true;setLoading(true);setLoaded(false);setError('');api.matchDecisions(appId).then(rows=>{if(active){setDecisions(rows);setLoaded(true);}},e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[appId,api,refresh]);
 const decisionFor=(m:PropertyMatch)=>decisions.find(d=>d.contact_id===m.contact.id&&d.property_id===m.property.id)?.status??'suggested';
 const matches=useMemo(()=>{
  if(filter==='suggested')return matchesForRecord(record,records,qualified);
  return decisions.filter(d=>d.status===filter&&(record.id===d.contact_id||record.id===d.property_id)).flatMap(d=>{const c=records.find(r=>r.id===d.contact_id),p=records.find(r=>r.id===d.property_id);return c&&p?[matchProperty(c,p)]:[];});
 },[filter,record,records,decisions,qualified]);
 const visible=matches.filter(m=>decisionFor(m)===filter);
 const title=(r:AppRecord)=>String(r.data[blueprint.entities.find(e=>e.key===r.entity)?.titleField??'nombre']??r.id);
 const decide=async(m:PropertyMatch,status:MatchDecision['status'])=>{
  if(!appId||readOnly||busy||!loaded)return;setBusy(true);setError('');
  try{const d=await api.setMatchDecision(m.contact.id,m.property.id,status);setDecisions(rows=>[...rows.filter(row=>row.contact_id!==d.contact_id||row.property_id!==d.property_id),d]);}
  catch(e){setError(e instanceof Error?e.message:t.error);}finally{setBusy(false);}
 };
 const schedule=async(e:React.FormEvent)=>{
  e.preventDefault();if(!viewing||!when||busy||readOnly||!runtime)return;setBusy(true);setError('');
  try{const result=await runtime.createQuietly('cita_inmo',{titulo:`Viewing · ${title(viewing.property)}`,tipo:'visita',cuando:when,contacto:viewing.contact.id,inmueble:viewing.property.id,resultado:'pendiente'});if(!result)throw new Error(t.error);setNotice(t.created);setViewing(null);setWhen('');}
  catch(e){setError(e instanceof Error?e.message:t.error);}finally{setBusy(false);}
 };
 if(!CONTACT_ENTITIES.has(record.entity)&&record.entity!=='inmueble')return null;
 return <section className="mb-6 border-b pb-5" style={{borderColor:'var(--crm-border)'}} aria-label={t.title}>
  <h3 className="font-semibold">{t.title}</h3><p className="mt-2 text-xs" style={{color:'var(--crm-muted)'}}>{t.explain}</p>
  <MatchingProfile record={record} readOnly={readOnly} onUpdate={onUpdate}/>
  {record.entity==='inmueble'&&<label className="mb-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={qualified} onChange={e=>setQualified(e.target.checked)}/>{t.qualifiedOnly}</label>}
  {!appId&&<p className="mb-3 text-xs">{t.demo}</p>}
  <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t.title}>{(['suggested','saved','dismissed'] as const).map(value=><button className={button} key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setLimit(12);}} style={{background:filter===value?'var(--crm-soft)':'var(--crm-surface)'}}>{t[value]}</button>)}</div>
  {loading&&<p role="status">{t.loading}</p>}{error&&<p role="alert" className="mb-3 break-words text-sm">{error}<button className={button} onClick={()=>setRefresh(n=>n+1)}>{t.retry}</button></p>}{notice&&<p role="status">{notice}</p>}
  {!loading&&!visible.length&&<p className="text-sm">{t.empty}</p>}
  <div className="space-y-3">{visible.slice(0,limit).map(m=><article key={`${m.contact.id}:${m.property.id}`} className="rounded-xl border p-4" style={{borderColor:'var(--crm-border)',background:'var(--crm-surface)'}}>
   <h4 className="break-words font-semibold">{title(m.contact)} → {title(m.property)}</h4>
   <p className="mt-2 text-sm font-semibold" style={{color:'var(--crm-primary)'}}>{m.score===null?t.review:`${t.score}: ${m.score}/100`}</p>
   {!m.eligible&&<p className="mt-2 text-sm">{t.unavailable}</p>}{m.dormant&&<p className="mt-2 text-sm">{t.reactivation}</p>}
   <ul className="my-3 space-y-1 text-xs">{m.reasons.map(r=><li key={r.criterion}><strong>{criterionLabels[r.criterion]}</strong>: {r.state==='match'?t.matched:r.state==='missing'?t.missing:t.conflict}{r.detail?` · ${r.criterion==='type'?(propertyTypeLabels[r.detail]??r.detail):r.criterion==='availability'?(availabilityLabels[r.detail]??r.detail):r.detail}`:''}</li>)}</ul>
   <p className="mb-3 text-sm">{m.reasons.some(r=>r.state==='missing')?t.qualify:t.next}</p>
   <div className="flex flex-wrap gap-2">
    <button className={button} disabled={!onOpen} onClick={()=>onOpen?.(record.id===m.contact.id?m.property.id:m.contact.id)}>{t.open}</button>
    <button className={button} disabled={readOnly||busy||!appId||!loaded} onClick={()=>void decide(m,filter==='saved'?'suggested':'saved')}>{filter==='saved'?t.restore:t.save}</button>
    <button className={button} disabled={readOnly||busy||!appId||!loaded} onClick={()=>void decide(m,filter==='dismissed'?'suggested':'dismissed')}>{filter==='dismissed'?t.restore:t.dismiss}</button>
    {typeof m.contact.data.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.contact.data.email)&&<a className={button} href={`mailto:${encodeURIComponent(m.contact.data.email)}`}>{t.email}</a>}
    {m.contact.entity==='contacto_inmo'&&blueprint.entities.some(e=>e.key==='cita_inmo')&&<button className={button} disabled={readOnly||busy||!runtime||!m.eligible||m.score===null} onClick={()=>{setViewing(m);setNotice('');}}>{t.schedule}</button>}
    {record.id===m.contact.id&&typeof m.property.data.tipo==='string'&&m.contact.data.tipo_deseado!==m.property.data.tipo&&<button className={button} disabled={readOnly||busy} title={t.feedback} onClick={()=>onUpdate(m.contact.id,{tipo_deseado:m.property.data.tipo})}>{t.learn}</button>}
   </div>
  </article>)}</div>
  {visible.length>limit&&<button className={`${button} mt-3`} onClick={()=>setLimit(n=>n+12)}>{t.more}</button>}
  {viewing&&<form onSubmit={schedule} className="mt-4 rounded-xl border p-4"><label className="block text-sm">{t.when}<input autoFocus required type="datetime-local" value={when} disabled={busy} onChange={e=>setWhen(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border p-2" style={{background:'var(--crm-surface)'}}/></label><div className="mt-3 flex gap-2"><button className={button} disabled={busy}>{t.create}</button><button type="button" className={button} disabled={busy} onClick={()=>setViewing(null)}>{t.cancel}</button></div></form>}
 </section>;
}
