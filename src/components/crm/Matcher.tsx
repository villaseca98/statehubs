import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, Building2, CalendarPlus, Heart, Info, Mail, MessageCircle, Phone, RotateCcw, Undo2, X } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { crmApi } from '@/lib/crm/api';
import type { MatchDecision } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { canPersistMatch, intentOf, matchProperty, matchesForRecord } from '@/lib/crm/matching';
import type { PropertyMatch } from '@/lib/crm/matching';
import { isProperty, recordLabel } from '@/lib/crm/propertyFeed';
import { contactLinks, currencyCode, legacyPhoto, money, propertyLocation, propertyPrice } from '@/lib/crm/propertyFormat';
import { criterionLabels } from '@/i18n/matching';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useHubText } from '@/i18n/hub';
import { useI18n } from '@/i18n';
import { PropertyCover } from './PropertyCover';
import { useRuntime } from './runtimeContext';

type Tab = 'suggested' | 'saved' | 'dismissed';
const key = (m: PropertyMatch) => `${m.contact.id}:${m.property.id}`;
const SWIPE = 110;
const round = 'grid place-items-center rounded-full border shadow-sm transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 motion-reduce:transform-none';

/**
 * Tinder-style review of the deterministic matches for one property (buyers
 * and tenants) or one contact (properties). Same engine and same persisted
 * decisions as the record panel, so nothing is matched twice.
 */
