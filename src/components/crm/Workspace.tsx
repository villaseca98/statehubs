import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrainCircuit, Briefcase, Building2, CalendarDays, CalendarRange, Columns3, LayoutDashboard, LayoutGrid, ListChecks, Moon, Palmtree, Plus, Search, Sun, Table2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRecord, Blueprint, RecordData, View } from '@shared/blueprint/types.ts';
import { computeToday } from '@/lib/crm/today';
import { initialMode, makeTitleLookup, storeMode, themeVars } from './theme';
import type { ThemeMode } from './theme';
import { ViewBody } from './views';
import { WorklistView } from './WorklistView';
import { AnalysisView } from './AnalysisView';
import { TimelineView } from './TimelineView';
import { RecordPanel } from './RecordPanel';
import { RecordDialog } from './RecordDialog';
import { TodayView } from './TodayView';
import { OpsView } from './OpsView';
import { OperationsDashboard } from './OperationsDashboard';
import { LivingWorkspace } from './LivingWorkspace';
import { BusinessModeCards } from './BusinessModeCards';
import { ModulePlanner } from './ModulePlanner';
import { IntelligenceCommandCenter } from './IntelligenceCommandCenter';
import { MatchDesk } from './MatchDesk';
import { CardsView } from './CardsView';
import { RuntimeContext } from './runtimeContext';
import { FilterBar } from './FilterBar';
import { useViewFilters } from './useViewFilters';
import { CommandPalette } from './CommandPalette';
import { HOY, hubsFor } from './hubs';
import { AppLogo } from '@/components/brand/Logo';
import { useProductText } from '@/i18n/product';
import { useContactText } from '@/i18n/contacts';
import { contactStage } from '@/lib/crm/contactLifecycle';
import type { ContactStage } from '@/lib/crm/contactLifecycle';

// The app itself. No sidebar: the sections are grouped in a few hubs
// (Hoy, Clientes, Inmuebles, Turístico, Empresa) in a floating bar at the
// top, which becomes a dock at the bottom on a phone. Each hub shows its
// sections as tabs. Records open in a side drawer so you never lose your
// place, and the tools that change the app (pieces, the AI, history) sit
// at the top right, out of the way of daily work.

export interface Tool { key: string; label: string; icon: LucideIcon; onClick: () => void; badge?: string | number; active?: boolean }

export interface WorkspaceProps {
  blueprint: Blueprint;
  records: AppRecord[];
  onCreate: (entity: string, data: RecordData) => Promise<AppRecord | void> | AppRecord | void;
  onUpdate: (id: string, data: RecordData) => void;
  onDelete: (id: string) => void;
  onWebhook?: (record: AppRecord) => Promise<string> | string | void;
  onSyncIcal?: () => Promise<string> | string;
  tools?: Tool[];
  banner?: ReactNode;
  now?: Date;
  className?: string;
  /** Where saved filter views are kept apart (defaults to the app's name). */
  appId?: string;
  readOnly?: boolean;
  canDelete?: boolean;
}

const ICON: Record<string, LucideIcon> = { table: Table2, kanban: Columns3, calendar: CalendarDays, worklist: ListChecks, analysis: BrainCircuit, ops: LayoutDashboard, cards: LayoutGrid, timeline: CalendarRange };
const HUB_ICON: Record<string, LucideIcon> = { hoy: Sun, clientes: Users, inmuebles: Building2, turistico: Palmtree, empresa: Briefcase };
// Sections that get the filter bar (search, rules, sort, saved views).
const FILTERED = new Set<string>(['table', 'kanban', 'worklist', 'calendar', 'cards']);
const ACCENT = 'var(--crm-primary)';
const HUB_EN: Record<string,string> = { hoy:'Home', clientes:'Clients', inmuebles:'Properties', turistico:'Rentals', empresa:'Business' };

