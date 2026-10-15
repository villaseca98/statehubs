import { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { isProperty, linkedToProperty, propertyCategory, recordLabel } from '@/lib/crm/propertyFeed';
import type { PropertyDeal, PropertyMarket } from '@/lib/crm/propertyFeed';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useI18n } from '@/i18n';
import { PropertyGallery } from './PropertyGallery';
import { PropertyLeads } from './PropertyLeads';
import { RecordActivity } from './RecordActivity';

const button = 'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-40';
const border = { borderColor: 'var(--crm-border)' };
type Props = { records: AppRecord[]; blueprint: Blueprint; appId?: string; onOpen: (record: AppRecord) => void; onDelete?: (id: string) => void; onMatch?: (record: AppRecord) => void; readOnly?: boolean; canDelete?: boolean };

function PropertyCard({ item, records, blueprint, appId, onOpen, onDelete, onMatch, readOnly, canDelete, onNavigate }: Props & { item: AppRecord; onNavigate: (step: number) => void }) {
 const t = usePropertyFeedText();
 const { language } = useI18n();
 const [tab, setTab] = useState<'details' | 'leads' | 'activity' | 'bookings'>('details');
 const title = recordLabel(item, blueprint, t.untitled);
 const holiday = propertyCategory(item).market === 'holiday-rentals';
 const linked = records.filter(r => linkedToProperty(r, item, blueprint) && (holiday ? /^(reserva|reservas|booking|bookings|reservation|reservations)$/i : /^(cita_inmo|visita|viewing|appointment)$/i).test(r.entity));
 const entity = blueprint.entities.find(e => e.key === item.entity);
 const amount = holiday ? item.data.precio_noche ?? item.data.nightly_price : item.data.precio ?? item.data.price ?? item.data.list_price;
 const currency = String(item.data.currency || item.data.moneda || '').toUpperCase();
 let price = t.price;
 if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
  try { price = `${new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)}${holiday ? ` ${t.night}` : ''}`; }
  catch { price = `${new Intl.NumberFormat(language).format(amount)} · ${t.currency}`; }
 }
 const location = String(item.data.ubicacion || item.data.location || item.data.zona || item.data.ciudad || item.data.city || '');
 return <>
  <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
   <details className="relative" onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label={t.actions} className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border text-xl" style={border}>···</summary>
    <div className="absolute left-0 top-12 z-20 w-52 rounded-xl border p-1 shadow-xl" style={{ ...border, background: 'var(--crm-surface)' }}>
     <button type="button" onClick={() => onOpen(item)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm"><Pencil className="h-4 w-4" />{readOnly ? t.view : t.edit}</button>
     {!readOnly && canDelete && onDelete && <button type="button" onClick={() => { if (window.confirm(t.confirm)) onDelete(item.id); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-red-600"><Trash2 className="h-4 w-4" />{t.delete}</button>}
    </div>
   </details>
   <h2 className="min-w-0 flex-1 truncate text-right text-sm font-semibold">{title}</h2>
   {item.is_sample && <span className="text-xs" style={{ color: 'var(--crm-muted)' }}>{t.sample}</span>}
  </div>
  <PropertyGallery key={item.id} record={item} title={title} onPropertySwipe={onNavigate} />
  <div className="space-y-4 px-4 py-4 sm:px-5">
   <div className="flex flex-wrap items-start justify-between gap-2">
    {location && <p className="flex min-w-0 items-center gap-1 text-sm" style={{ color: 'var(--crm-muted)' }}><MapPin className="h-4 w-4 shrink-0" /><span className="break-words">{location}</span></p>}
    <p className="break-words font-semibold tabular-nums">{price}</p>
   </div>
   <div role="group" aria-label={t.detailsLabel} className="grid grid-cols-4 gap-1 border-b pb-3" style={border}>
    {(['details', 'leads', 'activity', 'bookings'] as const).map(key => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}
     className="min-h-11 min-w-0 rounded-xl px-1 py-2 text-xs font-semibold sm:text-sm" style={{ background: tab === key ? 'var(--crm-bg)' : 'transparent' }}>{key === 'bookings' && !holiday ? t.viewings : t[key]}</button>)}
   </div>
   <div className="min-h-24 text-sm">
    {tab === 'details' && <div className="space-y-4"><p className="whitespace-pre-wrap break-words">{String(item.data.descripcion || item.data.description || t.description)}</p>
     <dl className="flex flex-wrap gap-x-6 gap-y-3">{([
      [t.beds, item.data.habitaciones ?? item.data.bedrooms], [t.baths, item.data.banos ?? item.data.bathrooms],
      [t.area, item.data.metros ?? item.data.area_sqm], [t.status, item.data.estado ?? item.data.status],
     ] as const).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => <div key={label}><dt className="text-xs" style={{ color: 'var(--crm-muted)' }}>{label}</dt><dd className="mt-1 font-medium">{String(value)}</dd></div>)}</dl>
    </div>}
    {tab === 'leads' && <PropertyLeads property={item} records={records} blueprint={blueprint} onOpen={onOpen} onMatch={onMatch ? () => onMatch(item) : undefined} />}
    {tab === 'activity' && <><p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{t.internal}</p>{entity && <RecordActivity appId={appId} record={item} entity={entity} readOnly={!!readOnly} />}</>}
    {tab === 'bookings' && <div className="space-y-2">{linked.length ? linked.map(r => <button type="button" key={r.id} onClick={() => onOpen(r)} className={`${button} w-full text-left`} style={border}>
     <span className="block break-words font-semibold">{recordLabel(r, blueprint, holiday ? t.bookings : t.viewings)}</span>
     <span className="mt-1 block break-words text-xs">{String(r.data.entrada || r.data.check_in || r.data.cuando || r.data.start_date || t.dateMissing)}{holiday && (r.data.salida || r.data.check_out) ? ` → ${String(r.data.salida || r.data.check_out)}` : ''}</span>
    </button>) : <p>{holiday ? t.noBookings : t.noViewings}</p>}</div>}
   </div>
   <button type="button" onClick={() => onOpen(item)} className={`${button} w-full`} style={border}>{t.open}</button>
  </div>
 </>;
}

export function PropertyFeed(props: Props) {
 const t = usePropertyFeedText();
 const [market, setMarket] = useState<PropertyMarket>('real-estate');
 const [deal, setDeal] = useState<PropertyDeal>('sale');
 const [selected, setSelected] = useState<string | null>(null);
 const properties = props.records.filter(r => isProperty(r.entity));
 const visible = properties.filter(r => { const c = propertyCategory(r); return c.market === market && (market !== 'real-estate' || c.deal === deal); });
 const index = Math.max(0, visible.findIndex(r => r.id === selected));
 const item = visible[index];
 const uncategorized = properties.filter(r => propertyCategory(r).market === 'uncategorized').length;
 return <div className="mx-auto w-full max-w-2xl space-y-4">
  <div role="group" aria-label={t.categories} className="grid grid-cols-2 gap-2 rounded-2xl border p-1.5" style={{ ...border, background: 'var(--crm-surface)' }}>
   {(['real-estate', 'holiday-rentals'] as const).map(key => <button key={key} type="button" aria-pressed={market === key} onClick={() => { setMarket(key); setSelected(null); }} className="min-h-12 rounded-xl px-2 py-2 text-sm font-semibold" style={{ background: market === key ? 'var(--crm-primary)' : 'transparent', color: market === key ? 'var(--crm-primary-text)' : 'var(--crm-text)' }}>{key === 'real-estate' ? t.real : t.holiday} <span className="text-xs opacity-70">({properties.filter(r => propertyCategory(r).market === key).length})</span></button>)}
  </div>
  {market === 'real-estate' && <div role="group" aria-label={t.transaction} className="flex justify-center gap-2">{(['sale', 'rent'] as const).map(key => <button key={key} type="button" aria-pressed={deal === key} onClick={() => { setDeal(key); setSelected(null); }} className={button} style={{ ...border, background: deal === key ? 'var(--crm-surface)' : 'transparent' }}>{t[key]} ({properties.filter(r => propertyCategory(r).deal === key).length})</button>)}</div>}
  {uncategorized > 0 && <button type="button" aria-pressed={market === 'uncategorized'} onClick={() => { setMarket('uncategorized'); setSelected(null); }} className="min-h-11 text-xs underline" style={{ color: 'var(--crm-muted)' }}>{t.uncategorized} ({uncategorized})</button>}
  {item ? <section aria-label={t.feed} className="overflow-hidden rounded-3xl border" style={{ ...border, background: 'var(--crm-surface)' }}>
   <PropertyCard key={item.id} {...props} item={item} onNavigate={step => { const next = visible[index + step]; if (next) setSelected(next.id); }} />
   <div className="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5" style={border}>
    <button type="button" aria-label={t.previous} disabled={index === 0} onClick={() => setSelected(visible[index - 1].id)} className={button} style={border}><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button>
    <span role="status" className="text-xs tabular-nums" style={{ color: 'var(--crm-muted)' }}>{index + 1} / {visible.length}</span>
    <button type="button" aria-label={t.next} disabled={index === visible.length - 1} onClick={() => setSelected(visible[index + 1].id)} className={button} style={border}><ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
   </div>
  </section> : <section className="rounded-3xl border p-6 text-center" style={border}><Building2 aria-hidden="true" className="mx-auto mb-3 h-7 w-7" /><h2 className="font-semibold">{t.empty}</h2><p className="mt-2 text-sm" style={{ color: 'var(--crm-muted)' }}>{t.emptyHelp}</p></section>}
 </div>;
}
