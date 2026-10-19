import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Building2, ExternalLink, Heart, Instagram, Lock, Mail, MessageCircle, Phone, Search, Sparkles } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import { isLocalApp } from '@/lib/crm/localApi';
import { CHANNELS, channelOf, needsReply, parseTranscript } from '@/lib/crm/conversations';
import type { Channel } from '@/lib/crm/conversations';
import { contactLinks, currencyCode, initials, money } from '@/lib/crm/propertyFormat';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useHubText } from '@/i18n/hub';
import { useI18n } from '@/i18n';
import { RecordActivity } from './RecordActivity';

type Filter = 'all' | 'reply' | 'qualified' | 'booked';
type ChannelState = 'connected' | 'off' | 'checking' | 'demo';
const border = { borderColor: 'var(--crm-border)' };
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';

/**
 * Instagram-Direct-like inbox over the `conversacion` records the assistant
 * writes. Channels without an official connection say so; nothing is sent
 * from here until a channel adapter exists.
 */
export function ConversationCenter({ blueprint, records, appId, readOnly, selectedId, titleOf, onOpenRecord, onOpenProperty, onMatcher }: {
 blueprint: Blueprint; records: AppRecord[]; appId?: string; readOnly: boolean; selectedId?: string | null;
 titleOf: (id: string) => string | undefined; onOpenRecord: (id: string) => void; onOpenProperty: (id: string) => void; onMatcher: (id: string) => void;
}) {
 const t = usePropertyFeedText(); const h = useHubText(); const { language } = useI18n();
 const [query, setQuery] = useState(''); const [filter, setFilter] = useState<Filter>('all');
 const [active, setActive] = useState<string | null>(selectedId ?? null);
 const [instagram, setInstagram] = useState<ChannelState>(appId && !isLocalApp(appId) ? 'checking' : 'demo');
 useEffect(() => { if (selectedId) setActive(selectedId); }, [selectedId]);
 useEffect(() => {
  if (!appId || isLocalApp(appId)) return; let live = true;
  crmApi.instagram(appId, 'status').then(s => { if (live) setInstagram(s.connected ? 'connected' : 'off'); }, () => { if (live) setInstagram('off'); });
  return () => { live = false; };
 }, [appId]);
 const entity = blueprint.entities.find(e => e.key === 'conversacion');
 const option = (r: AppRecord, key: string) => entity?.fields.find(f => f.key === key)?.options?.find(o => o.value === r.data[key])?.label ?? str(r.data[key]);
 const conversations = useMemo(() => records.filter(r => r.entity === 'conversacion')
  .sort((a, b) => str(b.data.ultima_actividad || b.updated_at).localeCompare(str(a.data.ultima_actividad || a.updated_at))), [records]);
 const q = query.trim().toLowerCase();
 const shown = conversations.filter(r => (filter === 'all' || (filter === 'reply' && needsReply(r)) || (filter === 'qualified' && r.data.estado === 'cualificado') || (filter === 'booked' && ['agendado', 'reservado'].includes(String(r.data.estado))))
  && (!q || [r.data.usuario, r.data.nombre, r.data.zona, r.data.resumen, r.data.transcripcion].some(v => str(v).toLowerCase().includes(q))));
 const current = conversations.find(r => r.id === active) ?? null;
 const stateOf = (c: Channel): ChannelState => c === 'instagram' ? instagram : 'off';
 const stateLabel = (s: ChannelState) => s === 'connected' ? h.connected : s === 'checking' ? h.checking : s === 'demo' ? h.demo : h.notConnected;

 if (!entity) return null;
 return <div className="grid h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-[24px] border md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]" style={{ ...border, background: 'var(--crm-surface)' }}>
  <aside className={`${current ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r`} style={border} aria-label={h.inbox}>
   <div className="space-y-3 border-b p-3" style={border}>
    <label className="flex min-h-11 items-center gap-2 rounded-full px-3" style={{ background: 'var(--crm-bg)' }}><Search aria-hidden="true" className="h-4 w-4" style={{ color: 'var(--crm-muted)' }} /><span className="sr-only">{h.searchInbox}</span>
     <input value={query} onChange={e => setQuery(e.target.value)} placeholder={h.searchInbox} className="w-full bg-transparent text-sm outline-none" /></label>
    <div role="group" aria-label={h.inbox} className="sh-scroll-x flex gap-1">{([['all', h.all], ['reply', h.needsReply], ['qualified', h.qualified], ['booked', h.booked]] as const).map(([key, name]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold" style={filter === key ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>{name}</button>)}</div>
    <details className="text-xs"><summary className="min-h-9 cursor-pointer py-2 font-semibold" style={{ color: 'var(--crm-muted)' }}>{h.channels}</summary>
     <ul className="mt-1 space-y-1">{CHANNELS.map(c => { const s = stateOf(c); return <li key={c} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: 'var(--crm-bg)' }}><span>{h.channel[c]}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s === 'connected' ? '#2f7d4f' : s === 'demo' ? '#c08a2b' : '#9aa39d' }} />{stateLabel(s)}</span></li>; })}</ul>
    </details>
   </div>
   <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
    {shown.map(r => { const last = parseTranscript(r.data.transcripcion).at(-1); const name = str(r.data.nombre) || str(r.data.usuario) || t.unnamed; const unread = needsReply(r); return <li key={r.id}>
     <button type="button" aria-current={active === r.id ? 'true' : undefined} onClick={() => setActive(r.id)} className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-[var(--crm-soft)]" style={active === r.id ? { background: 'var(--crm-soft)' } : undefined}>
      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg,#1f5c43,#c8a96a)' }}><span className="grid h-full w-full place-items-center rounded-full text-sm font-semibold" style={{ background: 'var(--crm-surface)' }}>{initials(name)}</span></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={`truncate text-sm ${unread ? 'font-bold' : 'font-medium'}`}>{name}</span>{r.is_sample && <span className="text-[10px]" style={{ color: 'var(--crm-muted)' }}>{h.sample}</span>}</span>
       <span className={`block truncate text-xs ${unread ? 'font-semibold' : ''}`} style={{ color: unread ? 'var(--crm-text)' : 'var(--crm-muted)' }}>{last ? `${last.direction === 'out' ? `${last.automated ? h.assistant : h.agentReply}: ` : ''}${last.text}` : option(r, 'estado')}</span>
       <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--crm-muted)' }}>{option(r, 'estado')}{last ? ` · ${last.time}` : ''}</span></span>
      {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'var(--crm-primary)' }} aria-label={h.needsReply} />}
     </button></li>; })}
    {!shown.length && <li className="p-4 text-sm" style={{ color: 'var(--crm-muted)' }}>{h.emptyInbox}</li>}
   </ul>
  </aside>
  {current ? <Thread record={current} blueprint={blueprint} appId={appId} readOnly={readOnly} option={option} onBack={() => setActive(null)} onOpenRecord={onOpenRecord}
   context={<ContextPanel inline record={current} records={records} language={language} titleOf={titleOf} option={option} onOpenRecord={onOpenRecord} onOpenProperty={onOpenProperty} onMatcher={onMatcher} />} /> : <div className="hidden place-items-center p-8 text-center md:grid"><div><MessageCircle aria-hidden="true" className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--crm-primary)' }} /><p className="font-semibold">{h.noConversation}</p></div></div>}
  {current && <ContextPanel record={current} records={records} language={language} titleOf={titleOf} option={option} onOpenRecord={onOpenRecord} onOpenProperty={onOpenProperty} onMatcher={onMatcher} />}
 </div>;
}

