import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,ClipboardList,Loader2,ShieldCheck,X} from 'lucide-react';
import type {AppRecord,Blueprint} from '@shared/blueprint/types.ts';
import {crmApi} from '@/lib/crm/api';
import type {AutomationApproval,AutomationApprovalEvent} from '@/lib/crm/api';
import {localCrmApi,isLocalApp} from '@/lib/crm/localApi';
import {computeToday} from '@/lib/crm/today';
import {prioritizeWork} from '@/lib/crm/operationalIntelligence';
import {useAuth} from '@/lib/useAuth';

export function AutopilotApprovalPanel({appId,blueprint,records,readOnly=false,onOpen}:{appId?:string;blueprint:Blueprint;records:AppRecord[];readOnly?:boolean;onOpen:(record:AppRecord)=>void}){
 const {user}=useAuth();
 const api=appId&&isLocalApp(appId)?localCrmApi:crmApi;
 const [items,setItems]=useState<AutomationApproval[]>([]);
 const [history,setHistory]=useState<AutomationApprovalEvent[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState(false);
 const [search,setSearch]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const [batchProgress,setBatchProgress]=useState('');
 const [statusFilter,setStatusFilter]=useState<'all'|'pending'|'approved'|'completed'|'dismissed'>('all');
 const proposals=useMemo(()=>{const today=computeToday(blueprint,records);return prioritizeWork([...today.atrasado,...today.hoy,...today.proximo]).slice(0,8)},[blueprint,records]);
 const reload=useCallback(async()=>{if(!appId)return;try{const [approvals,events]=await Promise.all([api.automationApprovals(appId),api.automationApprovalEvents(appId)]);setItems(approvals);setHistory(events);setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load approvals')}},[api,appId]);
 useEffect(()=>{void reload()},[reload]);
 const propose=async(recordId:string,action:AutomationApproval['action_type'],title:string,reason:string)=>{
  if(!appId||busy||readOnly)return;
  if(!isLocalApp(appId)&&!user?.id){setError('Sign in to save automation proposals.');return}
  setBusy(true);setError('');
  try{await api.proposeAutomation(appId,user?.id||'local',recordId,action,title,reason);await reload()}
  catch(e){setError(e instanceof Error?e.message:'Unable to save proposal')}finally{setBusy(false)}
 };
 const decide=async(id:string,status:'approved'|'dismissed'|'completed')=>{
  if(busy||readOnly)return;
  setBusy(true);setError('');
  try{await api.decideAutomation(id,status);await reload()}
  catch(e){setError(e instanceof Error?e.message:'Unable to update approval')}finally{setBusy(false)}
 };
 const executeApproved=async(approval:AutomationApproval)=>{
  if(busy||readOnly)return;
  if(!records.some(record=>record.id===approval.source_record_id)){setError('Source record is unavailable. No action was taken.');return}
  if(!window.confirm('Log this approved action in the source record activity and mark it complete? This does not contact the client.'))return;
  setBusy(true);setError('');
  try{
   // Stable request ID makes retries idempotent if the status transition fails.
   await api.addRecordActivity(approval.source_record_id,'note',`Autopilot approved action: ${approval.title}. ${approval.reason}`.trim(),approval.id);
   await api.decideAutomation(approval.id,'completed');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Unable to record the action. You can retry safely.')}
  finally{setBusy(false)}
 };
 const visibleProposals=proposals.filter(p=>(p.title+' '+p.reason+' '+p.explanation).toLowerCase().includes(search.trim().toLowerCase()));
 const eligibleProposals=visibleProposals.filter(p=>!items.some(x=>x.source_record_id===p.record.id&&x.action_type===p.action&&x.status==='pending'));
 const queueAll=async()=>{
  if(!appId||busy||readOnly||!eligibleProposals.length)return;
  if(!isLocalApp(appId)&&!user?.id){setError('Sign in to save automation proposals.');return}
  if(!window.confirm(`Add ${eligibleProposals.length} suggestions to your approval queue? Nothing will be executed or sent.`))return;
  setBusy(true);setError('');setBatchProgress('');
  let saved=0;
  const failures:string[]=[];
  for(const proposal of eligibleProposals){
   try{await api.proposeAutomation(appId,user?.id||'local',proposal.record.id,proposal.action,proposal.title,proposal.reason);saved++}
   catch(e){failures.push(`${proposal.title}: ${e instanceof Error?e.message:'Could not save'}`)}
  }
  await reload();
  setBatchProgress(`${saved} suggestion${saved===1?'':'s'} queued${failures.length?`; ${failures.length} failed`:''}.`);
  if(failures.length)setError(failures.slice(0,3).join(' · '));
  setBusy(false);
 };
 const pending=items.filter(x=>x.status==='pending');
 const approved=items.filter(x=>x.status==='approved');
 const completed=items.filter(x=>x.status==='completed');
 const dismissed=items.filter(x=>x.status==='dismissed');
 const sourceById=new Map(records.map(record=>[record.id,record]));
 const filteredQueue=items.filter(item=>statusFilter==='all'||item.status===statusFilter);
 const missingSources=items.filter(item=>item.status!=='completed'&&item.status!=='dismissed'&&!sourceById.has(item.source_record_id));
 const queuedIds=new Set(items.filter(item=>item.status==='pending'||item.status==='approved').map(item=>item.source_record_id));
 const unqueuedUrgent=proposals.filter(p=>p.priority==='critical'&&!queuedIds.has(p.record.id));
 return <section aria-label="Autopilot approvals" className="mb-5 rounded-[26px] border p-5 sm:p-6" style={{background:'var(--crm-surface)',borderColor:'var(--crm-border)'}}>
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{color:'var(--crm-primary)'}}><ShieldCheck className="h-4 w-4"/>AUTOPILOT · APPROVALS</p><h2 className="mt-2 text-xl font-semibold">You stay in control.</h2><p className="mt-1 text-sm" style={{color:'var(--crm-muted)'}}>Queue suggestions, approve them, and track their status across sessions. Approval never sends a message.</p></div><button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:'var(--crm-border)'}}>{expanded?'Close queue':`Open queue · ${pending.length} pending`}</button></div>
  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Autopilot queue summary">{[[pending.length,'Pending review'],[approved.length,'Ready to log'],[completed.length,'Completed'],[unqueuedUrgent.length,'Critical not queued']].map(([value,label])=><div key={String(label)} className="rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><p className="text-xl font-semibold">{value}</p><p className="text-xs" style={{color:'var(--crm-muted)'}}>{label}</p></div>)}</div>
  {expanded&&<div className="mt-5 space-y-4">
   {missingSources.length>0&&<p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{missingSources.length} queued action(s) refer to deleted or unavailable records. They cannot be executed; review and dismiss them.</p>}
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
   {!appId&&<p className="text-sm">Save this workspace before creating approvals.</p>}
   <div><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4"/>Suggested next steps</h3><button type="button" disabled={busy||readOnly||!appId||!eligibleProposals.length} onClick={()=>void queueAll()} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{borderColor:'var(--crm-border)'}}>Queue all available ({eligibleProposals.length})</button></div><label className="mt-3 block text-xs" style={{color:'var(--crm-muted)'}}>Filter suggestions<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Lead, appointment, follow-up…" className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" style={{borderColor:'var(--crm-border)'}} /></label>{batchProgress&&<p role="status" className="mt-2 text-xs" style={{color:'var(--crm-primary)'}}>{batchProgress}</p>}<div className="mt-2 space-y-2">{visibleProposals.length?visibleProposals.map(p=>{
    const existing=items.find(x=>x.source_record_id===p.record.id&&x.action_type===p.action&&x.status==='pending');
    return <div key={p.record.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{p.title}</p><p className="text-xs" style={{color:'var(--crm-muted)'}}>{p.explanation}</p></div><button onClick={()=>onOpen(p.record)} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:'var(--crm-border)'}}>View record</button><button disabled={busy||!!existing||readOnly||!appId} onClick={()=>void propose(p.record.id,p.action,p.title,p.reason)} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:'var(--crm-primary)'}}>{existing?'Queued':'Add to queue'}</button></div>
   }):<p className="text-sm" style={{color:'var(--crm-muted)'}}>No follow-ups need review.</p>}</div></div>
   <div className="flex flex-wrap items-center gap-2"><label htmlFor="autopilot-status-filter" className="text-xs font-semibold">Queue status</label><select id="autopilot-status-filter" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border bg-transparent px-3 py-2 text-xs" style={{borderColor:'var(--crm-border)'}}><option value="all">All ({items.length})</option><option value="pending">Pending ({pending.length})</option><option value="approved">Approved ({approved.length})</option><option value="completed">Completed ({completed.length})</option><option value="dismissed">Dismissed ({dismissed.length})</option></select><p className="text-xs" style={{color:'var(--crm-muted)'}}>{filteredQueue.length} matching items</p></div>
   {(statusFilter==='all'||statusFilter==='pending')&&<div><h3 className="text-sm font-semibold">Pending approval ({pending.length})</h3><div className="mt-2 space-y-2">{pending.map(a=><div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{a.title}</p><p className="text-xs" style={{color:'var(--crm-muted)'}}>{a.reason}</p></div><button disabled={busy||readOnly} onClick={()=>void decide(a.id,'approved')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"><Check className="mr-1 inline h-3 w-3"/>Approve</button><button disabled={busy||readOnly} onClick={()=>void decide(a.id,'dismissed')} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50" style={{borderColor:'var(--crm-border)'}}><X className="mr-1 inline h-3 w-3"/>Dismiss</button></div>)}{!pending.length&&<p className="text-xs" style={{color:'var(--crm-muted)'}}>No pending approvals.</p>}</div></div></div>
   {(statusFilter==='all'||statusFilter==='approved')&&approved.length>0&&<div><h3 className="text-sm font-semibold">Approved for manual execution ({approved.length})</h3><div className="mt-2 space-y-2">{approved.map(a=><div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{a.title}</p><p className="text-xs" style={{color:'var(--crm-muted)'}}>Approved · log the action in CRM activity to complete</p></div><button onClick={()=>{const r=records.find(x=>x.id===a.source_record_id);if(r)onOpen(r)}} className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:'var(--crm-border)'}}>Open record</button><button disabled={busy||readOnly} onClick={()=>void executeApproved(a)} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{background:'var(--crm-primary)'}}>Log action &amp; complete</button></div>)}</div></div>}
   {(statusFilter==='all'||statusFilter==='completed')&&completed.length>0&&<details className="rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><summary className="cursor-pointer text-sm font-semibold">Completed actions ({completed.length})</summary><ul className="mt-3 space-y-2">{completed.slice(0,30).map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{color:'var(--crm-muted)'}}><span>{a.title}</span><time dateTime={a.decided_at||a.updated_at}>{new Date(a.updated_at).toLocaleString()}</time></li>)}</ul></details>}
   {(statusFilter==='all'||statusFilter==='dismissed')&&dismissed.length>0&&<details className="rounded-xl border p-3" style={{borderColor:'var(--crm-border)'}}><summary className="cursor-pointer text-sm font-semibold">Dismissed suggestions ({dismissed.length})</summary><ul className="mt-3 space-y-2">{dismissed.slice(0,20).map(a=><li key={a.id} className="text-xs" style={{color:'var(--crm-muted)'}}>{a.title}</li>)}</ul></details>}
   {history.length>0&&<div className="rounded-xl border p-4" style={{borderColor:'var(--crm-border)'}}><button type="button" onClick={()=>setShowHistory(v=>!v)} aria-expanded={showHistory} className="text-sm font-semibold">Decision history ({history.length}) {showHistory? "−":"+"}</button>{showHistory&&<ol className="mt-3 max-h-44 space-y-2 overflow-auto">{history.slice(0,20).map(event=><li key={event.id} className="flex flex-wrap justify-between gap-2 text-xs" style={{color:'var(--crm-muted)'}}><span>{event.previous_status} → {event.new_status}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></li>)}</ol>}</div>}
   <p className="flex items-center gap-2 text-xs" style={{color:'var(--crm-muted)'}}>{busy&&<Loader2 className="h-3 w-3 animate-spin"/>}Only the workspace owner can manage this approval queue. Actions are logged only when you explicitly confirm. No external messages are sent.</p>
  </div>}
 </section>;
}
