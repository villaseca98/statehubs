import { Bath, BedDouble, Building2, CalendarClock, CalendarPlus, Heart, MapPin, MessageCircle, MoreHorizontal, Pencil, Ruler, Trash2, Users } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import type { PropertyHubData } from '@/lib/crm/propertyHub';
import { propertyCategory, recordLabel } from '@/lib/crm/propertyFeed';
import { initials, legacyPhoto, propertyLocation, propertyPrice, shortDate } from '@/lib/crm/propertyFormat';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useHubText } from '@/i18n/hub';
import { useI18n } from '@/i18n';
import { PropertyCover } from './PropertyCover';

export type HubTab = 'overview' | 'leads' | 'conversations' | 'viewings' | 'deals' | 'activity';
const iconButton = 'grid h-11 w-11 place-items-center rounded-full transition hover:bg-[var(--crm-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40';

/** One property: photo, essentials and real indicators. The card opens the mini-CRM; actions stay as discreet icons. */
export function PropertyCard({ record, blueprint, hub, agentName, readOnly, canDelete, onOpenHub, onMatcher, onEdit, onDelete }: {
 record: AppRecord; blueprint: Blueprint; hub: PropertyHubData; agentName?: string; readOnly?: boolean; canDelete?: boolean;
 onOpenHub: (tab?: HubTab) => void; onMatcher?: () => void; onEdit: () => void; onDelete?: () => void;
}) {
 const t = usePropertyFeedText(); const h = useHubText(); const { language } = useI18n();
 const title = recordLabel(record, blueprint, t.untitled);
 const entity = blueprint.entities.find(e => e.key === record.entity);
 const statusField = entity?.fields.find(f => f.key === 'estado');
 const status = statusField?.options?.find(o => o.value === record.data.estado) ?? (typeof record.data.status === 'string' && record.data.status ? { label: record.data.status } : undefined);
 const category = propertyCategory(record);
 const deal = category.market === 'holiday-rentals' ? h.shortStay : category.deal === 'sale' ? t.sale : category.deal === 'rent' ? t.rent : '';
 const price = propertyPrice(record, language, t) || t.price;
 const location = propertyLocation(record);
 const leads = hub.leads.qualified.length + hub.leads.potential.length;
 const specs = [[BedDouble, record.data.habitaciones ?? record.data.bedrooms, t.beds], [Bath, record.data.banos ?? record.data.bathrooms, t.baths], [Ruler, record.data.metros ?? record.data.area_sqm, t.area]] as const;
 const photo = legacyPhoto(record);
 const fallback = photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center" style={{ color: 'var(--crm-muted)' }}><Building2 aria-hidden="true" className="h-10 w-10" /></div>;
 return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(23,48,38,.14)] motion-reduce:transform-none" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
  <button type="button" onClick={() => onOpenHub()} aria-label={`${h.openHub}: ${title}`} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2">
   <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--crm-bg)' }}>
    <PropertyCover value={record.data.statehubs_media} alt={title} fallback={fallback} />
    <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-1.5">
     {deal && <span className="sh-glass rounded-full px-2.5 py-1 text-[11px] font-semibold">{deal}</span>}
     {status && <span className="sh-glass rounded-full px-2.5 py-1 text-[11px] font-medium">{status.label}</span>}
     {record.is_sample && <span className="sh-glass ml-auto rounded-full px-2.5 py-1 text-[11px]">{h.sample}</span>}
    </div>
    <p className="sh-glass absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums">{price}</p>
   </div>
   <div className="space-y-3 px-4 pb-2 pt-4">
    <div className="min-w-0">
     <h3 className="truncate text-[1.05em] font-semibold">{title}</h3>
     {location && <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm" style={{ color: 'var(--crm-muted)' }}><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{location}</span></p>}
    </div>
    {specs.some(([, v]) => v !== undefined && v !== null && v !== '') && <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{specs.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([Icon, v, label]) => <div key={label} className="flex items-center gap-1.5"><dt><Icon aria-hidden="true" className="h-4 w-4" style={{ color: 'var(--crm-muted)' }} /><span className="sr-only">{label}</span></dt><dd className="tabular-nums">{String(v)}{label === t.area ? ' m²' : ''}</dd></div>)}</dl>}
    <ul className="flex flex-wrap gap-1.5 text-xs" aria-label={h.overview}>
     <li className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'var(--crm-soft)' }}><Users aria-hidden="true" className="h-3.5 w-3.5" />{h.leadsCount(leads)}{hub.leads.qualified.length > 0 && <strong className="font-semibold">· {h.qualifiedCount(hub.leads.qualified.length)}</strong>}</li>
     {hub.conversations.length > 0 && <li className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'var(--crm-soft)' }}><MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />{h.conversationsCount(hub.conversations.length)}</li>}
     <li className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'var(--crm-soft)' }}><CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />{hub.next ? `${hub.next.kind === 'viewing' ? h.nextViewing : h.nextBooking}: ${shortDate(hub.next.at, language)}` : h.noUpcoming}</li>
    </ul>
   </div>
  </button>
  <div className="mt-auto flex items-center gap-1 px-2 pb-2">
   <span title={agentName ? `${h.agent}: ${agentName}` : h.noAgent} aria-label={agentName ? `${h.agent}: ${agentName}` : h.noAgent} className="mx-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: agentName ? 'var(--crm-primary)' : 'var(--crm-bg)', color: agentName ? 'var(--crm-primary-text)' : 'var(--crm-muted)', border: '1px solid var(--crm-border)' }}>{agentName ? initials(agentName) : '–'}</span>
   <span className="flex-1" />
   {onMatcher && !hub.holiday && <button type="button" className={iconButton} aria-label={h.matcher} title={h.matcher} onClick={onMatcher}><Heart className="h-[18px] w-[18px]" /></button>}
   <button type="button" className={iconButton} aria-label={h.conversations} title={h.conversations} onClick={() => onOpenHub('conversations')}><MessageCircle className="h-[18px] w-[18px]" /></button>
   {!readOnly && <button type="button" className={iconButton} aria-label={hub.holiday ? h.addBooking : h.schedule} title={hub.holiday ? h.addBooking : h.schedule} onClick={() => onOpenHub('viewings')}><CalendarPlus className="h-[18px] w-[18px]" /></button>}
   <details className="relative" onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label={h.more} title={h.more} className={`${iconButton} cursor-pointer list-none`}><MoreHorizontal className="h-[18px] w-[18px]" /></summary>
    <div className="absolute bottom-12 right-0 z-20 w-52 rounded-xl border p-1 shadow-xl" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
     <button type="button" onClick={onEdit} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-[var(--crm-soft)]"><Pencil className="h-4 w-4" />{readOnly ? t.view : h.editRecord}</button>
     <button type="button" onClick={() => onOpenHub('activity')} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-[var(--crm-soft)]"><CalendarClock className="h-4 w-4" />{h.activity}</button>
     {!readOnly && canDelete && onDelete && <button type="button" onClick={() => { if (window.confirm(h.confirmDelete)) onDelete(); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-red-700 hover:bg-[var(--crm-soft)]"><Trash2 className="h-4 w-4" />{h.delete}</button>}
    </div>
   </details>
  </div>
 </article>;
}