export function Matcher({ source, records, blueprint, appId, readOnly, onOpen, onClose }: {
 source: AppRecord; records: AppRecord[]; blueprint: Blueprint; appId?: string; readOnly: boolean; onOpen: (id: string) => void; onClose: () => void;
}) {
 const t = usePropertyFeedText(); const h = useHubText(); const { language } = useI18n(); const runtime = useRuntime(); const reduce = useReducedMotion();
 const api = appId && isLocalApp(appId) ? localCrmApi : crmApi;
 const fromProperty = isProperty(source.entity);
 const [decisions, setDecisions] = useState<MatchDecision[]>([]);
 const [loading, setLoading] = useState(!!appId); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const [tab, setTab] = useState<Tab>('suggested'); const [qualifiedOnly, setQualifiedOnly] = useState(false);
 const [skipped, setSkipped] = useState<string[]>([]); const [last, setLast] = useState<{ match: PropertyMatch; previous: MatchDecision['status'] } | null>(null);
 const [exit, setExit] = useState(0); const [viewing, setViewing] = useState(false); const [when, setWhen] = useState(''); const [notice, setNotice] = useState('');

 useEffect(() => {
  if (!appId) return; let active = true;
  setLoading(true);
  api.matchDecisions(appId).then(rows => { if (active) setDecisions(rows); }, e => { if (active) setError(e instanceof Error ? e.message : h.error); }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [appId, api, h.error]);

 const statusOf = useCallback((m: PropertyMatch) => decisions.find(d => d.contact_id === m.contact.id && d.property_id === m.property.id)?.status ?? 'suggested', [decisions]);
 const suggested = useMemo(() => {
  const list = matchesForRecord(source, records, fromProperty && qualifiedOnly).filter(m => statusOf(m) === 'suggested');
  // Skipped cards go to the back of the deck for this session only.
  return [...list.filter(m => !skipped.includes(key(m))), ...list.filter(m => skipped.includes(key(m)))];
 }, [source, records, fromProperty, qualifiedOnly, statusOf, skipped]);
 const decided = (status: 'saved' | 'dismissed') => decisions.filter(d => d.status === status && (d.contact_id === source.id || d.property_id === source.id)).flatMap(d => {
  const c = records.find(r => r.id === d.contact_id), p = records.find(r => r.id === d.property_id);
  return c && p ? [matchProperty(c, p)] : [];
 });
 const current = suggested[0];
 // Without a saved workspace (public demo) decisions live in memory and say so.
 const persistable = !readOnly && !!current && (!appId || canPersistMatch(current.contact, current.property));

 const decide = async (m: PropertyMatch, status: MatchDecision['status'], direction = 0) => {
  if (readOnly || busy) return;
  setBusy(true); setError(''); setExit(direction);
  try {
   const previous = statusOf(m);
   const d: MatchDecision = appId ? await api.setMatchDecision(m.contact.id, m.property.id, status)
    : { app_id: '', contact_id: m.contact.id, property_id: m.property.id, status, actor_id: null, updated_at: new Date().toISOString() };
   setDecisions(rows => [...rows.filter(r => r.contact_id !== d.contact_id || r.property_id !== d.property_id), d]);
   setLast({ match: m, previous }); setViewing(false); setNotice('');
  } catch (e) { setError(e instanceof Error ? e.message : h.error); } finally { setBusy(false); }
 };
 const skip = () => { if (!current) return; setExit(0); setSkipped(s => [...s.filter(k => k !== key(current)), key(current)]); setViewing(false); };
 const other = (m: PropertyMatch) => fromProperty ? m.contact : m.property;
 const schedule = async (e: React.FormEvent) => {
  e.preventDefault(); if (!current || !runtime || !when || busy) return;
  setBusy(true); setError('');
  try {
   const created = await runtime.createQuietly('cita_inmo', { titulo: `${h.viewings} · ${recordLabel(current.property, blueprint, t.untitled)}`, tipo: 'visita', cuando: when, contacto: current.contact.id, inmueble: current.property.id, resultado: 'pendiente' });
   if (!created) throw new Error(h.error);
   setNotice(h.scheduled); setViewing(false); setWhen('');
  } catch (err) { setError(err instanceof Error ? err.message : h.error); } finally { setBusy(false); }
 };

 useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
   if (tab !== 'suggested' || !current || viewing || (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))) return;
   if (e.key === 'ArrowLeft' && persistable) { e.preventDefault(); void decide(current, 'dismissed', -1); }
   else if (e.key === 'ArrowRight' && persistable) { e.preventDefault(); void decide(current, 'saved', 1); }
   else if (e.key === 'ArrowDown') { e.preventDefault(); skip(); }
   else if (e.key === 'Enter' && e.target === document.body) { e.preventDefault(); onOpen(other(current).id); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
 });

 const counts = { suggested: suggested.length, saved: decided('saved').length, dismissed: decided('dismissed').length };
 const sourceTitle = recordLabel(source, blueprint, t.untitled);
 return <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)' }}>
  <header className="flex items-start gap-3 border-b px-4 py-3 md:px-6" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
   <div className="min-w-0 flex-1">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.16em]" style={{ color: 'var(--crm-primary)' }}><Heart aria-hidden="true" className="h-3.5 w-3.5" />{h.matcherTitle}</p>
    <h2 className="truncate text-xl font-semibold">{sourceTitle}</h2>
    <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>{fromProperty ? h.matcherForProperty : h.matcherForContact}</p>
   </div>
   <button type="button" onClick={onClose} aria-label={h.close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--crm-soft)]"><X className="h-5 w-5" /></button>
  </header>
  <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
   <div role="group" aria-label={h.matcherTitle} className="flex gap-1 rounded-full p-1" style={{ background: 'var(--crm-bg)' }}>
    {([['suggested', h.toReview], ['saved', h.compatible], ['dismissed', h.dismissedTab]] as const).map(([value, name]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className="min-h-10 rounded-full px-3 text-sm font-medium" style={tab === value ? { background: 'var(--crm-surface)', boxShadow: '0 1px 4px rgba(0,0,0,.08)' } : { color: 'var(--crm-muted)' }}>{name} <span className="tabular-nums opacity-70">{counts[value]}</span></button>)}
   </div>
   {fromProperty && <label className="ml-auto flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={qualifiedOnly} onChange={e => setQualifiedOnly(e.target.checked)} style={{ accentColor: 'var(--crm-primary)' }} />{h.qualifiedOnly}</label>}
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
   {loading && <p role="status" className="text-sm">{h.loading}</p>}
   {error && <p role="alert" className="mb-3 rounded-xl px-3 py-2 text-sm text-red-700" style={{ background: 'var(--crm-soft)' }}>{error}</p>}
   {notice && <p role="status" className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--crm-soft)' }}>{notice}</p>}
   {tab === 'suggested' && !loading && <div className="mx-auto max-w-md">
    {current ? <>
     <div className="relative pb-3">
      {suggested[1] && <div aria-hidden="true" className="absolute inset-x-5 bottom-0 top-6 rounded-[28px] border" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)', opacity: .7 }} />}
      <AnimatePresence initial={false} custom={exit} mode="popLayout">
       <motion.article key={key(current)} custom={exit} aria-label={recordLabel(other(current), blueprint, t.untitled)}
        drag={persistable && !reduce ? 'x' : false} dragSnapToOrigin dragElastic={0.6}
        onDragEnd={(_, info) => { if (info.offset.x > SWIPE) void decide(current, 'saved', 1); else if (info.offset.x < -SWIPE) void decide(current, 'dismissed', -1); }}
        initial={reduce ? false : { opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0, x: 0, rotate: 0 }}
        variants={{ gone: (d: number) => reduce ? { opacity: 0 } : { opacity: 0, x: d * 360, rotate: d * 12, transition: { duration: .28 } } }} exit="gone"
        whileDrag={{ rotate: 0, cursor: 'grabbing' }}
        className="relative cursor-grab touch-pan-y overflow-hidden rounded-[28px] border shadow-[0_24px_60px_rgba(18,40,30,.18)]" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
        <MatchCard match={current} fromProperty={fromProperty} blueprint={blueprint} language={language} />
       </motion.article>
      </AnimatePresence>
     </div>
     <div className="mt-5 flex items-center justify-center gap-3" role="group" aria-label={h.matcherTitle}>
      <button type="button" aria-label={h.discard} title={`${h.discard} (←)`} disabled={!persistable || busy} onClick={() => void decide(current, 'dismissed', -1)} className={`${round} h-14 w-14`} style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)', color: '#b42318' }}><X className="h-6 w-6" /></button>
      <button type="button" aria-label={h.later} title={`${h.later} (↓)`} disabled={busy || suggested.length < 2} onClick={skip} className={`${round} h-11 w-11`} style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}><ArrowDown className="h-5 w-5" /></button>
      <button type="button" aria-label={h.openProfile} title={`${h.openProfile} (Enter)`} onClick={() => onOpen(other(current).id)} className={`${round} h-11 w-11`} style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}><Info className="h-5 w-5" /></button>
      <button type="button" aria-label={h.markCompatible} title={`${h.markCompatible} (→)`} disabled={!persistable || busy} onClick={() => void decide(current, 'saved', 1)} className={`${round} h-14 w-14`} style={{ borderColor: 'transparent', background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}><Heart className="h-6 w-6" /></button>
     </div>
     <div className="mt-4 flex flex-wrap justify-center gap-2">
      <ContactActions contact={current.contact} />
      {!readOnly && runtime && blueprint.entities.some(e => e.key === 'cita_inmo') && current.contact.entity === 'contacto_inmo' && current.score !== null && <button type="button" onClick={() => { setViewing(v => !v); setNotice(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm" style={{ borderColor: 'var(--crm-border)' }}><CalendarPlus className="h-4 w-4" />{h.schedule}</button>}
      {last && !readOnly && <button type="button" disabled={busy} onClick={() => { void decide(last.match, last.previous); setLast(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm" style={{ borderColor: 'var(--crm-border)' }}><Undo2 className="h-4 w-4" />{h.undo}</button>}
     </div>
     {viewing && <form onSubmit={schedule} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border p-3" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
      <label className="min-w-0 flex-1 text-sm">{h.when}<input required autoFocus type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border px-3" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-bg)' }} /></label>
      <button disabled={busy || !when} className="min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>{h.create}</button>
     </form>}
     <p className="mt-4 text-center text-xs" style={{ color: 'var(--crm-muted)' }}>{h.deckPosition(1, suggested.length)} · {h.keyboard}</p>
     {!readOnly && (appId ? !persistable : true) && <p className="mt-2 text-center text-xs" style={{ color: 'var(--crm-muted)' }}>{appId ? h.notPersisted : h.demoDecisions}</p>}
    </> : <div className="rounded-[28px] border p-8 text-center" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}><Heart aria-hidden="true" className="mx-auto mb-3 h-7 w-7" style={{ color: 'var(--crm-primary)' }} /><h3 className="font-semibold">{h.empty}</h3><p className="mt-2 text-sm" style={{ color: 'var(--crm-muted)' }}>{h.emptyHelp}</p></div>}
   </div>}
   {tab !== 'suggested' && <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
    {decided(tab).map(m => <li key={key(m)} className="overflow-hidden rounded-[22px] border" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
     <MatchCard match={m} fromProperty={fromProperty} blueprint={blueprint} language={language} compact />
     <div className="flex flex-wrap gap-2 px-4 pb-4">
      <button type="button" onClick={() => onOpen(other(m).id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm" style={{ borderColor: 'var(--crm-border)' }}><Info className="h-4 w-4" />{h.openProfile}</button>
      {!readOnly && (!appId || canPersistMatch(m.contact, m.property)) && <button type="button" disabled={busy} onClick={() => void decide(m, 'suggested')} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm" style={{ borderColor: 'var(--crm-border)' }}><RotateCcw className="h-4 w-4" />{h.restore}</button>}
      {tab === 'saved' && <ContactActions contact={m.contact} />}
     </div>
    </li>)}
    {!decided(tab).length && <li className="text-sm sm:col-span-2" style={{ color: 'var(--crm-muted)' }}>{h.empty}</li>}
   </ul>}
  </div>
 </div>;
}

function ContactActions({ contact }: { contact: AppRecord }) {
 const h = useHubText(); const links = contactLinks(contact);
 const cls = 'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm';
 return <>
  {links.phone && <a className={cls} style={{ borderColor: 'var(--crm-border)' }} href={`tel:${links.phone}`}><Phone className="h-4 w-4" />{h.call}</a>}
  {links.email && <a className={cls} style={{ borderColor: 'var(--crm-border)' }} href={`mailto:${encodeURIComponent(links.email)}`}><Mail className="h-4 w-4" />{h.email}</a>}
  {links.whatsapp && <a className={cls} style={{ borderColor: 'var(--crm-border)' }} href={links.whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />{h.whatsapp}</a>}
 </>;
}

function MatchCard({ match, fromProperty, blueprint, language, compact }: { match: PropertyMatch; fromProperty: boolean; blueprint: Blueprint; language: string; compact?: boolean }) {
 const t = usePropertyFeedText(); const h = useHubText();
 const c = match.contact, p = match.property;
 const field = (r: AppRecord, k: string) => { const f = blueprint.entities.find(e => e.key === r.entity)?.fields.find(x => x.key === k); const v = r.data[k]; return f?.options?.find(o => o.value === v)?.label ?? (typeof v === 'string' ? v : ''); };
 const intent = intentOf(c.data);
 const score = <div className="flex shrink-0 flex-col items-center" title={h.scoreHelp}>
  <span className="grid h-16 w-16 place-items-center rounded-full text-lg font-bold tabular-nums" style={{ background: match.score === null ? 'var(--crm-bg)' : `conic-gradient(var(--crm-primary) ${match.score * 3.6}deg, var(--crm-soft) 0)` }}>
   <span className="grid h-12 w-12 place-items-center rounded-full text-sm" style={{ background: 'var(--crm-surface)' }}>{match.score === null ? '–' : match.score}</span></span>
  <span className="mt-1 text-[11px]" style={{ color: 'var(--crm-muted)' }}>{match.score === null ? h.needsData : h.score}</span>
 </div>;
 return <div>
  {fromProperty ? <div className="flex items-start gap-4 p-5 pb-3">
   <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold" style={{ background: 'var(--crm-soft)', color: 'var(--crm-primary)' }}>{recordLabel(c, blueprint, '?').slice(0, 1).toUpperCase()}</span>
   <div className="min-w-0 flex-1">
    <h3 className="truncate text-lg font-semibold">{recordLabel(c, blueprint, t.unnamed)}</h3>
    <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>{[intent === 'sale' ? h.buy : intent === 'rent' ? h.rent : '', field(c, 'temperatura'), field(c, 'origen')].filter(Boolean).join(' · ')}</p>
    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
     <div><dt className="text-xs" style={{ color: 'var(--crm-muted)' }}>{h.budget}</dt><dd className="font-semibold tabular-nums">{money(c.data.presupuesto ?? c.data.budget, currencyCode(c), language, t.currency) || h.none}</dd></div>
     <div className="min-w-0"><dt className="text-xs" style={{ color: 'var(--crm-muted)' }}>{h.areas}</dt><dd className="truncate font-medium">{String(c.data.zonas || c.data.preferred_areas || h.none)}</dd></div>
    </dl>
   </div>
   {score}
  </div> : <>
   <div className={`relative overflow-hidden ${compact ? 'aspect-[16/9]' : 'aspect-[4/3]'}`} style={{ background: 'var(--crm-bg)' }}>
    <PropertyCover value={p.data.statehubs_media} alt={recordLabel(p, blueprint, t.untitled)} fallback={legacyPhoto(p) ? <img src={legacyPhoto(p)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center" style={{ color: 'var(--crm-muted)' }}><Building2 className="h-10 w-10" /></div>} />
    <p className="sh-glass absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums">{propertyPrice(p, language, t) || t.price}</p>
   </div>
   <div className="flex items-start gap-4 p-5 pb-3">
    <div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold">{recordLabel(p, blueprint, t.untitled)}</h3><p className="truncate text-sm" style={{ color: 'var(--crm-muted)' }}>{propertyLocation(p)}</p></div>
    {score}
   </div>
  </>}
  {!compact && <ul className="flex flex-wrap gap-1.5 px-5 pb-5" aria-label={h.scoreHelp}>{match.reasons.map(r => <li key={r.criterion} className="rounded-full px-2.5 py-1 text-xs" style={r.state === 'match' ? { background: 'var(--crm-soft)', color: 'var(--crm-primary)' } : { background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>
   {criterionLabels[r.criterion]} · {r.state === 'match' ? h.met : r.state === 'missing' ? h.missing : h.conflict}</li>)}</ul>}
 </div>;
}
