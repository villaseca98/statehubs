import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrainCircuit, CalendarDays, Columns3, ListChecks, Menu, Moon, Plus, Search, Sun, Table2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRecord, Blueprint, RecordData, View } from '@shared/blueprint/types.ts';
import { computeToday } from '@/lib/crm/today';
import { initialMode, makeTitleLookup, storeMode, themeVars } from './theme';
import type { ThemeMode } from './theme';
import { ViewBody } from './views';
import { WorklistView } from './WorklistView';
import { AnalysisView } from './AnalysisView';
import { RecordPanel } from './RecordPanel';
import { TodayView } from './TodayView';
import { RuntimeContext } from './runtimeContext';
import { FilterBar } from './FilterBar';
import { useViewFilters } from './useViewFilters';
import { CommandPalette } from './CommandPalette';
import { AppLogo } from '@/components/brand/Logo';
import { BRAND } from '@shared/blueprint/look.ts';

// The app itself: a quiet sidebar, one section at a time, «Hoy» first.
// Records open in a side drawer so you never lose your place. Tools that
// change the app (pieces, the AI, history) are passed in by the page
// and live at the bottom of the sidebar, out of the way of daily work.

export interface Tool { key: string; label: string; icon: LucideIcon; onClick: () => void; badge?: string | number; active?: boolean }

export interface WorkspaceProps {
  blueprint: Blueprint;
  records: AppRecord[];
  onCreate: (entity: string, data: RecordData) => Promise<AppRecord | void> | AppRecord | void;
  onUpdate: (id: string, data: RecordData) => void;
  onDelete: (id: string) => void;
  onWebhook?: (record: AppRecord) => Promise<string> | string | void;
  tools?: Tool[];
  banner?: ReactNode;
  now?: Date;
  className?: string;
  /** Where saved filter views are kept apart (defaults to the app's name). */
  appId?: string;
}

const ICON: Record<string, LucideIcon> = { table: Table2, kanban: Columns3, calendar: CalendarDays, worklist: ListChecks, analysis: BrainCircuit };
const HOY = 'hoy';
// Sections that get the filter bar (search, rules, sort, saved views).
const FILTERED = new Set<string>(['table', 'kanban', 'worklist', 'calendar']);

