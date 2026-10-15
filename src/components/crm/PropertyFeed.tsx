import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Heart,MessageCircle,MapPin,Info,Building2,MoreHorizontal,CalendarDays,Trash2,Pencil,Clock3} from 'lucide-react';
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
type Market='real-estate'|'holiday-rentals';
type DealType='sale'|'rent';
const classify=(r:AppRecord):{market:Market;deal:DealType|null}|null=>{
 const d=r.data;
 const raw=[d.business_mode,d.businessMode,d.market,d.category,d.categoria,d.tipo_operacion,d.operation_type,d.listing_type,d.tipo,d.property_type,d.rental_type,d.modalidad,d.purpose].filter(v=>typeof v==='string').join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const holiday=/holiday|vacation|short.term|short_stay|short stay|tourist|turistic|temporada|alquiler vacacional|airbnb|hospitality/.test(raw);
 const sale=/venta|sale|sell|purchase|compra|for.sale/.test(raw);
 const rent=/alquiler|rent|lease|arrendamiento|for.rent/.test(raw);
 if(holiday)return {market:'holiday-rentals',deal:null};
 if(sale)return {market:'real-estate',deal:'sale'};
 if(rent)return {market:'real-estate',deal:'rent'};
 return null;
};
export function PropertyFeed({records,onOpen,onDelete,readOnly=false,canDelete=true}:{records:AppRecord[];onOpen:(record:AppRecord)=>void;onDelete?:(id:string)=>void;readOnly?:boolean;canDelete?:boolean}){
 const properties=useMemo(()=>records.filter(r=>/^(inmueble|propiedad|property|properties|listing|vivienda|inmueble_inmo)$/i.test(r.entity)),[records]);
 const [market,setMarket]=useState<Market>('real-estate');
 const [deal,setDeal]=useState<DealType>('sale');
 const [index,setIndex]=useState(0);
 const [menu,setMenu]=useState(false);
 const classified=useMemo(()=>properties.map(record=>({record,type:classify(record)})),[properties]);
 const counts={real:classified.filter(x=>x.type?.market==='real-estate').length,holiday:classified.filter(x=>x.type?.market==='holiday-rentals').length,sale:classified.filter(x=>x.type?.deal==='sale').length,rent:classified.filter(x=>x.type?.deal==='rent').length,uncategorized:classified.filter(x=>!x.type).length};
 const visible=useMemo(()=>classified.filter(x=>x.type?.market===market&&(market==='holiday-rentals'||x.type?.deal===deal)).map(x=>x.record),[classified,market,deal]);
 useEffect(()=>{setIndex(0);setTab('information');setMenu(false)},[market,deal]);
 const [tab,setTab]=useState<'information'|'interested'|'comments'|'reservations'>('information');
 useEffect(()=>setIndex(i=>Math.min(i,Math.max(0,visible.length-1))),[visible.length]);
 const item=visible[index];
 const filters=<div className="mx-auto mb-4 w-full max-w-2xl space-y-3" aria-label="Property categories">
  <div className="grid grid-cols-2 gap-2 rounded-2xl p-1.5" style={{background:'var(--crm-surface)',border:'1px solid var(--crm-border)'}}>
   {([['real-estate','Real Estate',counts.real],['holiday-rentals','Holiday Rentals',counts.holiday]] as const).map(([key,title,count])=><button key={key} type="button" aria-pressed={market===key} onClick={()=>setMarket(key)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors" style={{background:market===key?'var(--crm-primary)':'transparent',color:market===key?'var(--crm-primary-text)':'var(--crm-text)'}}>{title}<span className="text-xs opacity-70">{count}</span></button>)}
  </div>
  {market==='real-estate'&&<div className="flex items-center justify-center gap-2" role="group" aria-label="Real estate transaction">
   {([['sale','For sale',counts.sale],['rent','For rent',counts.rent]] as const).map(([key,title,count])=><button key={key} type="button" aria-pressed={deal===key} onClick={()=>setDeal(key)} className="rounded-full border px-5 py-2 text-xs font-semibold transition-colors" style={{borderColor:deal===key?'var(--crm-primary)':'var(--crm-border)',background:deal===key?'var(--crm-bg)':'transparent'}}>{title} <span className="opacity-60">{count}</span></button>)}
  </div>}
 </div>;
 if(!item)return <>{filters}<section className="mx-auto max-w-2xl rounded-2xl border p-6 text-center" style={{borderColor:'var(--crm-border)'}}><Building2 className="mx-auto mb-2 h-7 w-7"/><h2 className="font-semibold">No properties in this category</h2><p className="mt-2 text-sm" style={{color:'var(--crm-muted)'}}>Choose another category or set the listing type in the property record.</p>{counts.uncategorized>0&&<p className="mt-2 text-xs" style={{color:'var(--crm-muted)'}}>{counts.uncategorized} properties need a category before they appear in a filtered feed.</p>}</section></>;
 const move=(step:number)=>{setIndex(i=>Math.min(Math.max(i+step,0),visible.length-1));setTab('information')};
 const location=String(item.data.ubicacion||item.data.location||item.data.ciudad||item.data.city||'');
 const bookings=records.filter(r=>/^(reserva|reservas|booking|bookings|reservation|reservations)$/i.test(r.entity)&&Object.values(r.data).some(v=>v===item.id));
 const interested=records.filter(r=>r.id!==item.id&&Object.values(r.data).some(v=>typeof v==='string'&&v===item.id));
 return <>{filters}<section aria-label="Property feed" className="mx-auto w-full max-w-2xl overflow-hidden rounded-[24px] border" style={{borderColor:'var(--crm-border)',background:'var(--crm-surface)'}}>
  <div className="flex items-center justify-between px-5 py-4"><div className="relative"><button type="button" aria-label="Property actions" aria-expanded={menu} onClick={()=>setMenu(v=>!v)} className="rounded-full border p-2" style={{borderColor:'var(--crm-border)'}}><MoreHorizontal className="h-5 w-5"/></button>{menu&&<div className="absolute left-0 top-11 z-20 min-w-48 rounded-xl border p-1 shadow-xl" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}><button type="button" onClick={()=>{setMenu(false);onOpen(item)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"><Pencil className="h-4 w-4"/>View / edit record</button>{!readOnly&&canDelete&&onDelete&&<button type="button" onClick={()=>{setMenu(false);if(window.confirm('Delete this property? This cannot be undone.'))onDelete(item.id)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600"><Trash2 className="h-4 w-4"/>Delete property</button>}</div>}</div><div><p className="text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-muted)'}}>PROPERTY FEED</p><h2 className="mt-1 text-sm font-semibold">Explore your listings</h2></div><span className="text-xs tabular-nums" style={{color:'var(--crm-muted)'}}>{index+1} / {visible.length}</span></div>
  <div className="relative aspect-[4/3] overflow-hidden"><PropertyCover key={item.id} value={item.data.statehubs_media} alt={label(item)} fallback={photo(item)?<img src={photo(item)} alt={label(item)} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center" style={{background:'var(--crm-bg)'}}><Building2 className="h-12 w-12 opacity-30"/></div>}/></div>
  <div className="space-y-3 px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-xl font-semibold">{label(item)}</h3>{location&&<p className="mt-1 flex items-center gap-1 text-sm" style={{color:'var(--crm-muted)'}}><MapPin className="h-4 w-4"/>{location}</p>}</div><p className="shrink-0 font-semibold tabular-nums">{price(item)}</p></div>
   <div className="grid grid-cols-2 gap-2 border-b pb-3 sm:grid-cols-4" style={{borderColor:'var(--crm-border)'}}>{([['information','Information',Info],['interested','Interested',Heart],['comments','Activity',MessageCircle]] as const).map(([key,title,Icon])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)} className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium" style={{background:tab===key?'var(--crm-bg)':'transparent'}}><Icon className="h-4 w-4"/>{title}</button>)}</div>
   <div className="min-h-20 text-sm" style={{color:'var(--crm-muted)'}}>{tab==='information'?<p>{String(item.data.descripcion||item.data.description||'Open the property record for full details, documents and editing.')}</p>:tab==='interested'?<div><p>{interested.length} linked records reference this property.</p>{interested.slice(0,5).map(r=><button type="button" key={r.id} onClick={()=>onOpen(r)} className="mt-2 block text-left font-medium underline">{label(r)}</button>)}</div>:tab==='comments'?<p>Open the property record to view and add CRM activity. Comments are never simulated.</p>:<div><p className="mb-2">{bookings.length} linked reservations</p>{bookings.length?bookings.map(r=><button key={r.id} type="button" onClick={()=>onOpen(r)} className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs" style={{borderColor:'var(--crm-border)'}}><Clock3 className="h-4 w-4"/>{label(r)} · {String(r.data.fecha_entrada||r.data.check_in||r.data.start_date||'Date not set')}</button>):<p>No linked bookings yet. Open the property record to manage its relationships.</p>}</div>}</div>
   <button type="button" onClick={()=>onOpen(item)} className="w-full rounded-xl border px-4 py-3 text-sm font-semibold" style={{borderColor:'var(--crm-border)'}}>Open full property record</button>
   <div className="flex items-center justify-between"><button type="button" disabled={index===0} onClick={()=>move(-1)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-30" style={{borderColor:'var(--crm-border)'}}><ArrowLeft className="h-4 w-4"/>Previous</button><button type="button" disabled={index===visible.length-1} onClick={()=>move(1)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-30" style={{borderColor:'var(--crm-border)'}}>Next<ArrowRight className="h-4 w-4"/></button></div>
  </div>
 </section></>;
}
