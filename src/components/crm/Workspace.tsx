import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrainCircuit, CalendarDays, Columns3, ListChecks, Menu, Plus, Sun, Table2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRecord, Blueprint, RecordData, View } from '@shared/blueprint/types.ts';
import { computeToday } from '@/lib/crm/today';
import { makeTitleLookup, themeVars } from './theme';
import { ViewBody } from './views';
import { WorklistView } from './WorklistView';
import { AnalysisView } from './AnalysisView';
import { RecordPanel } from './RecordPanel';
import { TodayView } from './TodayView';
import { RuntimeContext } from './runtimeContext';

// The app itself: a quiet sidebar, one section at a time, «Hoy» first.
// Records open in a side drawer so you never lose your place. Tools that
// change the app (pieces, the AI, history, 3D) are passed in by the page
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
}

const ICON: Record<string, LucideIcon> = { table: Table2, kanban: Columns3, calendar: CalendarDays, worklist: ListChecks, analysis: BrainCircuit };
const HOY = 'hoy';

export function Workspace({ blueprint, records, onCreate, onUpdate, onDelete, onWebhook, tools = [], banner, now, className = '' }: WorkspaceProps) {
  const sections = useMemo(() => blueprint.views.filter((v) => v.type !== 'dashboard'), [blueprint.views]);
  const [section, setSection] = useState<string>(HOY);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => { if (section !== HOY && !sections.some((v) => v.key === section)) setSection(HOY); }, [sections, section]);
  useEffect(() => { if (openId && !records.some((r) => r.id === openId)) setOpenId(null); }, [records, openId]);

  const view: View | null = sections.find((v) => v.key === section) ?? null;
  const open = records.find((r) => r.id === openId) ?? null;
  const titleOf = useMemo(() => makeTitleLookup(blueprint.entities, records), [blueprint.entities, records]);
  const pending = useMemo(() => { const t = computeToday(blueprint, records, now); return t.hoy.length + t.atrasado.length; }, [blueprint, records, now]);
  const entity = view?.entity ? blueprint.entities.find((e) => e.key === view.entity) : undefined;

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
  const toolList = tools.length > 0 && (
    <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
      {tools.map((t) => <NavButton key={t.key} icon={t.icon} label={t.label} badge={t.badge} active={t.active} onClick={() => { setMenu(false); t.onClick(); }} quiet />)}
    </div>
  );
  const brand = (
    <div className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: '#c7d8ad', color: '#173b2b' }}>{blueprint.name.slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-white">{blueprint.name}</span>
        <span className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--crm-nav-text)' }}>{blueprint.kind === 'erp' ? 'ERP' : 'CRM'}</span>
      </span>
    </div>
  );

  return (
    <RuntimeContext.Provider value={actions}>
      <div className={`relative flex h-full min-h-0 overflow-hidden ${className}`} style={themeVars()} data-app="statehubs">
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
            {entity && (
              <button onClick={() => create(entity.key)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium"
                style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{entity.label}</span><span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </header>
          <main className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5">
            {!view && <TodayView blueprint={blueprint} records={records} now={now} onOpen={(r) => setOpenId(r.id)} />}
            {view && view.type === 'worklist' && (
              <WorklistView blueprint={blueprint} view={view} records={records} dark={false} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && view.type === 'analysis' && (
              <AnalysisView blueprint={blueprint} view={view} records={records} dark={false} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
            {view && view.type !== 'worklist' && view.type !== 'analysis' && (
              <ViewBody blueprint={blueprint} view={view} records={records} dark={false} titleOf={titleOf} selectedId={openId}
                onOpen={(r) => setOpenId(r.id)} onCreate={create} onUpdate={onUpdate} />
            )}
          </main>
        </div>

        {open && (
          <div className="absolute inset-0 z-30 flex justify-end" style={{ background: 'rgba(28,26,22,.22)' }} onClick={() => setOpenId(null)}>
            <div className="h-full w-full max-w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ borderLeft: '1px solid var(--crm-border)' }}>
              <RecordPanel blueprint={blueprint} record={open} records={records} titleOf={titleOf}
                groupBy={blueprint.views.find((v) => v.entity === open.entity && v.groupBy)?.groupBy}
                onUpdate={onUpdate} onDelete={(id) => { onDelete(id); setOpenId(null); }} onClose={() => setOpenId(null)} />
            </div>
          </div>
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
      <Icon className="h-4 w-4 shrink-0" style={active ? { color: '#c7d8ad' } : undefined} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && <span className="rounded-full px-1.5 text-[0.78em] font-semibold" style={{ background: active ? '#557b5d' : 'rgba(255,255,255,.1)', color: '#fff' }}>{badge}</span>}
    </button>
  );
}
