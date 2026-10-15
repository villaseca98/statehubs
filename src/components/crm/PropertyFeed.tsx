import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Heart,MessageCircle,MapPin,Info,Building2} from 'lucide-react';
import type {AppRecord} from '@shared/blueprint/types.ts';
import {PropertyCover} from './PropertyCover';
import {photoOf} from '@/lib/crm/estate';

const label=(r:AppRecord)=>String(r.data.title||r.data.titulo||r.data.nombre||r.data.name||r.data.referencia||r.data.reference||'Property');
const photo=(r:AppRecord)=>photoOf(r.data.foto||r.data.imagen||r.data.image||r.data.photo||r.data.cover);
const price=(r:AppRecord)=>{
 const amount=Number(r.data.precio??r.data.price??r.data.list_price);
 if(!Number.isFinite(amount)||amount<=0)return 'Price on request';
 const currency=String(r.data.currency||r.data.moneda||'EUR');
 try{return new Intl.NumberFormat('en',{style:'currency',currency,maximumFractionDigits:0}).format(amount)}catch{return amount.toLocaleString()}
};
export function PropertyFeed({records,onOpen}:{records:AppRecord[];onOpen:(record:AppRecord)=>void}){
 const properties=useMemo(()=>records.filter(r=>/^(inmueble|propiedad|property|properties|listing|vivienda|inmueble_inmo)$/i.test(r.entity)),[records]);
 const [index,setIndex]=useState(0);
 const [tab,setTab]=useState<'information'|'interested'|'comments'>('information');
 useEffect(()=>setIndex(i=>Math.min(i,Math.max(0,properties.length-1))),[properties.length]);
 const item=properties[index];
 if(!item)return <section className="rounded-2xl border p-6 text-center" style={{borderColor:'var(--crm-border)'}}><Building2 className="mx-auto mb-2 h-7 w-7"/><h2 className="font-semibold">Your property feed</h2><p className="mt-2 text-sm" style={{color:'var(--crm-muted)'}}>Add your first property to start browsing.</p></section>;
 const move=(step:number)=>{setIndex(i=>Math.min(Math.max(i+step,0),properties.length-1));setTab('information')};
 const location=String(item.data.ubicacion||item.data.location||item.data.ciudad||item.data.city||'');
 const interested=records.filter(r=>r.id!==item.id&&Object.values(r.data).some(v=>typeof v==='string'&&v===item.id));
 return <section aria-label="Property feed" className="mx-auto w-full max-w-2xl overflow-hidden rounded-[24px] border" style={{borderColor:'var(--crm-border)',background:'var(--crm-surface)'}}>
  <div className="flex items-center justify-between px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-muted)'}}>PROPERTY FEED</p><h2 className="mt-1 text-sm font-semibold">Explore your listings</h2></div><span className="text-xs tabular-nums" style={{color:'var(--crm-muted)'}}>{index+1} / {properties.length}</span></div>
  <div className="relative aspect-[4/3] overflow-hidden"><PropertyCover key={item.id} value={item.data.statehubs_media} alt={label(item)} fallback={photo(item)?<img src={photo(item)} alt={label(item)} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center" style={{background:'var(--crm-bg)'}}><Building2 className="h-12 w-12 opacity-30"/></div>}/></div>
  <div className="space-y-3 px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-xl font-semibold">{label(item)}</h3>{location&&<p className="mt-1 flex items-center gap-1 text-sm" style={{color:'var(--crm-muted)'}}><MapPin className="h-4 w-4"/>{location}</p>}</div><p className="shrink-0 font-semibold tabular-nums">{price(item)}</p></div>
   <div className="grid grid-cols-3 gap-2 border-b pb-3" style={{borderColor:'var(--crm-border)'}}>{([['information','Information',Info],['interested','Interested',Heart],['comments','Activity',MessageCircle]] as const).map(([key,title,Icon])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)} className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium" style={{background:tab===key?'var(--crm-bg)':'transparent'}}><Icon className="h-4 w-4"/>{title}</button>)}</div>
   <div className="min-h-20 text-sm" style={{color:'var(--crm-muted)'}}>{tab==='information'?<p>{String(item.data.descripcion||item.data.description||'Open the property record for full details, documents and editing.')}</p>:tab==='interested'?<div><p>{interested.length} linked records reference this property.</p>{interested.slice(0,5).map(r=><button type="button" key={r.id} onClick={()=>onOpen(r)} className="mt-2 block text-left font-medium underline">{label(r)}</button>)}</div>:<p>Open the property record to view and add CRM activity. Comments are never simulated.</p>}</div>
   <button type="button" onClick={()=>onOpen(item)} className="w-full rounded-xl border px-4 py-3 text-sm font-semibold" style={{borderColor:'var(--crm-border)'}}>Open full property record</button>
   <div className="flex items-center justify-between"><button type="button" disabled={index===0} onClick={()=>move(-1)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-30" style={{borderColor:'var(--crm-border)'}}><ArrowLeft className="h-4 w-4"/>Previous</button><button type="button" disabled={index===properties.length-1} onClick={()=>move(1)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-30" style={{borderColor:'var(--crm-border)'}}>Next<ArrowRight className="h-4 w-4"/></button></div>
  </div>
 </section>;
}