function Thread({ record, blueprint, appId, readOnly, option, context, onBack, onOpenRecord }: { record: AppRecord; blueprint: Blueprint; appId?: string; readOnly: boolean; option: (r: AppRecord, k: string) => string; context: ReactNode; onBack: () => void; onOpenRecord: (id: string) => void }) {
 const h = useHubText(); const t = usePropertyFeedText();
 const bubbles = parseTranscript(record.data.transcripcion);
 const name = str(record.data.nombre) || str(record.data.usuario) || t.unnamed;
 const link = /^https:\/\//.test(str(record.data.enlace)) ? str(record.data.enlace) : '';
 const entity = blueprint.entities.find(e => e.key === record.entity);
 const channel = channelOf(record);
 return <section className="flex min-h-0 flex-col" aria-label={name}>
  <header className="flex items-center gap-2 border-b px-3 py-2.5" style={border}>
   <button type="button" onClick={onBack} aria-label={h.back} className="grid h-11 w-11 place-items-center rounded-full md:hidden"><ArrowLeft className="h-5 w-5" /></button>
   <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{str(record.data.usuario)} · {h.channel[channel]} · {option(record, 'estado')}</p></div>
   <button type="button" onClick={() => onOpenRecord(record.id)} aria-label={h.openRecord} title={h.openRecord} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--crm-soft)]"><ExternalLink className="h-4 w-4" /></button>
  </header>
  <details className="border-b px-3 xl:hidden" style={border}><summary className="min-h-10 cursor-pointer py-2.5 text-sm font-semibold">{h.contact}</summary>{context}</details>
  <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-5" style={{ background: 'var(--crm-bg)' }}>
   {bubbles.map((b, i) => <li key={i} className={`flex ${b.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
    <div className="max-w-[78%]">
     {b.automated && (i === 0 || !bubbles[i - 1].automated) && <p className="mb-0.5 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}><Sparkles aria-hidden="true" className="mr-1 inline h-3 w-3" />{h.automated}</p>}
     <p className={`whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-sm ${b.direction === 'out' ? 'rounded-br-md' : 'rounded-bl-md'}`}
      style={b.direction === 'out' ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : b.note ? { background: 'var(--crm-surface)', border: '1px dashed var(--crm-border)', fontStyle: 'italic' } : { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      title={b.note ? h.triggeredBy : undefined}>{b.text}</p>
     <p className={`mt-0.5 text-[10px] ${b.direction === 'out' ? 'text-right' : ''}`} style={{ color: 'var(--crm-muted)' }}>{b.time}</p>
    </div>
   </li>)}
   {!bubbles.length && <li className="text-center text-sm" style={{ color: 'var(--crm-muted)' }}>{str(record.data.resumen) || h.emptyInbox}</li>}
  </ol>
  <div className="border-t p-3" style={border}>
   <div className="flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs" style={{ ...border, background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>
    <Lock aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 basis-48">{h.replyDisabled}</span>
    {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 font-semibold" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}><Instagram className="h-3.5 w-3.5" />{h.openOriginal}</a>}
   </div>
   <details className="mt-2"><summary className="min-h-9 cursor-pointer py-2 text-sm font-semibold">{h.internalNotes}</summary>
    {entity && <RecordActivity appId={appId} record={record} entity={entity} readOnly={readOnly} />}
   </details>
  </div>
 </section>;
}

function ContextPanel({ inline, record, records, language, titleOf, option, onOpenRecord, onOpenProperty, onMatcher }: {
 inline?: boolean; record: AppRecord; records: AppRecord[]; language: string; titleOf: (id: string) => string | undefined; option: (r: AppRecord, k: string) => string;
 onOpenRecord: (id: string) => void; onOpenProperty: (id: string) => void; onMatcher: (id: string) => void;
}) {
 const h = useHubText(); const t = usePropertyFeedText();
 const contact = records.find(r => r.id === record.data.contacto);
 const property = records.find(r => r.id === record.data.inmueble);
 const links = contactLinks(contact ?? record);
 const budget = record.data.presupuesto ?? contact?.data.presupuesto;
 const currency = (contact && currencyCode(contact)) || (property && currencyCode(property)) || '';
 const agent = typeof contact?.data.agente === 'string' ? titleOf(contact.data.agente) : undefined;
 const facts: [string, string][] = [
  [h.lookingFor, option(record, 'interes')], [h.budget, money(budget, currency, language, t.currency)], [h.areas, str(record.data.zona) || str(contact?.data.zonas)],
  [h.timeframe, option(record, 'plazo')], [h.dates, str(record.data.fechas)], [h.guests, typeof record.data.huespedes === 'number' ? String(record.data.huespedes) : ''],
  [h.status, option(record, 'estado')], [h.assistantScore, typeof record.data.puntuacion === 'number' ? `${record.data.puntuacion}/100` : ''],
  [h.agent, agent ?? ''], [h.nextAction, str(contact?.data.proxima_accion)],
 ];
 const btn = 'inline-flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium transition hover:bg-[var(--crm-soft)]';
 return <aside className={inline ? 'pb-4' : 'hidden min-h-0 overflow-y-auto border-l p-4 xl:block'} style={border} aria-label={h.contact}>
  <p className="text-[11px] font-semibold uppercase tracking-[.16em]" style={{ color: 'var(--crm-muted)' }}>{h.contact}</p>
  <p className="mt-1 text-lg font-semibold">{contact ? titleOf(contact.id) ?? t.unnamed : str(record.data.nombre) || str(record.data.usuario)}</p>
  {!contact && <p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{h.noContact}</p>}
  <div className="mt-3 space-y-1.5 text-sm">
   {links.phone && <a href={`tel:${links.phone}`} className="flex min-h-9 items-center gap-2 hover:underline"><Phone className="h-4 w-4" />{links.phone}</a>}
   {links.email && <a href={`mailto:${encodeURIComponent(links.email)}`} className="flex min-h-9 items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 shrink-0" />{links.email}</a>}
  </div>
  <dl className="mt-4 space-y-2 text-sm">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt style={{ color: 'var(--crm-muted)' }}>{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>
  {str(record.data.resumen) && <p className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'var(--crm-bg)' }}>{str(record.data.resumen)}</p>}
  <div className="mt-4 space-y-2">
   {property && <button type="button" className={btn} style={border} onClick={() => onOpenProperty(property.id)}><Building2 className="h-4 w-4" /><span className="min-w-0 flex-1 truncate text-left">{h.interestedIn}: {titleOf(property.id) ?? t.untitled}</span></button>}
   {contact && <button type="button" className={btn} style={{ ...border, background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }} onClick={() => onMatcher(contact.id)}><Heart className="h-4 w-4" />{h.findMatches}</button>}
   {contact && <button type="button" className={btn} style={border} onClick={() => onOpenRecord(contact.id)}>{h.openContact}</button>}
  </div>
 </aside>;
}
