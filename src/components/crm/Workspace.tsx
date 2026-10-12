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
import { TodayView } from './TodayView';
import { OpsView } from './OpsView';
import { CardsView } from './CardsView';
import { RuntimeContext } from './runtimeContext';
import { FilterBar } from './FilterBar';
import { useViewFilters } from './useViewFilters';
import { CommandPalette } from './CommandPalette';
import { HOY, hubsFor } from './hubs';
import { AppLogo } from '@/components/brand/Logo';

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
}

const ICON: Record<string, LucideIcon> = { table: Table2, kanban: Columns3, calendar: CalendarDays, worklist: ListChecks, analysis: BrainCircuit, ops: LayoutDashboard, cards: LayoutGrid, timeline: CalendarRange };
const HUB_ICON: Record<string, LucideIcon> = { hoy: Sun, clientes: Users, inmuebles: Building2, turistico: Palmtree, empresa: Briefcase };
// Sections that get the filter bar (search, rules, sort, saved views).
const FILTERED = new Set<string>(['table', 'kanban', 'worklist', 'calendar', 'cards']);
const GREEN = 'var(--crm-primary)';

export function Workspace({ blueprint, records, onCreate, onUpdate, onDelete, onWebhook, onSyncIcal, tools = [], banner, now, className = '', appId }: WorkspaceProps) {
  const sections = useMemo(() => blueprint.views.filter((v) => v.type !== 'dashboard'), [blueprint.views]);
  const hubs = useMemo(() => hubsFor(sections), [sections]);
  // With an operations centre first, the app opens there and it replaces «Hoy».
  const home = sections[0]?.type === 'ops' ? sections[0].key : HOY;
  const [section, setSection] = useState<string>(home);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [palette, setPalette] = useState(false);
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
  const shown = filters.entity ? filters.records : records;
  const labelOf = (key: string) => (key === HOY ? 'Hoy' : sections.find((v) => v.key === key)?.label ?? key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const toggleMode = () => { const next: ThemeMode = dark ? 'light' : 'dark'; setMode(next); storeMode(next); };

  const go = (key: string) => { setSection(key); setOpenId(null); };
  const create = async (entityKey: string, data: RecordData = {}) => {
    const r = await onCreate(entityKey, data);
    if (r && 'id' in r) setOpenId(r.id);
  };
  const actions = useMemo(() => ({ createQuietly: onCreate, sendWebhook: onWebhook }), [onCreate, onWebhook]);
  const glass = { background: dark ? 'rgba(19,26,46,.72)' : 'rgba(255,255,255,.72)', border: '1px solid var(--crm-border)', backdropFilter: 'blur(18px) saturate(1.4)', WebkitBackdropFilter: 'blur(18px) saturate(1.4)' } as const;

  // One element for the hub switcher: a pill in the top bar on a computer,
  // a dock at the bottom on a phone.
  const hubNav = (
    <nav aria-label="Hubs" className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md justify-around gap-1 rounded-[22px] p-1.5 shadow-[0_12px_40px_rgba(11,16,32,.18)] md:static md:z-auto md:mx-0 md:max-w-none md:justify-start md:rounded-full md:p-1 md:shadow-none"
      style={glass}>
      {hubs.map((h) => {
        const Icon = HUB_ICON[h.key];
        const active = h.key === hub.key;
        const badge = h.key === 'hoy' && home === HOY && pending ? pending : undefined;
        return (
          <button key={h.key} onClick={() => go(h.sections[0])} aria-current={active ? 'page' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[0.72em] font-medium transition md:flex-none md:flex-row md:gap-1.5 md:rounded-full md:px-3.5 md:text-[0.95em]"
            style={active ? { background: GREEN, color: '#fff' } : { color: 'var(--crm-muted)' }}>
            <Icon className="h-[18px] w-[18px] md:h-4 md:w-4" style={active ? { color: 'var(--crm-accent)' } : undefined} />
            <span className="truncate">{h.label}</span>
            {badge !== undefined && <span className="absolute right-1 top-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4 text-white md:static md:leading-[18px]" style={{ background: GREEN }}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <RuntimeContext.Provider value={actions}>
      <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${className}`} style={themeVars(mode)} data-app="statehubs" data-theme={mode}>
        {/* Soft brand light behind everything. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-56 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: '#7fb89c', opacity: dark ? 0.12 : 0.18 }} />
          <div className="absolute -right-40 -top-40 h-[460px] w-[460px] rounded-full blur-3xl" style={{ background: 'var(--crm-accent)', opacity: dark ? 0.06 : 0.22 }} />
        </div>

        {banner}
        <header className="relative z-20 flex items-center gap-3 px-3 py-2.5 md:px-5" style={{ ...glass, borderWidth: '0 0 1px 0' }}>
          <div className="flex min-w-0 items-center gap-2.5 md:w-60 md:shrink-0">
            <AppLogo src={blueprint.logo} name={blueprint.name} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[0.98em] font-semibold leading-tight">{blueprint.name}</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--crm-muted)' }}>StateHubs</span>
            </span>
          </div>
          <div className="hidden min-w-0 flex-1 justify-center md:flex">{hubNav}</div>
          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <button onClick={() => setPalette(true)} aria-label="Buscar en toda la app" title="Buscar (Ctrl/⌘ K)"
              className="inline-flex items-center gap-2 rounded-full p-2 transition hover:opacity-80 lg:px-3 lg:py-1.5" style={{ border: '1px solid var(--crm-border)', color: 'var(--crm-muted)', background: 'var(--crm-surface)' }}>
              <Search className="h-4 w-4" /><span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden rounded px-1 text-[0.78em] xl:inline" style={{ border: '1px solid var(--crm-border)' }}>⌘K</kbd>
            </button>
            {tools.map((t) => <ToolButton key={t.key} tool={t} dark={dark} />)}
            <button onClick={toggleMode} aria-label={dark ? 'Modo claro' : 'Modo oscuro'} title={dark ? 'Modo claro' : 'Modo oscuro'}
              className="rounded-full p-2 transition hover:opacity-80" style={{ color: 'var(--crm-muted)' }}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <div className="md:hidden">{hubNav}</div>

        <main className="relative z-10 min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-7">
            <div className="mb-5 flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[0.78em] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--crm-muted)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />{hub.label}
                </p>
                <h1 className="mt-1 truncate text-[1.9em] font-normal leading-tight tracking-[-0.02em] md:text-[2.6em]">{view ? view.label : 'Hoy'}</h1>
              </div>
              {entity && (
                <button onClick={() => create(entity.key)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-white shadow-[0_8px_24px_rgba(31,92,69,.28)] transition hover:-translate-y-px"
                  style={{ background: GREEN }}>
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo: {entity.label.toLowerCase()}</span><span className="sm:hidden">Nuevo</span>
                </button>
              )}
            </div>
            {hub.sections.length > 1 && (
              <nav aria-label="Secciones" className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" style={{ borderBottom: '1px solid var(--crm-border)' }}>
                {hub.sections.map((key) => {
                  const v = sections.find((x) => x.key === key);
                  const Icon = v ? ICON[v.type] ?? Table2 : Sun;
                  const active = key === section;
                  return (
                    <button key={key} onClick={() => go(key)} aria-current={active ? 'page' : undefined}
                      className="relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-1 text-[0.95em] font-medium transition"
                      style={{ color: active ? 'var(--crm-text)' : 'var(--crm-muted)' }}>
                      <Icon className="h-4 w-4" /> {labelOf(key)}
                      {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full" style={{ background: GREEN }} />}
                    </button>
                  );
                })}
              </nav>
            )}

            {view && filters.entity && <div className="mb-4"><FilterBar filters={filters} records={records} titleOf={titleOf} dark={dark} /></div>}
            {!view && <TodayView blueprint={blueprint} records={records} now={now} dark={dark} onOpen={(r) => setOpenId(r.id)} />}
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
              <TimelineView blueprint={blueprint} view={view} records={records} dark={dark} titleOf={titleOf} selectedId={openId} now={now} onSync={onSyncIcal}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && !['worklist', 'analysis', 'ops', 'cards', 'timeline'].includes(view.type) && (
              <ViewBody blueprint={blueprint} view={view} records={shown} dark={dark} filtered={!!filters.entity} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
          </div>
        </main>

        {open && (
          <div className="absolute inset-0 z-40 flex justify-end p-0 md:p-3" style={{ background: dark ? 'rgba(0,0,0,.5)' : 'rgba(11,16,32,.24)', backdropFilter: 'blur(2px)' }} onClick={() => setOpenId(null)}>
            <div className="h-full w-full max-w-[500px] overflow-hidden shadow-2xl md:rounded-[20px]" onClick={(e) => e.stopPropagation()} style={{ border: '1px solid var(--crm-border)' }}>
              <RecordPanel blueprint={blueprint} record={open} records={records} titleOf={titleOf} dark={dark}
                groupBy={blueprint.views.find((v) => v.entity === open.entity && v.groupBy)?.groupBy}
                onUpdate={onUpdate} onDelete={(id) => { onDelete(id); setOpenId(null); }} onClose={() => setOpenId(null)} />
            </div>
          </div>
        )}

        {palette && (
          <CommandPalette blueprint={blueprint} records={records} sections={[{ key: HOY, label: 'Hoy' }, ...sections.map((v) => ({ key: v.key, label: v.label }))]}
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
      className={`relative inline-flex items-center gap-1.5 rounded-full p-2 text-[0.92em] font-medium transition hover:opacity-85 ${ai ? 'xl:px-3 xl:py-1.5' : ''}`}
      style={ai ? { background: GREEN, color: '#fff' } : t.active ? { background: dark ? 'rgba(255,255,255,.1)' : 'rgba(11,16,32,.07)', color: 'var(--crm-text)' } : { color: 'var(--crm-muted)' }}>
      <Icon className="h-4 w-4" />
      {ai && <span className="hidden xl:inline">IA</span>}
      {t.badge !== undefined && <span className="absolute -right-0.5 -top-0.5 rounded-full px-1 text-[10px] font-semibold leading-4 text-white" style={{ background: GREEN }}>{t.badge}</span>}
    </button>
  );
}
