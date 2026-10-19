import { useMemo, useState } from 'react';
import { CalendarPlus, Heart, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Sparkles, X } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { bookingFrom, bookingTo, dealCommission, isCancelled, propertyHub, viewingAt, viewingConfirmed } from '@/lib/crm/propertyHub';
import { explicitlyQualified, recordLabel } from '@/lib/crm/propertyFeed';
import { contactLinks, currencyCode, money, propertyLocation, propertyPrice, shortDate } from '@/lib/crm/propertyFormat';
import { parseTranscript } from '@/lib/crm/conversations';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useHubText } from '@/i18n/hub';
import { useI18n } from '@/i18n';
import { PropertyGallery } from './PropertyGallery';
import { RecordActivity } from './RecordActivity';
import { useRuntime } from './runtimeContext';
import type { HubTab } from './PropertyCard';

const pill = 'min-h-11 shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition';
const ghost = 'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition hover:bg-[var(--crm-soft)] disabled:opacity-40';
const row = 'flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition hover:bg-[var(--crm-soft)]';
const border = { borderColor: 'var(--crm-border)' };
const label = (blueprint: Blueprint, r: AppRecord, key: string) => {
 const field = blueprint.entities.find(e => e.key === r.entity)?.fields.find(f => f.key === key);
 const v = r.data[key];
 return field?.options?.find(o => o.value === v)?.label ?? (typeof v === 'string' ? v : '');
};

