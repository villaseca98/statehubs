import { useMemo, useState } from 'react';
import { Building2, Palmtree, Search } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { isProperty, propertyCategory, recordLabel } from '@/lib/crm/propertyFeed';
import type { PropertyMarket } from '@/lib/crm/propertyFeed';
import { propertyHub } from '@/lib/crm/propertyHub';
import { propertyLocation } from '@/lib/crm/propertyFormat';
import { usePropertyFeedText } from '@/i18n/propertyFeed';
import { useHubText } from '@/i18n/hub';
import { PropertyCard } from './PropertyCard';
import type { HubTab } from './PropertyCard';

type Deal = 'all' | 'sale' | 'rent';
type Sort = 'recent' | 'priceUp' | 'priceDown' | 'leads';
const PAGE = 24;
const priceOf = (r: AppRecord) => { const v = propertyCategory(r).market === 'holiday-rentals' ? r.data.precio_noche ?? r.data.nightly_price : r.data.precio ?? r.data.price; return typeof v === 'number' ? v : null; };
const prefKey = (app: string) => `statehubs:feed:${app}`;
function readPrefs(app: string): { deal?: Deal; sort?: Sort } { try { return JSON.parse(localStorage.getItem(prefKey(app)) ?? '{}'); } catch { return {}; } }

type Props = {
 records: AppRecord[]; blueprint: Blueprint; appId?: string; readOnly?: boolean; canDelete?: boolean;
 market: PropertyMarket; onMarket: (m: PropertyMarket) => void; titleOf: (id: string) => string | undefined;
 onOpen: (record: AppRecord) => void; onOpenHub: (id: string, tab?: HubTab) => void; onMatcher?: (id: string) => void; onDelete?: (id: string) => void;
};

