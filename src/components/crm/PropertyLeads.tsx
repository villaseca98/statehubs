import {useMemo,useState} from 'react';
import {ChevronDown,ExternalLink,Instagram,Mail,Phone,Sparkles,Users} from 'lucide-react';
import type {AppRecord} from '@shared/blueprint/types.ts';

const title=(r:AppRecord)=>String(r.data.nombre||r.data.name||r.data.full_name||r.data.username||r.data.usuario||'Unnamed lead');
const value=(r:AppRecord,keys:string[])=>keys.map(k=>r.data[k]).find(v=>typeof v==='string'&&v.trim()) as string|undefined;
const isLead=(r:AppRecord)=>/^(lead|leads|contact|contacts|contacto|contactos|cliente|clientes|buyer|buyers|prospect|prospects)$/i.test(r.entity);
const linked=(r:AppRecord,id:string)=>['property_id','propertyId','inmueble_id','listing_id','listingId','interested_property_id','propiedad_id'].some(k=>r.data[k]===id);
const qualified=(r:AppRecord)=>/^(qualified|cualificado|calificado|hot|sales.ready|sales_ready)$/i.test(String(r.data.qualification_status||r.data.qualification||r.data.lead_status||r.data.estado_calificacion||'').trim());
const contact=(r:AppRecord)=>({email:value(r,['email','correo','correo_electronico']),phone:value(r,['phone','telefono','mobile','whatsapp'])});
export function PropertyLeads({propertyId,records,onOpen,onMatch}:{propertyId:string;records:AppRecord[];onOpen:(r:AppRecord)=>void;onMatch?:()=>void}){
 const [section,setSection]=useState<'qualified'|'potential'>('qualified');
 const leads=useMemo(()=>records.filter(r=>isLead(r)&&linked(r,propertyId)),[records,propertyId]);
 const qualifiedLeads=leads.filter(qualified);
 const potential=leads.filter(r=>!qualified(r));
 const shown=section==='qualified'?qualifiedLeads:potential;
 return <div className="space-y-3">
  <div className="flex gap-2 rounded-xl p-1" style={{background:'var(--crm-bg)'}} role="group" aria-label="Lead qualification">
   {([['qualified','Qualified',qualifiedLeads.length],['potential','Potential interest',potential.length]] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)} className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold" style={{background:section===key?'var(--crm-surface)':'transparent',color:'var(--crm-text)'}}>{label} <span className="opacity-60">{count}</span></button>)}
  </div>
  {section==='potential'&&onMatch&&<button type="button" onClick={onMatch} className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs font-semibold" style={{borderColor:'var(--crm-border)'}}><span className="flex items-center gap-2"><Sparkles className="h-4 w-4"/>Find more potential buyers in Match Engine</span><ExternalLink className="h-4 w-4"/></button>}
  {shown.length?shown.map(r=>{const c=contact(r);const source=String(r.data.source||r.data.origen||r.data.lead_source||'').toLowerCase();return <details key={r.id} className="group rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><summary className="flex cursor-pointer list-none items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{background:'var(--crm-bg)'}}>{source.includes('instagram')?<Instagram className="h-4 w-4"/>:<Users className="h-4 w-4"/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title(r)}</span><span className="text-xs" style={{color:'var(--crm-muted)'}}>{source.includes('instagram')?'Instagram lead':'CRM lead'} · {section==='qualified'?'Qualified':'Qualification pending'}</span></span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180"/></summary><div className="mt-3 space-y-2 border-t pt-3 text-xs" style={{borderColor:'var(--crm-border)'}}>{c.email?<a className="flex items-center gap-2 underline" href={`mailto:${encodeURIComponent(c.email)}`}><Mail className="h-4 w-4"/>{c.email}</a>:<p>Email not provided</p>}{c.phone?<a className="flex items-center gap-2 underline" href={`tel:${c.phone.replace(/[^+\d]/g,'')}`}><Phone className="h-4 w-4"/>{c.phone}</a>:<p>Phone not provided</p>}<button type="button" onClick={()=>onOpen(r)} className="font-semibold underline">Open lead record</button></div></details>}).slice(0,30):<p className="rounded-xl p-4 text-center text-xs" style={{background:'var(--crm-bg)',color:'var(--crm-muted)'}}>No {section==='qualified'?'qualified':'potential'} leads linked to this property yet.</p>}
  <p className="text-xs" style={{color:'var(--crm-muted)'}}>Only saved CRM contacts linked to this property appear here. Contact details are shown only when present in their records.</p>
 </div>;
}