/** The mini-CRM of one property. It reads the shared records, so a change anywhere shows up here and vice versa. */
export function PropertyHub({ property, records, blueprint, appId, readOnly, initialTab = 'overview', titleOf, onClose, onOpenRecord, onCreate, onMatcher, onOpenConversation }: {
 property: AppRecord; records: AppRecord[]; blueprint: Blueprint; appId?: string; readOnly: boolean; initialTab?: HubTab;
 titleOf: (id: string) => string | undefined; onClose: () => void; onOpenRecord: (id: string) => void;
 onCreate: (entity: string, data: Record<string, unknown>) => void; onMatcher: (id: string) => void; onOpenConversation: (id: string) => void;
}) {
 const t = usePropertyFeedText(); const h = useHubText(); const { language } = useI18n(); const runtime = useRuntime();
 const hub = useMemo(() => propertyHub(property, records, blueprint), [property, records, blueprint]);
 const [tab, setTab] = useState<HubTab>(initialTab);
 const [leadGroup, setLeadGroup] = useState<'qualified' | 'potential' | 'fresh' | 'discarded'>(hub.leads.qualified.length ? 'qualified' : 'potential');
 const [form, setForm] = useState(initialTab === 'viewings' && !readOnly);
 const [when, setWhen] = useState(''); const [who, setWho] = useState(''); const [busy, setBusy] = useState(false);
 const [notice, setNotice] = useState(''); const [error, setError] = useState('');
 const title = recordLabel(property, blueprint, t.untitled);
 const entity = blueprint.entities.find(e => e.key === property.entity);
 const hasViewings = blueprint.entities.some(e => e.key === 'cita_inmo');
 const hasBookings = blueprint.entities.some(e => e.key === 'reserva');
 const hasDeals = blueprint.entities.some(e => e.key === 'operacion');
 const currency = currencyCode(property);
 const leads = hub.leads.qualified.length + hub.leads.potential.length;
 const contacts = [...hub.leads.qualified, ...hub.leads.potential];
 const allContacts = records.filter(r => r.entity === 'contacto_inmo' && r.data.crm_archived !== true && Boolean(r.is_sample) === Boolean(property.is_sample));
 const tabs: [HubTab, string, number | null][] = [
  ['overview', h.overview, null], ['leads', h.leads, leads], ['conversations', h.conversations, hub.conversations.length],
  ['viewings', hub.holiday ? h.bookings : h.viewings, hub.holiday ? hub.bookings.upcoming.length : hub.viewings.upcoming.length],
  ...(!hub.holiday && hasDeals ? [['deals', h.deals, hub.deals.open.length] as [HubTab, string, number]] : []), ['activity', h.activity, null],
 ];
 const schedule = async (e: React.FormEvent) => {
  e.preventDefault(); if (!runtime || readOnly || busy || !when) return;
  setBusy(true); setError(''); setNotice('');
  try {
   const created = await runtime.createQuietly('cita_inmo', { titulo: `${h.viewings} · ${title}`, tipo: 'visita', cuando: when, inmueble: property.id, ...(who ? { contacto: who } : {}), resultado: 'pendiente' });
   if (!created) throw new Error(h.error);
   setNotice(h.scheduled); setForm(false); setWhen(''); setWho('');
  } catch (err) { setError(err instanceof Error ? err.message : h.error); } finally { setBusy(false); }
 };
 const kpis: [string, number, HubTab][] = [[h.kpiLeads, leads, 'leads'], [h.kpiQualified, hub.leads.qualified.length, 'leads'], [h.kpiConversations, hub.conversations.length, 'conversations'],
  hub.holiday ? [h.kpiBookings, hub.bookings.upcoming.length, 'viewings'] : [h.kpiViewings, hub.viewings.upcoming.length, 'viewings'], ...(!hub.holiday && hasDeals ? [[h.kpiDeals, hub.deals.open.length, 'deals'] as [string, number, HubTab]] : [])];
 const groups = { qualified: hub.leads.qualified, potential: hub.leads.potential, fresh: hub.leads.fresh, discarded: hub.leads.discarded };

 return <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)' }}>
  <header className="flex items-start gap-3 border-b px-4 py-3 md:px-6" style={{ ...border, background: 'var(--crm-surface)' }}>
   <div className="min-w-0 flex-1">
    <p className="text-[11px] font-semibold uppercase tracking-[.16em]" style={{ color: 'var(--crm-primary)' }}>{h.hub}</p>
    <h2 className="truncate text-xl font-semibold md:text-2xl">{title}</h2>
    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--crm-muted)' }}>
     {propertyLocation(property) && <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />{propertyLocation(property)}</span>}
     <span className="font-semibold tabular-nums" style={{ color: 'var(--crm-text)' }}>{propertyPrice(property, language, t) || t.price}</span>
     {label(blueprint, property, 'estado') && <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--crm-soft)' }}>{label(blueprint, property, 'estado')}</span>}
    </p>
   </div>
   <div className="flex shrink-0 items-center gap-1">
    {!hub.holiday && <button type="button" aria-label={h.matcher} onClick={() => onMatcher(property.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}><Heart className="h-4 w-4" /><span className="hidden sm:inline">{h.matcher}</span></button>}
    <button type="button" onClick={() => onOpenRecord(property.id)} aria-label={readOnly ? t.view : h.editRecord} title={readOnly ? t.view : h.editRecord} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--crm-soft)]"><Pencil className="h-4 w-4" /></button>
    <button type="button" onClick={onClose} aria-label={h.close} title={h.close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--crm-soft)]"><X className="h-5 w-5" /></button>
   </div>
  </header>
  <nav aria-label={h.hub} className="sh-scroll-x flex gap-1 border-b px-3 py-2 md:px-5" style={{ ...border, background: 'var(--crm-surface)' }}>
   {tabs.map(([key, name, count]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={pill}
    style={tab === key ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { color: 'var(--crm-muted)' }}>{name}{count !== null && <span className="ml-1.5 tabular-nums opacity-80">{count}</span>}</button>)}
  </nav>
  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
   {readOnly && <p className="mb-4 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--crm-soft)' }}>{h.noPermission}</p>}
   {notice && <p role="status" className="mb-4 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--crm-soft)' }}>{notice}</p>}
   {error && <p role="alert" className="mb-4 rounded-xl px-3 py-2 text-sm text-red-700" style={{ background: 'var(--crm-soft)' }}>{error}</p>}

   {tab === 'overview' && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <div className="overflow-hidden rounded-[22px] border" style={border}><PropertyGallery key={property.id} record={property} title={title} /></div>
    <div className="space-y-4">
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{kpis.map(([name, value, target]) => <button key={name} type="button" onClick={() => setTab(target)} className="rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 motion-reduce:transform-none" style={{ ...border, background: 'var(--crm-surface)' }}>
      <span className="block text-2xl font-semibold tabular-nums">{value}</span><span className="text-xs" style={{ color: 'var(--crm-muted)' }}>{name}</span></button>)}</div>
     <section className="rounded-2xl border p-4" style={{ ...border, background: 'var(--crm-surface)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}>{h.nextAction}</h3>
      {hub.next ? <button type="button" onClick={() => onOpenRecord(hub.next!.record.id)} className="mt-2 text-left text-sm font-semibold underline-offset-4 hover:underline">{hub.next.kind === 'viewing' ? h.nextViewing : h.nextBooking}: {shortDate(hub.next.at, language)} · {titleOf(hub.next.record.id) ?? ''}</button> : <p className="mt-2 text-sm">{h.noUpcoming}</p>}
      <p className="mt-3 text-sm"><span style={{ color: 'var(--crm-muted)' }}>{h.agent}: </span>{hub.agentId ? titleOf(hub.agentId) ?? h.noAgent : h.noAgent}</p>
     </section>
     <section className="rounded-2xl border p-4" style={{ ...border, background: 'var(--crm-surface)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}>{h.facts}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{(['tipo', 'operacion', 'habitaciones', 'banos', 'metros', 'capacidad', 'referencia', 'licencia'] as const).filter(k => property.data[k] !== undefined && property.data[k] !== null && property.data[k] !== '').map(k => <div key={k} className="min-w-0"><dt className="text-xs" style={{ color: 'var(--crm-muted)' }}>{entity?.fields.find(f => f.key === k)?.label ?? k}</dt><dd className="truncate font-medium">{label(blueprint, property, k) || String(property.data[k])}</dd></div>)}</dl>
      {typeof (property.data.notas ?? property.data.descripcion ?? property.data.description) === 'string' && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{String(property.data.descripcion ?? property.data.description ?? property.data.notas)}</p>}
     </section>
    </div>
   </div>}

   {tab === 'leads' && <div className="space-y-3">
    <div role="group" aria-label={h.leads} className="sh-scroll-x flex gap-1 rounded-full p-1" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
     {(['qualified', 'potential', 'fresh', 'discarded'] as const).map(key => <button key={key} type="button" aria-pressed={leadGroup === key} onClick={() => setLeadGroup(key)} className={`${pill} flex-1`} style={leadGroup === key ? { background: 'var(--crm-soft)', color: 'var(--crm-text)' } : { color: 'var(--crm-muted)' }}>{h[key]} <span className="tabular-nums">{groups[key].length}</span></button>)}
    </div>
    {!groups[leadGroup].length && <p className="rounded-2xl p-5 text-sm" style={{ background: 'var(--crm-surface)' }}>{h.noLeadsHere}</p>}
    <ul className="space-y-2">{groups[leadGroup].map(c => { const links = contactLinks(c); return <li key={c.id} className="rounded-2xl border p-3" style={{ ...border, background: 'var(--crm-surface)' }}>
     <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onOpenRecord(c.id)} className="min-h-11 min-w-0 flex-1 truncate text-left font-semibold hover:underline">{recordLabel(c, blueprint, t.unnamed)}</button>
      {explicitlyQualified(c) && <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--crm-soft)', color: 'var(--crm-primary)' }}>{h.qualified}</span>}
      {label(blueprint, c, 'temperatura') && <span className="rounded-full border px-2 py-0.5 text-xs" style={border}>{label(blueprint, c, 'temperatura')}</span>}
     </div>
     <p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{[label(blueprint, c, 'origen'), typeof c.data.presupuesto === 'number' ? money(c.data.presupuesto, currencyCode(c) || currency, language, t.currency) : '', typeof c.data.zonas === 'string' ? c.data.zonas : ''].filter(Boolean).join(' · ')}</p>
     <div className="mt-2 flex flex-wrap gap-1.5">
      {links.phone && <a className={ghost} style={border} href={`tel:${links.phone}`}><Phone className="h-4 w-4" />{h.call}</a>}
      {links.email && <a className={ghost} style={border} href={`mailto:${encodeURIComponent(links.email)}`}><Mail className="h-4 w-4" />{h.email}</a>}
      {links.whatsapp && <a className={ghost} style={border} href={links.whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />{h.whatsapp}</a>}
      {leadGroup !== 'discarded' && <button type="button" className={ghost} style={border} onClick={() => onMatcher(c.id)}><Sparkles className="h-4 w-4" />{h.findMatches}</button>}
     </div>
    </li>; })}</ul>
   </div>}

   {tab === 'conversations' && <div className="space-y-2">
    {!hub.conversations.length && <p className="rounded-2xl p-5 text-sm" style={{ background: 'var(--crm-surface)' }}>{h.noConversations}</p>}
    {hub.conversations.map(c => { const last = parseTranscript(c.data.transcripcion).at(-1); return <button key={c.id} type="button" onClick={() => onOpenConversation(c.id)} className={row} style={{ ...border, background: 'var(--crm-surface)' }}>
     <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: 'var(--crm-primary)' }} />
     <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{String(c.data.nombre || c.data.usuario || t.unnamed)}</span><span className="block truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{last ? `${last.automated ? `${h.assistant}: ` : ''}${last.text}` : label(blueprint, c, 'estado')}</span></span>
     <span className="shrink-0 text-xs" style={{ color: 'var(--crm-muted)' }}>{h.openInbox}</span>
    </button>; })}
   </div>}

   {tab === 'viewings' && <div className="space-y-4">
    {!hub.holiday && (hasViewings ? !readOnly && (form ? <form onSubmit={schedule} className="space-y-3 rounded-2xl border p-4" style={{ ...border, background: 'var(--crm-surface)' }}>
     <label className="block text-sm font-medium">{h.when}<input required autoFocus type="datetime-local" value={when} disabled={busy} onChange={e => setWhen(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border px-3" style={{ ...border, background: 'var(--crm-bg)' }} /></label>
     <label className="block text-sm font-medium">{h.who}<select value={who} disabled={busy} onChange={e => setWho(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border px-3" style={{ ...border, background: 'var(--crm-bg)' }}><option value="">{h.chooseContact}</option>{[...contacts, ...allContacts.filter(c => !contacts.includes(c))].map(c => <option key={c.id} value={c.id}>{recordLabel(c, blueprint, t.unnamed)}</option>)}</select></label>
     <div className="flex gap-2"><button disabled={busy || !when} className="min-h-11 rounded-full px-5 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>{h.create}</button><button type="button" onClick={() => setForm(false)} className={ghost} style={border}>{h.cancel}</button></div>
    </form> : <button type="button" onClick={() => { setForm(true); setNotice(''); }} className={ghost} style={border}><CalendarPlus className="h-4 w-4" />{h.schedule}</button>) : <p className="text-sm">{h.unavailable}</p>)}
    {hub.holiday && hasBookings && !readOnly && <button type="button" onClick={() => onCreate('reserva', { alojamiento: property.id, estado: 'pendiente' })} className={ghost} style={border}><Plus className="h-4 w-4" />{h.addBooking}</button>}
    {(['upcoming', 'past'] as const).map(when => { const list = hub.holiday ? hub.bookings[when] : hub.viewings[when]; return <section key={when}>
     <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}>{h[when]}</h3>
     {!list.length ? <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>{hub.holiday ? h.noBookings : h.noViewings}</p> : <ul className="space-y-2">{list.map(r => <li key={r.id}><button type="button" onClick={() => onOpenRecord(r.id)} className={row} style={{ ...border, background: 'var(--crm-surface)' }}>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{recordLabel(r, blueprint, hub.holiday ? h.bookings : h.viewings)}</span>
       <span className="block text-xs" style={{ color: 'var(--crm-muted)' }}>{hub.holiday ? `${bookingFrom(r) || t.dateMissing} → ${bookingTo(r) || '?'}` : shortDate(viewingAt(r), language) || t.dateMissing}{typeof r.data.contacto === 'string' && titleOf(r.data.contacto) ? ` · ${titleOf(r.data.contacto)}` : ''}</span></span>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--crm-soft)' }}>{isCancelled(r) ? h.cancelled : hub.holiday ? label(blueprint, r, 'estado') || h.requested : viewingConfirmed(r) ? h.confirmed : h.requested}</span>
     </button></li>)}</ul>}
    </section>; })}
   </div>}

   {tab === 'deals' && <div className="space-y-4">
    {!readOnly && <button type="button" onClick={() => onCreate('operacion', { inmueble: property.id, titulo: title, etapa: 'negociacion' })} className={ghost} style={border}><Plus className="h-4 w-4" />{h.newDeal}</button>}
    {!hub.deals.open.length && !hub.deals.closed.length && <p className="rounded-2xl p-5 text-sm" style={{ background: 'var(--crm-surface)' }}>{h.noDeals}</p>}
    {([['open', h.deals], ['closed', h.closedDeals]] as const).map(([key, heading]) => hub.deals[key].length > 0 && <section key={key}>
     <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}>{heading}</h3>
     <ul className="space-y-2">{hub.deals[key].map(d => { const fee = dealCommission(d); return <li key={d.id}><button type="button" onClick={() => onOpenRecord(d.id)} className={`${row} flex-wrap`} style={{ ...border, background: 'var(--crm-surface)' }}>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{recordLabel(d, blueprint, h.deals)}</span><span className="block text-xs" style={{ color: 'var(--crm-muted)' }}>{h.stage}: {label(blueprint, d, 'etapa') || h.none}{typeof d.data.contacto === 'string' && titleOf(d.data.contacto) ? ` · ${titleOf(d.data.contacto)}` : ''}</span></span>
      <span className="text-right text-sm tabular-nums"><span className="block font-semibold">{money(d.data.importe, currency, language, t.currency) || h.none}</span>{fee !== null && <span className="block text-xs" title={h.commissionHint} style={{ color: 'var(--crm-muted)' }}>{h.commission}: {money(fee, currency, language, t.currency)}</span>}</span>
     </button></li>; })}</ul>
    </section>)}
    <p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{h.offersPending}</p>
   </div>}

   {tab === 'activity' && <>{entity && <RecordActivity appId={appId} record={property} entity={entity} readOnly={readOnly} />}</>}
  </div>
 </div>;
}