/** Real Estate (buy/rent) and Holiday Rentals as two visual universes of property cards. Filters change the actual list. */
export function PropertyFeed({ records, blueprint, appId, readOnly, canDelete, market, onMarket, titleOf, onOpen, onOpenHub, onMatcher, onDelete }: Props) {
 const t = usePropertyFeedText(); const h = useHubText();
 const app = appId ?? blueprint.name;
 const [deal, setDealState] = useState<Deal>(() => readPrefs(app).deal ?? 'all');
 const [sort, setSortState] = useState<Sort>(() => readPrefs(app).sort ?? 'recent');
 const [query, setQuery] = useState(''); const [limit, setLimit] = useState(PAGE);
 const save = (next: { deal?: Deal; sort?: Sort }) => { try { localStorage.setItem(prefKey(app), JSON.stringify({ ...readPrefs(app), ...next })); } catch { /* private browsing: keep it in memory */ } };
 const setDeal = (d: Deal) => { setDealState(d); setLimit(PAGE); save({ deal: d }); };
 const setSort = (s: Sort) => { setSortState(s); save({ sort: s }); };
 const properties = useMemo(() => records.filter(r => isProperty(r.entity)), [records]);
 const count = (m: PropertyMarket, d: Deal = 'all') => properties.filter(r => { const c = propertyCategory(r); return c.market === m && (d === 'all' || c.deal === d); }).length;
 const q = query.trim().toLowerCase();
 const filtered = properties.filter(r => {
  const c = propertyCategory(r);
  if (c.market !== market || (market === 'real-estate' && deal !== 'all' && c.deal !== deal)) return false;
  return !q || [recordLabel(r, blueprint, ''), propertyLocation(r), r.data.referencia, r.data.reference].some(v => String(v ?? '').toLowerCase().includes(q));
 });
 const hubs = useMemo(() => new Map(filtered.map(r => [r.id, propertyHub(r, records, blueprint)])), [filtered, records, blueprint]);
 const sorted = [...filtered].sort((a, b) => {
  if (sort === 'leads') { const l = (r: AppRecord) => { const x = hubs.get(r.id)!; return x.leads.qualified.length * 1000 + x.leads.potential.length; }; return l(b) - l(a); }
  if (sort === 'priceUp' || sort === 'priceDown') { const pa = priceOf(a), pb = priceOf(b); if (pa === null) return pb === null ? 0 : 1; if (pb === null) return -1; return sort === 'priceUp' ? pa - pb : pb - pa; }
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
 });
 const uncategorized = count('uncategorized');
 const universes = [{ key: 'real-estate' as const, label: t.real, icon: Building2 }, { key: 'holiday-rentals' as const, label: t.holiday, icon: Palmtree }];
 return <div className="space-y-5">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
   <div role="group" aria-label={t.categories} className="grid grid-cols-2 gap-1.5 rounded-[20px] border p-1.5 lg:w-[440px]" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
    {universes.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-pressed={market === key} onClick={() => { onMarket(key); setLimit(PAGE); }}
     className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-all duration-300"
     style={market === key ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)', boxShadow: '0 8px 22px rgba(23,64,45,.25)' } : { color: 'var(--crm-text)' }}>
     <Icon aria-hidden="true" className="h-4 w-4" />{label}<span className="text-xs tabular-nums opacity-70">{count(key)}</span></button>)}
   </div>
   <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[20px] border px-4" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
    <Search aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: 'var(--crm-muted)' }} /><span className="sr-only">{h.search}</span>
    <input value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} placeholder={h.search} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
   </label>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   {market === 'real-estate' && <div role="group" aria-label={t.transaction} className="flex gap-1">
    {(['all', 'sale', 'rent'] as const).map(d => <button key={d} type="button" aria-pressed={deal === d} onClick={() => setDeal(d)} className="min-h-11 rounded-full border px-4 text-sm font-medium transition"
     style={deal === d ? { background: 'var(--crm-soft)', borderColor: 'var(--crm-primary)', color: 'var(--crm-primary)' } : { borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>{d === 'all' ? h.all : t[d]} <span className="tabular-nums opacity-70">({count('real-estate', d)})</span></button>)}
   </div>}
   {market === 'holiday-rentals' && <span className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium" style={{ background: 'var(--crm-soft)', borderColor: 'var(--crm-primary)', color: 'var(--crm-primary)' }}>{h.shortStay}</span>}
   {uncategorized > 0 && <button type="button" aria-pressed={market === 'uncategorized'} onClick={() => onMarket('uncategorized')} className="min-h-11 rounded-full px-3 text-xs underline" style={{ color: 'var(--crm-muted)' }}>{t.uncategorized} ({uncategorized})</button>}
   <span className="flex-1" />
   <span role="status" className="text-xs tabular-nums" style={{ color: 'var(--crm-muted)' }}>{h.results(sorted.length)}</span>
   <label className="flex items-center gap-2 text-sm"><span className="sr-only">{h.sort}</span>
    <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="min-h-11 rounded-full border bg-transparent px-3 text-sm" style={{ borderColor: 'var(--crm-border)' }}>
     <option value="recent">{h.sortRecent}</option><option value="priceUp">{h.sortPriceUp}</option><option value="priceDown">{h.sortPriceDown}</option><option value="leads">{h.sortLeads}</option>
    </select></label>
  </div>
  {sorted.length ? <section aria-label={t.feed} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
   {sorted.slice(0, limit).map((r, i) => <div key={r.id} className="sh-card-in" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
    <PropertyCard record={r} blueprint={blueprint} hub={hubs.get(r.id)!} agentName={hubs.get(r.id)!.agentId ? titleOf(hubs.get(r.id)!.agentId!) : undefined}
     readOnly={readOnly} canDelete={canDelete} onOpenHub={tab => onOpenHub(r.id, tab)} onMatcher={onMatcher ? () => onMatcher(r.id) : undefined}
     onEdit={() => onOpen(r)} onDelete={onDelete ? () => onDelete(r.id) : undefined} />
   </div>)}
  </section> : <section className="rounded-[24px] border p-8 text-center" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}><Building2 aria-hidden="true" className="mx-auto mb-3 h-7 w-7" style={{ color: 'var(--crm-primary)' }} /><h2 className="font-semibold">{t.empty}</h2><p className="mt-2 text-sm" style={{ color: 'var(--crm-muted)' }}>{t.emptyHelp}</p></section>}
  {sorted.length > limit && <div className="text-center"><button type="button" onClick={() => setLimit(n => n + PAGE)} className="min-h-11 rounded-full border px-5 text-sm font-medium" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>{h.showMore}</button></div>}
 </div>;
}
