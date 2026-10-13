import { useEffect, useRef, useState } from 'react';
import type { AppRecord, Entity } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import type { RecordEvent } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { useActivityText } from '@/i18n/activity';
import { useI18n } from '@/i18n';

export function RecordActivity({ appId, record, entity, readOnly }: { appId?: string; record: AppRecord; entity: Entity; readOnly: boolean }) {
 const text = useActivityText(); const { language } = useI18n();
 const [events,setEvents] = useState<RecordEvent[]>([]); const [loading,setLoading] = useState(false);
 const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
 const [body,setBody] = useState(''); const [kind,setKind] = useState<'note'|'call'|'meeting'>('note');
 const [refresh,setRefresh] = useState(0); const request = useRef<string | null>(null);
 const local = !!appId && isLocalApp(appId); const api = local ? localCrmApi : crmApi;
 useEffect(() => {
  if (!appId) return;
  let active = true; setLoading(true); setError('');
  api.recordEvents(record.id).then(rows => { if(active) setEvents(rows); }, e => { if(active) setError(e instanceof Error ? e.message : String(e)); }).finally(() => { if(active) setLoading(false); });
  return () => { active = false; };
 }, [appId,record.id,record.updated_at,api,refresh]);
 const submit = async (e: React.FormEvent) => {
  e.preventDefault(); if (!appId || readOnly || busy || !body.trim()) return;
  setBusy(true); setError('');
  try {
   request.current ??= crypto.randomUUID();
   const event = await api.addRecordActivity(record.id,kind,body,request.current);
   setEvents(rows => [event,...rows.filter(row => row.id !== event.id)].slice(0,50));
   setBody(''); request.current = null; setRefresh(n => n+1);
  } catch(e) { setError(e instanceof Error ? e.message : text.error); }
  finally { setBusy(false); }
 };
 const fieldLabel = (key: string) => key === 'crm_lifecycle' ? text.lifecycle : key === 'crm_archived' ? text.archived : key.startsWith('crm_role_') ? text.role : entity.fields.find(f => f.key === key)?.label ?? key;
 return <section className="mt-6 border-t pt-5" style={{ borderColor:'var(--crm-border)' }} aria-label={text.title}>
  <h3 className="font-semibold">{text.title}</h3>
  {!appId ? <p className="mt-3 text-sm" style={{color:'var(--crm-muted)'}}>{text.unavailable}</p> : <>
   <p className="mt-2 text-xs" style={{color:'var(--crm-muted)'}}>{local ? text.local : text.limit}</p>
   {!readOnly && <form onSubmit={submit} className="mt-4 space-y-3">
    <label className="block text-sm">{text.kind}<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as typeof kind);request.current=null;}} className="mt-1 block min-h-11 w-full rounded-lg border px-3" style={{background:'var(--crm-surface)'}}>{(['note','call','meeting'] as const).map(k=><option key={k} value={k}>{text[k]}</option>)}</select></label>
    <label className="block text-sm">{text.body}<textarea required maxLength={4000} rows={3} disabled={busy} value={body} onChange={e=>{setBody(e.target.value);request.current=null;}} className="mt-1 block w-full rounded-lg border p-3" style={{background:'var(--crm-surface)'}} /></label>
    <button disabled={busy || !body.trim()} className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{background:'var(--crm-primary)',color:'var(--crm-primary-text)'}}>{busy ? text.saving : text.add}</button>
   </form>}
   {error && <div role="alert" className="mt-3 text-sm">{error}<button onClick={()=>setRefresh(n=>n+1)} className="ml-2 min-h-11 underline">{text.retry}</button></div>}
   {loading && <p role="status" className="mt-3 text-sm">{text.loading}</p>}
   {!loading && !error && !events.length && <p className="mt-4 text-sm">{text.empty}</p>}
   <ol className="mt-4 space-y-3">{events.map(event=><li key={event.id} className="rounded-lg border p-3" style={{borderColor:'var(--crm-border)'}}>
    <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{text[event.kind]}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(language)}</time></div>
    {event.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.body}</p>}
    {!!event.fields.length && <p className="mt-2 break-words text-sm">{[...new Set(event.fields.map(fieldLabel))].join(', ')}</p>}
    {!local && <p className="mt-2 break-all text-xs" style={{color:'var(--crm-muted)'}}>{text.actor}: {event.actor_id ?? text.system}</p>}
   </li>)}</ol>
  </>}
 </section>;
}
