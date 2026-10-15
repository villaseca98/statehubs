import {useMemo,useState} from 'react';
import {ArrowRight, BrainCircuit, CheckCircle2, Clock3, Sparkles, Workflow} from 'lucide-react';
import type {AppRecord,Blueprint,RecordData} from '@shared/blueprint/types.ts';
import {computeToday} from '@/lib/crm/today';
import {prioritizeWork,suggestWorkflows} from '@/lib/crm/operationalIntelligence';
import {analyzeDealMomentum} from '@/lib/crm/dealMomentum';

/** Actionable intelligence, not another dashboard. Reads the same records as Today. */
export function IntelligenceCommandCenter({blueprint,records,now,onOpen,onCreate,readOnly=false}:{blueprint:Blueprint;records:AppRecord[];now?:Date;onOpen:(r:AppRecord)=>void;onCreate?:(entity:string,data:RecordData)=>Promise<AppRecord|void>|AppRecord|void;readOnly?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [creating,setCreating]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const taskEntity=blueprint.entities.find(e=>['tarea','task','tareas','tasks'].includes(e.key));
 const taskTitleField=taskEntity?.fields.find(f=>['titulo','nombre','title','asunto','descripcion'].includes(f.key))?.key;
 const taskLinkField=taskEntity?.fields.find(f=>['registro_origen','origen_id','record_id','referencia','source_record_id'].includes(f.key))?.key;
 const taskStatusField=taskEntity?.fields.find(f=>['estado','status'].includes(f.key));
 const makeTask=async(recordId:string,title:string)=>{
  if(!taskEntity||!taskTitleField||!onCreate||readOnly||creating)return;
  if(!window.confirm('Create a follow-up task in your CRM? No message will be sent.'))return;
  setCreating(recordId);setNotice('');
  try{
   const data:RecordData={[taskTitleField]:title};
   if(taskLinkField)data[taskLinkField]=recordId;
   if(taskStatusField?.options?.length)data[taskStatusField.key]=taskStatusField.options[0].value;
   await onCreate(taskEntity.key,data);
   setNotice('Task saved in your CRM.');
  }catch(error){setNotice(error instanceof Error?error.message:'Unable to create task.');}
  finally{setCreating(null);}
 };
 const queue=useMemo(()=>prioritizeWork((()=>{const t=computeToday(blueprint,records,now);return [...t.atrasado,...t.hoy,...t.proximo]})()),[blueprint,records,now]);
 const suggestions=useMemo(()=>suggestWorkflows(queue),[queue]);
 const critical=queue.filter(x=>x.priority==='critical').length;
 const deals=useMemo(()=>analyzeDealMomentum(records,now??new Date()).filter(d=>d.health!=='on_track').slice(0,3),[records,now]);
 return <section aria-label="Today Intelligence" className="mb-5 overflow-hidden rounded-[26px] border p-5 sm:p-6" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}>
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div className="max-w-xl"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.17em]" style={{color:'var(--crm-primary)'}}><BrainCircuit className="h-4 w-4"/>STATEHUBS INTELLIGENCE</p>
    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your next best actions.</h2>
    <p className="mt-2 text-sm leading-6" style={{color:'var(--crm-muted)'}}>A focused queue built from actual CRM deadlines and follow-ups. Every recommendation explains why it matters. No automatic outreach.</p>
   </div>
   <div className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold" style={{borderColor:'var(--crm-border)'}}><Clock3 className="h-4 w-4"/>{queue.length} records to review · {critical} overdue</div>
  </div>
  {queue.length===0?<div className="mt-5 flex items-center gap-3 rounded-2xl p-4" style={{background:'var(--crm-bg)'}}><CheckCircle2 className="h-5 w-5 text-emerald-600"/><p className="text-sm">You're caught up. New deadlines and follow-ups will appear here as your team records them.</p></div>:
  <div className="mt-5 grid gap-2 lg:grid-cols-3">{queue.slice(0,3).map((a,index)=><button key={a.id} onClick={()=>onOpen(a.record)} className="group flex min-h-36 flex-col rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none" style={{background:'var(--crm-bg)',borderColor:'var(--crm-border)'}}>
    <div className="flex w-full items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:a.priority==='critical'?'#c2410c':'var(--crm-primary)'}}>{index+1}. {a.priority==='critical'?'Overdue':a.priority==='high'?'Due today':'Coming up'}</span><ArrowRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-1"/></div>
    <strong className="mt-3 line-clamp-1 text-sm">{a.title}</strong><span className="mt-1 line-clamp-2 text-xs" style={{color:'var(--crm-muted)'}}>{a.reason}</span>
    <span className="mt-auto pt-3 text-xs" style={{color:'var(--crm-muted)'}}>{a.explanation}</span>
   </button>)}</div>}
  {deals.length>0&&<div className="mt-4 rounded-2xl border p-4" style={{borderColor:"var(--crm-border)"}}><p className="text-xs font-semibold uppercase tracking-wider" style={{color:"var(--crm-muted)"}}>Deal momentum · missing next steps</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{deals.map(deal=><button key={deal.record.id} type="button" onClick={()=>onOpen(deal.record)} className="rounded-xl p-3 text-left transition hover:shadow-sm" style={{background:"var(--crm-bg)"}}><p className="text-sm font-semibold">{String(deal.record.data.nombre||deal.record.data.titulo||deal.record.data.referencia||"Open deal")}</p><p className="mt-1 text-xs" style={{color:"var(--crm-muted)"}}>{deal.reason}</p><p className="mt-2 text-xs font-semibold" style={{color:"var(--crm-primary)"}}>{deal.nextAction} →</p></button>)}</div></div>}
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs" style={{color:'var(--crm-muted)'}}><Sparkles className="h-4 w-4"/>Explainable rules, not invented AI confidence scores</p><button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{borderColor:'var(--crm-border)'}}><Workflow className="h-4 w-4"/>{expanded?'Hide workflow suggestions':'Review suggested workflows'}</button></div>
  {notice&&<p role="status" className="mt-3 text-sm" style={{color:'var(--crm-primary)'}}>{notice}</p>}
  {expanded&&<div className="mt-4 space-y-2" aria-label="Supervised workflow suggestions">{suggestions.length?suggestions.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{s.title}</p><p className="mt-1 text-xs" style={{color:'var(--crm-muted)'}}>{s.trigger} · {s.why}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{const r=records.find(x=>x.id===s.recordId);if(r)onOpen(r)}} className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:'var(--crm-primary)'}}>Review record <ArrowRight className="ml-1 inline h-3 w-3"/></button>{taskEntity&&taskTitleField&&!readOnly&&onCreate&&<button type="button" disabled={!!creating} onClick={()=>void makeTask(s.recordId,s.title+' — '+s.trigger)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--crm-border)'}}>{creating===s.recordId?'Saving…':'Create follow-up task'}</button>}</div></div>):<p className="text-sm" style={{color:'var(--crm-muted)'}}>No workflows need review.</p>}
  <p className="text-xs" style={{color:'var(--crm-muted)'}}>Suggestions require your confirmation. Creating a task saves a CRM record; no messages are sent.</p></div>}
 </section>;
}