const SECTION_EN: Record<string,string> = {
  hoy:'Home', panel:'Overview', centro:'Operations center', analisis:'Insights', leads:'Leads', embudo:'Pipeline',
  clientes:'Clients', contactos:'Contacts', contacto_inmo:'Contacts', inmuebles:'Properties', propiedades:'Properties',
  reservas:'Reservations', alquileres:'Rentals', calendario:'Calendar', operaciones:'Deals', operacion:'Deals',
  tareas:'Tasks', actividades:'Activities', agentes:'Agents', equipo:'Team', facturas:'Invoices',
  pagos:'Payments', propietarios:'Owners', informes:'Reports', oportunidades:'Opportunities',
  visitas:'Viewings', automatizaciones:'Automations', mensajes:'Messages', negocios:'Business',
};
const englishLabel = (key:string,label:string) => SECTION_EN[key.toLowerCase()] ?? SECTION_EN[label.toLowerCase()] ?? label;

export function Workspace({ blueprint, records, onCreate, onUpdate: persistRecord, onDelete, onWebhook, onSyncIcal, tools = [], banner, now, className = '', appId, readOnly = false, canDelete = true }: WorkspaceProps) {
  const text = useProductText();
  const contactsText = useContactText();
  const [contactFilter, setContactFilter] = useState<ContactStage | 'all'>('all');
  const onUpdate = (id: string, patch: RecordData) => { if (!readOnly) persistRecord(id, patch); };
  const sections = useMemo(() => blueprint.views.filter((v) => v.type !== 'dashboard'), [blueprint.views]);
  const hubs = useMemo(() => hubsFor(sections), [sections]);
  // With an operations centre first, the app opens there and it replaces «Hoy».
  const home = sections[0]?.type === 'ops' ? sections[0].key : HOY;
  const [section, setSection] = useState<string>(home);
  const [recordTrail, setRecordTrail] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [palette, setPalette] = useState(false);
  const [businessMode, setBusinessMode] = useState<'real-estate' | 'holiday-rentals' | null>(() => { try { const value = localStorage.getItem(`statehubs:business-mode:${appId ?? blueprint.name}`); return value === 'real-estate' || value === 'holiday-rentals' ? value : null; } catch { return null; } });
  const chooseBusinessMode = (value: 'real-estate' | 'holiday-rentals') => { setBusinessMode(value); try { localStorage.setItem(`statehubs:business-mode:${appId ?? blueprint.name}`,value); } catch { /* Private browsing: keep the in-memory selection. */ } };
  const hasPropertyModule = blueprint.entities.some(e=>e.key==='inmueble');
  const dark = mode === 'dark';

  useEffect(() => { if (section === HOY ? home !== HOY : !sections.some((v) => v.key === section)) setSection(home); }, [sections, section, home]);
  useEffect(() => { if (openId && !records.some((r) => r.id === openId)) setOpenId(null); }, [records, openId]);

  const view: View | null = sections.find((v) => v.key === section) ?? null;
  const hub = hubs.find((h) => h.sections.includes(section)) ?? hubs[0];
  const open = records.find((r) => r.id === openId) ?? null;
  const titleOf = useMemo(() => makeTitleLookup(blueprint.entities, records), [blueprint.entities, records]);
  const pending = useMemo(() => { const t = computeToday(blueprint, records, now); return t.hoy.length + t.atrasado.length; }, [blueprint, records, now]);
  const entity = view?.entity ? blueprint.entities.find((e) => e.key === view.entity) : undefined;
  const filters = useViewFilters(blueprint, view && FILTERED.has(view.type) ? view : null, records, { appId, titleOf, now });
  const baseShown = filters.entity ? filters.records : records;
  const contactView = entity?.key === 'contacto_inmo';
  const shown = contactView && contactFilter !== 'all' ? baseShown.filter(r => r.entity !== 'contacto_inmo' || contactStage(r.data) === contactFilter) : baseShown;
  const labelOf = (key: string) => (key === HOY ? 'Home' : englishLabel(key, sections.find((v) => v.key === key)?.label ?? key));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const toggleMode = () => { const next: ThemeMode = dark ? 'light' : 'dark'; setMode(next); storeMode(next); };

  useEffect(() => { if (!openId) setRecordTrail([]); }, [openId]);
  const go = (key: string) => { setSection(key); setOpenId(null); };
  const create = async (entityKey: string, data: RecordData = {}) => {
    if (readOnly) return;
    const r = await onCreate(entityKey, data);
    if (r && 'id' in r) setOpenId(r.id);
  };
  const actions = useMemo(() => ({ canEdit: !readOnly, canDelete: canDelete && !readOnly, createQuietly: readOnly ? () => undefined : onCreate, sendWebhook: readOnly ? undefined : onWebhook }), [readOnly, canDelete, onCreate, onWebhook]);
  const glass = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' } as const;

  // One element for the hub switcher: a pill in the top bar on a computer,
  // a dock at the bottom on a phone.
  const hubNav = (
    <nav aria-label="Hubs" className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md justify-around gap-1 rounded-[22px] p-1.5 shadow-[0_16px_48px_rgba(11,16,32,.22)] md:static md:z-auto md:mx-0 md:max-w-none md:flex-col md:justify-start md:gap-2 md:rounded-none md:p-0 md:shadow-none"
      style={glass}>
      {hubs.map((h) => {
        const Icon = HUB_ICON[h.key];
        const active = h.key === hub.key;
        const badge = h.key === 'hoy' && home === HOY && pending ? pending : undefined;
        return (
          <button key={h.key} onClick={() => go(h.sections[0])} aria-current={active ? 'page' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[0.72em] font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:scale-[.97] motion-reduce:transform-none md:min-h-11 md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3.5 md:text-[0.95em]"
            style={active ? { background: ACCENT, color: '#fff' } : { color: 'var(--crm-muted)' }}>
            <Icon className="h-[18px] w-[18px] md:h-4 md:w-4" style={active ? { color: 'var(--crm-accent)' } : undefined} />
            <span className="truncate">{HUB_EN[h.key] ?? h.label}</span>
            {badge !== undefined && <span className="absolute right-1 top-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4 text-white md:static md:leading-[18px]" style={{ background: ACCENT }}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <RuntimeContext.Provider value={actions}>
      <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${className}`} style={themeVars(mode)} data-app="statehubs" data-theme={mode}>
        {banner}
        <header className="relative z-20 flex items-center gap-3 px-3 py-2.5 md:px-5" style={{ ...glass, borderWidth: '0 0 1px 0' }}>
          <div className="flex min-w-0 items-center gap-2.5 md:w-52 md:shrink-0">
            <AppLogo src={blueprint.logo} name={blueprint.name} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[0.98em] font-semibold leading-tight">{blueprint.name}</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--crm-muted)' }}>StateHubs</span>
            </span>
          </div>
          <div className="hidden min-w-0 flex-1 md:block" />
          <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto md:ml-0">
            <button onClick={() => setPalette(true)} aria-label="Search across workspace" title="Search (Ctrl/⌘ K)"
              className="sh-touch inline-flex items-center gap-2 rounded-full p-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[.97] motion-reduce:transform-none lg:px-3 lg:py-1.5" style={{ border: '1px solid var(--crm-border)', color: 'var(--crm-muted)', background: 'var(--crm-surface)' }}>
              <Search className="h-4 w-4" /><span className="hidden lg:inline">Search</span>
              <kbd className="hidden rounded px-1 text-[0.78em] xl:inline" style={{ border: '1px solid var(--crm-border)' }}>⌘K</kbd>
            </button>
            {tools.map((t) => <ToolButton key={t.key} tool={t} dark={dark} />)}
            <button onClick={toggleMode} aria-label={dark ? 'Light mode' : 'Dark mode'} title={dark ? 'Light mode' : 'Dark mode'}
              className="sh-touch rounded-full p-2 transition-all duration-300 hover:-translate-y-0.5 hover:rotate-12 hover:bg-black/5 active:scale-95 motion-reduce:transform-none" style={{ color: 'var(--crm-muted)' }}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1">
        <aside className="md:w-56 md:shrink-0 md:border-r md:px-3 md:py-7" style={{ background: 'var(--crm-nav-bg)', borderColor: 'var(--crm-border)' }}>
          <p className="mb-5 hidden px-3 text-[10px] font-semibold uppercase tracking-[.18em] md:block" style={{ color: 'var(--crm-muted)' }}>{text.workspace}</p>
          {hubNav}
        </aside>
        <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1680px] px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
            <div className="mb-5 flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[0.78em] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--crm-muted)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />{HUB_EN[hub.key] ?? hub.label}
                </p>
                <h1 className="mt-1 truncate text-[1.9em] font-normal leading-tight tracking-[-0.02em] md:text-[2.8em]">{view ? englishLabel(view.key, view.label) : 'Home'}</h1>
              </div>
              {entity && !readOnly && (
                <button onClick={() => create(entity.key)} className="sh-touch inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-white shadow-[0_8px_24px_rgba(180,22,54,.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(180,22,54,.32)] active:scale-[.98] motion-reduce:transform-none"
                  style={{ background: ACCENT }}>
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New: {entity.label.toLowerCase()}</span><span className="sm:hidden">New</span>
                </button>
              )}
            </div>
            {hub.sections.length > 1 && (
              <nav aria-label="Sections" className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" style={{ borderBottom: '1px solid var(--crm-border)' }}>
                {hub.sections.map((key) => {
                  const v = sections.find((x) => x.key === key);
                  const Icon = v ? ICON[v.type] ?? Table2 : Sun;
                  const active = key === section;
                  return (
                    <button key={key} onClick={() => go(key)} aria-current={active ? 'page' : undefined}
                      className="sh-touch relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-1 text-[0.95em] font-medium transition"
                      style={{ color: active ? 'var(--crm-text)' : 'var(--crm-muted)' }}>
                      <Icon className="h-4 w-4" /> {labelOf(key)}
                      {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full" style={{ background: ACCENT }} />}
                    </button>
                  );
                })}
              </nav>
            )}

            {contactView && <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={contactsText.filter}>
              {(['all', 'unclassified', 'lead', 'client', 'archived'] as const).map(stage => <button key={stage} aria-pressed={contactFilter === stage} onClick={() => setContactFilter(stage)} className="min-h-11 rounded-full border px-3 py-2 text-sm" style={{ background: contactFilter === stage ? 'var(--crm-primary)' : 'var(--crm-surface)', color: contactFilter === stage ? 'var(--crm-primary-text)' : 'var(--crm-text)', borderColor: 'var(--crm-border)' }}>
                {contactsText[stage]} ({baseShown.filter(r => r.entity === 'contacto_inmo' && (stage === 'all' || contactStage(r.data) === stage)).length})
              </button>)}
            </div>}
            {contactView && !shown.some(r => r.entity === 'contacto_inmo') && <p role="status" className="mb-4 text-sm" style={{ color: 'var(--crm-muted)' }}>{contactsText.empty}</p>}
            {view && filters.entity && <div className="mb-4"><FilterBar filters={filters} records={records} titleOf={titleOf} dark={dark} /></div>}
            {(!view || view.type === 'ops') && hasPropertyModule && <IntelligenceCommandCenter blueprint={blueprint} records={records} now={now} onOpen={(r)=>setOpenId(r.id)} />}
            {(!view || view.type === 'ops') && hasPropertyModule && <ModulePlanner appId={appId ?? blueprint.name} />}
            {(!view || view.type === 'ops') && hasPropertyModule && <BusinessModeCards mode={businessMode} onChoose={chooseBusinessMode} />}
            {(!view || view.type === 'ops') && hasPropertyModule && businessMode !== 'holiday-rentals' && <MatchDesk records={records} onOpen={(r)=>setOpenId(r.id)} />}
            {(!view || view.type === 'ops') && <LivingWorkspace blueprint={blueprint} records={records} onOpen={(r) => setOpenId(r.id)} />}
            {(!view || view.type === 'ops') && <OperationsDashboard blueprint={blueprint} records={records} now={now} onOpen={(r) => setOpenId(r.id)} />}
            {!view && <TodayView blueprint={blueprint} records={records} now={now} onOpen={(r) => setOpenId(r.id)} />}
            {view && view.type === 'worklist' && (
              <WorklistView blueprint={blueprint} view={view} records={shown} dark={dark} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && view.type === 'analysis' && (
              <AnalysisView blueprint={blueprint} view={view} records={records} dark={dark} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && view.type === 'ops' && <OpsView blueprint={blueprint} records={records} now={now} onOpen={(r) => setOpenId(r.id)} />}
            {view && view.type === 'cards' && <CardsView blueprint={blueprint} view={view} records={shown} titleOf={titleOf} onOpen={(r) => setOpenId(r.id)} />}
            {view && view.type === 'timeline' && (
              <TimelineView blueprint={blueprint} view={view} records={records} dark={dark} titleOf={titleOf} selectedId={openId} now={now} onSync={readOnly ? undefined : onSyncIcal}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && !['worklist', 'analysis', 'ops', 'cards', 'timeline'].includes(view.type) && (
              <ViewBody blueprint={blueprint} view={view} records={shown} dark={dark} filtered={!!filters.entity} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
          </div>
        </main>
        </div>

        {open && (
          <RecordDialog title={`Details: ${titleOf(open.id) ?? open.entity}`} onClose={() => setOpenId(null)}>
            <RecordPanel key={open.id} onOpen={id => { setRecordTrail(trail => [...trail, open.id]); setOpenId(id); }} onBack={recordTrail.length ? () => { setOpenId(recordTrail[recordTrail.length-1]); setRecordTrail(trail => trail.slice(0,-1)); } : undefined} blueprint={blueprint} appId={appId} record={open} records={records} titleOf={titleOf} dark={dark}
              groupBy={blueprint.views.find((v) => v.entity === open.entity && v.groupBy)?.groupBy}
              onUpdate={onUpdate} onDelete={(id) => { onDelete(id); setOpenId(null); }} onClose={() => setOpenId(null)} />
          </RecordDialog>
        )}

        {palette && (
          <CommandPalette blueprint={blueprint} records={records} sections={[{ key: HOY, label: 'Home' }, ...sections.map((v) => ({ key: v.key, label: englishLabel(v.key, v.label) }))]}
            onClose={() => setPalette(false)} onSection={go}
            onRecord={(id) => {
              const r = records.find((x) => x.id === id);
              const home = r && sections.find((v) => v.entity === r.entity);
              if (home && section !== home.key) setSection(home.key);
              setOpenId(id);
            }} />
        )}
      </div>
    </RuntimeContext.Provider>
  );
}

// The AI gets the brand gradient; the rest are quiet icons that show their
// name on wide screens.
function ToolButton({ tool: t, dark }: { tool: Tool; dark: boolean }) {
  const Icon = t.icon;
  const ai = t.key === 'ia';
  return (
    <button onClick={t.onClick} aria-label={t.label} title={t.label} aria-pressed={t.active || undefined}
      className={`sh-touch relative inline-flex items-center gap-1.5 rounded-full p-2 text-[0.92em] font-medium transition hover:opacity-85 ${ai ? 'xl:px-3 xl:py-1.5' : ''}`}
      style={ai ? { background: ACCENT, color: '#fff' } : t.active ? { background: dark ? 'rgba(255,255,255,.1)' : 'rgba(11,16,32,.07)', color: 'var(--crm-text)' } : { color: 'var(--crm-muted)' }}>
      <Icon className="h-4 w-4" />
      {ai && <span className="hidden xl:inline">IA</span>}
      {t.badge !== undefined && <span className="absolute -right-0.5 -top-0.5 rounded-full px-1 text-[10px] font-semibold leading-4 text-white" style={{ background: ACCENT }}>{t.badge}</span>}
    </button>
  );
}
