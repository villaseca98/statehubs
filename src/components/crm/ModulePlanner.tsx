import { useMemo, useState } from 'react';
import { BUSINESS_MODULES, enabledCapabilities } from '@/lib/crm/realEstateOS';
import type { BusinessModuleKey } from '@/lib/crm/realEstateOS';
import { Building2, CheckCircle2, Layers3, Sparkles } from 'lucide-react';
export function ModulePlanner({appId}:{appId:string}) {
 const key='statehubs:modules:'+appId;
 const [selected,setSelected]=useState<BusinessModuleKey[]>(()=>{
   try { const value=JSON.parse(localStorage.getItem(key)||'null'); if(Array.isArray(value)) return value.filter(v=>BUSINESS_MODULES.some(m=>m.key===v)); } catch {/* use default */}
   return ['brokerage','residential','hospitality'];
 });
 const [expanded,setExpanded]=useState(false);
 const [onboardingPreferences] = useState<string[]>(()=>{
   try {
     const raw=localStorage.getItem('statehubs:onboarding:'+appId);
     const value=raw?JSON.parse(raw) as {preferences?:unknown}:null;
     return Array.isArray(value?.preferences)?value.preferences.filter((v):v is string=>typeof v==='string'):[];
   } catch {return [];}
 });
 const capabilities=useMemo(()=>enabledCapabilities(selected),[selected]);
 const toggle=(id:BusinessModuleKey)=>setSelected(previous=>{
  const next=previous.includes(id)?previous.filter(v=>v!==id):[...previous,id];
  try {localStorage.setItem(key,JSON.stringify(next));} catch {/* ephemeral */}
  return next;
 });
 return <section aria-label="Business modules" className="mb-5 rounded-[26px] border p-5" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}>
 <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-primary)'}}><Layers3 className="h-4 w-4"/>YOUR OPERATING SYSTEM</p><h2 className="mt-1 text-xl font-semibold">One portfolio. Multiple businesses.</h2><p className="mt-1 text-sm" style={{color:'var(--crm-muted)'}}>Choose the business areas you operate in. Your existing CRM data stays intact.</p></div><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:'var(--crm-border)'}}>{expanded?'Hide modules':'Configure modules'}</button></div>
 <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{background:'var(--crm-bg)'}}>{selected.length} business areas selected</span><span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{background:'var(--crm-bg)'}}>{capabilities.length} planned capabilities</span><span className="flex items-center gap-1 text-xs" style={{color:'var(--crm-muted)'}}><Sparkles className="h-3.5 w-3.5"/>Configuration preview · Not all modules are implemented</span></div>
 {onboardingPreferences.length>0&&<p className="mt-3 text-xs" style={{color:'var(--crm-muted)'}}>Your onboarding priorities: {onboardingPreferences.join(' · ')}. These are display preferences saved in this browser, not workspace permissions.</p>}
 {expanded&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{BUSINESS_MODULES.map(m=><button key={m.key} type="button" aria-pressed={selected.includes(m.key)} onClick={()=>toggle(m.key)} className="flex min-h-32 flex-col items-start rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 motion-reduce:transform-none" style={{borderColor:selected.includes(m.key)?'var(--crm-primary)':'var(--crm-border)',background:'var(--crm-bg)'}}><span className="flex w-full items-center justify-between gap-2 font-semibold"><Building2 className="h-4 w-4" style={{color:'var(--crm-primary)'}}/>{selected.includes(m.key)&&<CheckCircle2 className="h-4 w-4" style={{color:'var(--crm-primary)'}}/>}</span><span className="mt-3 text-sm font-semibold">{m.name}</span><span className="mt-1 text-xs" style={{color:'var(--crm-muted)'}}>{m.description}</span></button>)}</div>}
 </section>;
}