export function Workspace({ blueprint, records, onCreate, onUpdate, onDelete, onWebhook, tools = [], banner, now, className = '', appId }: WorkspaceProps) {
  const sections = useMemo(() => blueprint.views.filter((v) => v.type !== 'dashboard'), [blueprint.views]);
  const [section, setSection] = useState<string>(HOY);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [palette, setPalette] = useState(false);
  const dark = mode === 'dark';

  useEffect(() => { if (section !== HOY && !sections.some((v) => v.key === section)) setSection(HOY); }, [sections, section]);
  useEffect(() => { if (openId && !records.some((r) => r.id === openId)) setOpenId(null); }, [records, openId]);

  const view: View | null = sections.find((v) => v.key === section) ?? null;
  const open = records.find((r) => r.id === openId) ?? null;
  const titleOf = useMemo(() => makeTitleLookup(blueprint.entities, records), [blueprint.entities, records]);
  const pending = useMemo(() => { const t = computeToday(blueprint, records, now); return t.hoy.length + t.atrasado.length; }, [blueprint, records, now]);
  const entity = view?.entity ? blueprint.entities.find((e) => e.key === view.entity) : undefined;
  const filters = useViewFilters(blueprint, view && FILTERED.has(view.type) ? view : null, records, { appId, titleOf, now });
  const shown = filters.entity ? filters.records : records;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const toggleMode = () => { const next: ThemeMode = dark ? 'light' : 'dark'; setMode(next); storeMode(next); };

  const go = (key: string) => { setSection(key); setOpenId(null); setMenu(false); };
  const create = async (entityKey: string, data: RecordData = {}) => {
    const r = await onCreate(entityKey, data);
    if (r && 'id' in r) setOpenId(r.id);
  };
  const actions = useMemo(() => ({ createQuietly: onCreate, sendWebhook: onWebhook }), [onCreate, onWebhook]);

  const nav = (
    <nav aria-label="Secciones" className="flex flex-col gap-0.5">
      <NavButton icon={Sun} label="Hoy" active={section === HOY} badge={pending || undefined} onClick={() => go(HOY)} />
      {sections.map((v) => <NavButton key={v.key} icon={ICON[v.type] ?? Table2} label={v.label} active={section === v.key} onClick={() => go(v.key)} />)}
    </nav>
  );
  const toolList = (
    <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
      {tools.map((t) => <NavButton key={t.key} icon={t.icon} label={t.label} badge={t.badge} active={t.active} onClick={() => { setMenu(false); t.onClick(); }} quiet />)}
      <NavButton icon={dark ? Sun : Moon} label={dark ? 'Modo claro' : 'Modo oscuro'} onClick={toggleMode} quiet />
    </div>
  );
  const brand = (
    <div className="flex items-center gap-2.5 px-2">
      <AppLogo src={blueprint.logo} name={blueprint.name} size={32} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-white">{blueprint.name}</span>
        <span className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--crm-nav-text)' }}>{blueprint.kind === 'erp' ? 'ERP' : 'CRM'}</span>
      </span>
    </div>
  );

  return (
    <RuntimeContext.Provider value={actions}>
      <div className={`relative flex h-full min-h-0 overflow-hidden ${className}`} style={themeVars(mode)} data-app="statehubs" data-theme={mode}>
        <aside className="hidden w-60 shrink-0 flex-col gap-5 p-3 pt-4 md:flex" style={{ background: 'var(--crm-nav-bg)', color: 'var(--crm-nav-text)' }}>
          {brand}
          <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
          {toolList}
        </aside>

        {menu && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenu(false)} style={{ background: 'rgba(0,0,0,.35)' }}>
            <aside className="flex h-full w-72 flex-col gap-5 p-3 pt-4" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--crm-nav-bg)', color: 'var(--crm-nav-text)' }}>
              <div className="flex items-center justify-between">{brand}<button aria-label="Cerrar menú" onClick={() => setMenu(false)} className="p-2"><X className="h-5 w-5" /></button></div>
              <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
              {toolList}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {banner}
          <header className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--crm-border)' }}>
            <button aria-label="Abrir menú" onClick={() => setMenu(true)} className="-ml-1 rounded-lg p-1.5 md:hidden"><Menu className="h-5 w-5" /></button>
            <h1 className="min-w-0 flex-1 truncate text-[1.15em] font-semibold md:text-[1.25em]">{view ? view.label : 'Hoy'}</h1>
            <button onClick={() => setPalette(true)} aria-label="Buscar en toda la app" title="Buscar (Ctrl/⌘ K)"
              className="inline-flex shrink-0 items-center gap-2 rounded-full p-2 sm:px-3 sm:py-1.5" style={{ border: '1px solid var(--crm-border)', color: 'var(--crm-muted)', background: 'var(--crm-surface)' }}>
              <Search className="h-4 w-4" /><span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden rounded px-1 text-[0.78em] lg:inline" style={{ border: '1px solid var(--crm-border)' }}>⌘K</kbd>
            </button>
            {entity && (
              <button onClick={() => create(entity.key)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium"
                style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{entity.label}</span><span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </header>
          <main className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5">
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
            {view && view.type !== 'worklist' && view.type !== 'analysis' && (
              <ViewBody blueprint={blueprint} view={view} records={shown} dark={dark} filtered={!!filters.entity} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
          </main>
        </div>

        {open && (
          <div className="absolute inset-0 z-30 flex justify-end" style={{ background: dark ? 'rgba(0,0,0,.5)' : 'rgba(28,26,22,.22)' }} onClick={() => setOpenId(null)}>
            <div className="h-full w-full max-w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ borderLeft: '1px solid var(--crm-border)' }}>
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

function NavButton({ icon: Icon, label, active, badge, onClick, quiet }: { icon: LucideIcon; label: string; active?: boolean; badge?: string | number; onClick: () => void; quiet?: boolean }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.95em] transition hover:bg-white/5"
      style={active ? { background: 'rgba(255,255,255,.09)', color: '#fff' } : { color: quiet ? 'rgba(189,183,171,.85)' : 'var(--crm-nav-text)' }}>
      <Icon className="h-4 w-4 shrink-0" style={active ? { color: BRAND.light } : undefined} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && <span className="rounded-full px-1.5 text-[0.78em] font-semibold" style={{ background: active ? BRAND.red : 'rgba(255,255,255,.1)', color: '#fff' }}>{badge}</span>}
    </button>
  );
}
