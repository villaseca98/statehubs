import {useMemo,useState} from 'react';
import {ArrowRight, Orbit, Sparkles} from 'lucide-react';
import type {AppRecord} from '@shared/blueprint/types.ts';
import {matchesForMode} from '@/lib/crm/matching';
type MatchMode='sale'|'rent';

/** Read-only, interactive visualization of actual match edges; not a second matching engine. */
export function OpportunityUniverse({records,onOpen}:{records:AppRecord[];onOpen:(record:AppRecord)=>void}){
 const [mode,setMode]=useState<MatchMode>('sale');
 const [selected,setSelected]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1);
 const matches=useMemo(()=>matchesForMode(records,mode,12),[records,mode]);
 const properties=useMemo(()=>[...new Map(matches.map(m=>[m.property.id,m.property])).values()].slice(0,6),[matches]);
 const buyers=useMemo(()=>[...new Map(matches.map(m=>[m.contact.id,m.contact])).values()].slice(0,8),[matches]);
 const nodes=[...properties.map((record,i)=>({record,x:120,y:45+i*55,type:'property' as const})),...buyers.map((record,i)=>({record,x:460,y:34+i*43,type:'contact' as const}))];
 const active=nodes.find(n=>n.record.id===selected);
 const connections=matches.filter(m=>nodes.some(n=>n.record.id===m.property.id)&&nodes.some(n=>n.record.id===m.contact.id));
 const label=(r:AppRecord)=>String(r.data.nombre||r.data.direccion||r.data.referencia||'Untitled');
 return <section aria-label="Opportunity Universe" className="mb-5 overflow-hidden rounded-[26px] border p-5 sm:p-6" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}>
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.17em]" style={{color:'var(--crm-primary)'}}><Orbit className="h-4 w-4"/>OPPORTUNITY UNIVERSE</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">See the connections that matter.</h2><p className="mt-2 max-w-xl text-sm leading-6" style={{color:'var(--crm-muted)'}}>Every connection is a real property-to-contact match, calculated from the preferences already in your CRM. Select a node to explore.</p></div><div className="flex rounded-xl border p-1" style={{borderColor:'var(--crm-border)'}}>{(['sale','rent'] as const).map(value=><button key={value} onClick={()=>{setMode(value);setSelected(null)}} aria-pressed={mode===value} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{background:mode===value?'var(--crm-primary)':'transparent',color:mode===value?'white':'var(--crm-text)'}}>{value==='sale'?'Sales':'Rentals'}</button>)}</div></div>
  {connections.length?<div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
    <div className="relative overflow-hidden rounded-2xl border" style={{background:'radial-gradient(ellipse at 50% 35%,#162c43,#101b2c 72%)',borderColor:'var(--crm-border)'}}>
     <svg viewBox="0 0 580 410" role="img" aria-label="Connected properties on the left and matching contacts on the right" className="block h-auto w-full">
      <g style={{transform:`translate(290px,205px) scale(${zoom}) translate(-290px,-205px)`,transition:'transform 400ms ease'}}>
      <defs><linearGradient id="sh-universe-edge" x1="0" x2="1"><stop stopColor="#7bc7b2" stopOpacity=".6"/><stop offset="1" stopColor="#d9bd82" stopOpacity=".6"/></linearGradient><filter id="sh-universe-glow"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {Array.from({length:24},(_,i)=><circle key={'star'+i} cx={(i*173+37)%580} cy={(i*97+29)%410} r={i%3===0?1.2:.6} fill="#c9dce9" opacity=".3"/>)}
      {connections.map(m=>{const a=nodes.find(n=>n.record.id===m.property.id),b=nodes.find(n=>n.record.id===m.contact.id);if(!a||!b)return null;const focus=!selected||selected===a.record.id||selected===b.record.id;return <path key={m.contact.id+':'+m.property.id} d={`M ${a.x} ${a.y} C 270 ${a.y}, 310 ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="url(#sh-universe-edge)" strokeWidth={Math.max(1,(m.score??0)/30)} opacity={focus ? 0.75 : 0.09} className="transition-opacity duration-500"/>})}
      {nodes.map(n=>{const focus=!selected||selected===n.record.id||connections.some(m=>(m.property.id===selected&&m.contact.id===n.record.id)||(m.contact.id===selected&&m.property.id===n.record.id));return <g key={n.record.id} opacity={focus?1:.2} className="transition-opacity duration-500"><circle cx={n.x} cy={n.y} r="13" fill={n.type==='property'?'#70c5ad':'#dfc58e'} opacity=".35" filter="url(#sh-universe-glow)"/><circle cx={n.x} cy={n.y} r={selected===n.record.id?9:6} fill={n.type==='property'?'#87d7be':'#f2d7a0'} stroke="#f5f5f4" strokeWidth={selected===n.record.id?1.5:0} className="transition-all duration-300"/><text x={n.type==='property'?n.x+17:n.x-17} y={n.y+4} textAnchor={n.type==='property'?'start':'end'} fontSize="11" fill="#e8edf4">{label(n.record).slice(0,19)}</text></g>})}
      </g>
      <text x="25" y="392" fill="#a3bdc8" fontSize="11">PROPERTIES</text><text x="555" y="392" textAnchor="end" fill="#a3bdc8" fontSize="11">CONTACTS</text>
     </svg>
     <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3"><p className="text-xs text-[#a9c1ce]">Real matches · interactive focus · subtle motion</p><div className="flex gap-1" role="group" aria-label="Graph zoom"><button type="button" aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(0.8,Math.round((v-0.2)*10)/10))} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white">−</button><button type="button" aria-label="Reset zoom" onClick={()=>setZoom(1)} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white">{Math.round(zoom*100)}%</button><button type="button" aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(1.8,Math.round((v+0.2)*10)/10))} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white">+</button></div></div>
    </div>
    <div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--crm-muted)'}}>Explore a connection</p><div className="max-h-64 space-y-1 overflow-y-auto">{nodes.map(n=><button key={n.record.id} onClick={()=>setSelected(n.record.id)} aria-pressed={selected===n.record.id} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors" style={{background:selected===n.record.id?'var(--crm-bg)':'transparent'}}><span className="h-2 w-2 shrink-0 rounded-full" style={{background:n.type==='property'?'#70c5ad':'#dfc58e'}}/><span className="min-w-0 flex-1 truncate">{label(n.record)}</span></button>)}</div>{active&&<button onClick={()=>onOpen(active.record)} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-white" style={{background:'var(--crm-primary)'}}>Open {active.type==='property'?'property':'contact'} <ArrowRight className="h-4 w-4"/></button>}<p className="text-xs" style={{color:'var(--crm-muted)'}}>{connections.length} matching relationships shown. Select a property or contact to focus its network.</p></div>
   </div>:<div className="mt-5 flex items-center gap-3 rounded-2xl p-5" style={{background:'var(--crm-bg)'}}><Sparkles className="h-5 w-5" style={{color:'var(--crm-primary)'}}/><p className="text-sm">No matching connections yet. Add property details and contact preferences to populate your universe.</p></div>}
 </section>;
}
