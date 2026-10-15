import {useMemo,useState} from 'react';
import {ArrowUpRight,Activity,AlertTriangle,CheckCircle2,Search} from 'lucide-react';
import type {AppRecord} from '@shared/blueprint/types.ts';
import {analyzeDealMomentum} from '@/lib/crm/dealMomentum';

type Filter='all'|'needs_attention'|'insufficient_data'|'on_track';
const titleOf=(record:AppRecord)=>String(record.data.name||record.data.nombre||record.data.title||record.data.titulo||record.data.reference||record.data.referencia||'Untitled deal');
const healthLabel:Record<Exclude<Filter,'all'>,string>={needs_attention:'Overdue',insufficient_data:'Needs a next step',on_track:'On track'};

/** Operational deal triage built from real record fields, with no fabricated confidence or conversion score. */
export function DealMomentumBoard({records,onOpen,now}:{records:AppRecord[];onOpen:(record:AppRecord)=>void;now?:Date}){
 const [expanded,setExpanded]=useState(false);
 const [filter,setFilter]=useState<Filter>('all');
 const [search,setSearch]=useState('');
 const deals=useMemo(()=>analyzeDealMomentum(records,now??new Date()),[records,now]);
 const counts={needs_attention:deals.filter(d=>d.health==='needs_attention').length,insufficient_data:deals.filter(d=>d.health==='insufficient_data').length,on_track:deals.filter(d=>d.health==='on_track').length};
 const shown=deals.filter(d=>(filter==='all'||d.health===filter)&&(titleOf(d.record)+' '+d.stage+' '+d.nextAction).toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>{
  const rank={needs_attention:0,insufficient_data:1,on_track:2};
  return rank[a.health]-rank[b.health]||titleOf(a.record).localeCompare(titleOf(b.record));
 });
 return <section aria-label="Deal Momentum" className="mb-5 rounded-[26px] border p-5 sm:p-6" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}>
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-primary)'}}><Activity className="h-4 w-4"/>DEAL MOMENTUM</p><h2 className="mt-2 text-xl font-semibold">Know which deals need your attention.</h2><p className="mt-1 text-sm" style={{color:'var(--crm-muted)'}}>Based on recorded stages, next steps and dates. Open a deal to take action.</p></div><button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:'var(--crm-border)'}}>{expanded?'Hide deals':`Review ${deals.length} active deals`}</button></div>
  <div className="mt-4 grid grid-cols-3 gap-2">{([['needs_attention',counts.needs_attention,'Overdue'],['insufficient_data',counts.insufficient_data,'No next step'],['on_track',counts.on_track,'On track']] as const).map(([key,count,label])=><button key={key} type="button" onClick={()=>{setFilter(key);setExpanded(true)}} className="rounded-xl border p-3 text-left transition hover:shadow-sm" style={{borderColor:'var(--crm-border)'}}><p className="text-xl font-semibold">{count}</p><p className="text-xs" style={{color:'var(--crm-muted)'}}>{label}</p></button>)}</div>
  {expanded&&<div className="mt-5"><div className="flex flex-wrap gap-2"><label className="flex min-w-44 flex-1 items-center gap-2 rounded-xl border px-3" style={{borderColor:'var(--crm-border)'}}><Search className="h-4 w-4"/><input type="search" aria-label="Search deals" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search deal or next action" className="w-full bg-transparent py-2 text-sm outline-none"/></label><select aria-label="Deal health filter" value={filter} onChange={e=>setFilter(e.target.value as Filter)} className="rounded-xl border bg-transparent px-3 py-2 text-sm" style={{borderColor:'var(--crm-border)'}}><option value="all">All deals</option><option value="needs_attention">Overdue</option><option value="insufficient_data">Needs next step</option><option value="on_track">On track</option></select></div>
   <div className="mt-3 max-h-96 space-y-2 overflow-auto">{shown.length?shown.map(deal=><button key={deal.record.id} type="button" onClick={()=>onOpen(deal.record)} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm" style={{borderColor:'var(--crm-border)'}}>{deal.health==='needs_attention'?<AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600"/>:deal.health==='on_track'?<CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600"/>:<Activity className="mt-1 h-4 w-4 shrink-0"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{titleOf(deal.record)}</p><p className="mt-1 text-xs" style={{color:'var(--crm-muted)'}}>{deal.stage} · {healthLabel[deal.health]}</p><p className="mt-2 text-xs">{deal.reason}</p><p className="mt-1 text-xs font-semibold" style={{color:'var(--crm-primary)'}}>{deal.nextAction}</p></div><ArrowUpRight className="h-4 w-4 shrink-0"/></button>):<p className="py-6 text-center text-sm" style={{color:'var(--crm-muted)'}}>No deals match this filter.</p>}</div>
  </div>}
 </section>;
}
