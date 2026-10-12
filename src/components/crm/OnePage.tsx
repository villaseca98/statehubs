import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react';
import type { AppRecord, Blueprint, Field, RecordData, View } from '@shared/blueprint/types.ts';
import { isoDay } from '@shared/blueprint/slots.ts';
import { chipStyle, formatMoney, formatValue, isNumeric, titleOfRecord } from './theme';
import { Cell, Chip, KanbanView } from './views';
import { WorklistView } from './WorklistView';
import { AnalysisView } from './AnalysisView';

// The house layout: the whole business on one page. Key figures on top,
// then every screen as a panel (work lists and boards full width, tables
// and the agenda side by side). Nothing to switch between; a record opens
// in a drawer and the page stays where it was.

interface Props {
  blueprint: Blueprint;
  records: AppRecord[];
  titleOf: (id: string) => string | undefined;
  openId: string | null;
  onOpen: (r: AppRecord) => void;
  onCreate: (entity: string, data?: RecordData) => void;
  onUpdate: (id: string, data: RecordData) => void;
}

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const WIDE = new Set(['worklist', 'kanban', 'analysis']);

function aggregate(rs: AppRecord[], agg: string, field?: string) {
  if (agg === 'count') return rs.length;
  const vals = rs.map((r) => Number(r.data[field ?? '']) || 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  return agg === 'avg' ? (vals.length ? sum / vals.length : 0) : sum;
}

export function OnePage({ blueprint, records, titleOf, openId, onOpen, onCreate, onUpdate }: Props) {
  const dark = false;
  const solid = false;
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const dashboard = blueprint.views.find((v) => v.type === 'dashboard');
  const panels = blueprint.views.filter((v) => v.type !== 'dashboard');

  // One search box filters every panel at once.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const e = blueprint.entities.find((x) => x.key === r.entity);
      return e?.fields.some((f) => formatValue(f, r.data[f.key], titleOf).toLowerCase().includes(q));
    });
  }, [records, query, blueprint.entities, titleOf]);

  const metrics = dashboard?.widgets?.filter((w) => w.kind === 'metric') ?? [];
  const bars = dashboard?.widgets?.filter((w) => w.kind === 'bars') ?? [];
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const jump = (k: string) => document.getElementById(`panel-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ background: 'var(--crm-nav-bg)', color: 'var(--crm-nav-text)' }}>
        <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--crm-nav-active)', fontFamily: 'var(--crm-heading-font)' }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>{blueprint.name.slice(0, 1)}</span>
          {blueprint.name}
          {blueprint.kind && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ border: '1px solid currentColor', opacity: 0.7 }}>{blueprint.kind}</span>}
        </span>
        <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Secciones">
          {panels.map((v) => (
            <button key={v.key} onClick={() => jump(v.key)} className="whitespace-nowrap rounded-full px-2.5 py-1 text-[0.9em] hover:opacity-100" style={{ opacity: 0.85 }}>{v.label}</button>
          ))}
        </nav>
        <label className="flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'color-mix(in srgb, var(--crm-nav-text) 14%, transparent)' }}>
          <Search className="h-3.5 w-3.5" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en todo" className="w-36 bg-transparent outline-none placeholder:opacity-70" style={{ color: 'var(--crm-nav-active)' }} />
        </label>
        <div className="relative">
          <button onClick={() => setNewOpen((o) => !o)} aria-haspopup="menu" aria-expanded={newOpen} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>
            <Plus className="h-4 w-4" /> Nuevo
          </button>
          {newOpen && (
            <div role="menu" aria-label="Crear nuevo" className="absolute right-0 top-10 z-30 w-48 overflow-hidden shadow-xl" style={{ ...card, color: 'var(--crm-text)' }} onMouseLeave={() => setNewOpen(false)}>
              {blueprint.entities.map((e) => (
                <button key={e.key} role="menuitem" onClick={() => { setNewOpen(false); onCreate(e.key); }} className="block w-full px-3 py-2 text-left hover:opacity-80" style={{ borderBottom: '1px solid var(--crm-border)' }}>{e.label}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto" style={{ padding: 'var(--crm-pad)' }}>
        {metrics.length > 0 && (
          <section className="mb-4 grid grid-cols-2 md:grid-cols-4" style={{ gap: 'var(--crm-gap)' }} aria-label="Cifras">
            {metrics.map((w) => {
              const e = blueprint.entities.find((x) => x.key === w.entity);
              const f = e?.fields.find((x) => x.key === w.field);
              const v = aggregate(records.filter((r) => r.entity === w.entity), w.agg, w.field);
              const text = w.agg === 'count' || !f ? String(Math.round(v)) : f.type === 'money' ? formatMoney(v) : formatValue(f, v);
              return (
                <div key={w.label} className="relative overflow-hidden" style={{ ...card, padding: 'var(--crm-pad)' }}>
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: 'var(--crm-primary)' }} />
                  <div className="text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>{w.label}</div>
                  <div className="mt-1 text-[1.7em] font-semibold leading-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{text}</div>
                </div>
              );
            })}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12" style={{ gap: 'var(--crm-gap)', gridAutoFlow: 'row dense' }}>
          {panels.map((v) => {
            const entity = blueprint.entities.find((e) => e.key === v.entity);
            const count = shown.filter((r) => r.entity === v.entity).length;
            const isClosed = closed.has(v.key);
            return (
              <section key={v.key} id={`panel-${v.key}`} aria-label={v.label} className={`${WIDE.has(v.type) ? 'lg:col-span-12' : 'lg:col-span-6'} scroll-mt-4`} style={{ ...card, padding: 'var(--crm-pad)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button onClick={() => toggle(v.key)} className="flex items-center gap-2 text-left" aria-expanded={!isClosed}>
                    {isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <h2 className="text-[1.15em] font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{v.label}</h2>
                    {v.entity && <span className="rounded-full px-2 text-[0.85em]" style={{ background: 'color-mix(in srgb, var(--crm-border) 70%, transparent)', color: 'var(--crm-muted)' }}>{count}</span>}
                  </button>
                  {entity && (
                    <button onClick={() => onCreate(entity.key)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.9em]" style={{ border: '1px solid var(--crm-border)' }}>
                      <Plus className="h-3.5 w-3.5" /> {entity.label}
                    </button>
                  )}
                </div>
                {!isClosed && (
                  // The analysis always reads everything; the search box only narrows the lists.
                  <PanelBody view={v} blueprint={blueprint} records={v.type === 'analysis' ? records : shown} dark={dark} solid={solid} titleOf={titleOf} openId={openId}
                    onOpen={onOpen} onCreate={(e, d) => onCreate(e, d)} onUpdate={onUpdate} />
                )}
              </section>
            );
          })}

          {bars.map((w) => {
            const e = blueprint.entities.find((x) => x.key === w.entity)!;
            const group = e.fields.find((f) => f.key === w.groupBy);
            if (!group) return null;
            const mine = records.filter((r) => r.entity === w.entity);
            const rows = (group.options ?? []).map((o) => ({ o, v: aggregate(mine.filter((r) => r.data[group.key] === o.value), w.agg, w.field) }));
            const max = Math.max(1, ...rows.map((r) => r.v));
            const f = e.fields.find((x) => x.key === w.field);
            return (
              <section key={w.label} className="lg:col-span-4" style={{ ...card, padding: 'var(--crm-pad)' }} aria-label={w.label}>
                <h2 className="mb-3 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{w.label}</h2>
                <div className="flex flex-col gap-2">
                  {rows.map(({ o, v }) => (
                    <div key={o.value} className="grid grid-cols-[100px_1fr_auto] items-center gap-2 text-[0.9em]">
                      <span className="truncate" style={{ color: 'var(--crm-muted)' }}>{o.label}</span>
                      <span className="h-2.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--crm-border) 60%, transparent)' }}>
                        <span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, ...chipStyle(o.color, dark, true) }} />
                      </span>
                      <span style={{ fontFamily: 'var(--crm-number-font)' }}>{w.agg === 'count' || !f ? v : f.type === 'money' ? formatMoney(v) : formatValue(f, v)}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

interface BodyProps {
  view: View; blueprint: Blueprint; records: AppRecord[]; dark: boolean; solid: boolean;
  titleOf: (id: string) => string | undefined; openId: string | null;
  onOpen: (r: AppRecord) => void; onCreate: (entity: string, data: RecordData) => void; onUpdate: (id: string, data: RecordData) => void;
}

function PanelBody(p: BodyProps) {
  const common = { blueprint: p.blueprint, view: p.view, records: p.records, dark: p.dark, solid: p.solid, titleOf: p.titleOf, selectedId: p.openId, onOpen: p.onOpen, onCreate: p.onCreate, onUpdate: p.onUpdate };
  if (p.view.type === 'worklist') return <WorklistView {...common} />;
  if (p.view.type === 'analysis') return <AnalysisView {...common} />;
  if (p.view.type === 'kanban') return <KanbanView {...common} />;
  if (p.view.type === 'calendar') return <AgendaList {...p} />;
  return <CompactTable {...p} />;
}

// Tables in the one-page layout: the first rows, expandable, sortable by the first numeric column.
function CompactTable({ view, blueprint, records, dark, solid, titleOf, openId, onOpen }: BodyProps) {
  const entity = blueprint.entities.find((e) => e.key === view.entity)!;
  const [all, setAll] = useState(false);
  const cols = (view.columns?.length ? view.columns : entity.fields.map((f) => f.key)).map((k) => entity.fields.find((f) => f.key === k)).filter((f): f is Field => !!f).slice(0, 5);
  const mine = records.filter((r) => r.entity === entity.key);
  const rows = all ? mine : mine.slice(0, 6);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>{cols.map((f) => <th key={f.key} className="whitespace-nowrap font-medium" style={{ padding: 'var(--crm-row)', color: 'var(--crm-muted)', borderBottom: '1px solid var(--crm-border)', textAlign: isNumeric(f) ? 'right' : 'left' }}>{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer" style={{ background: r.id === openId ? 'color-mix(in srgb, var(--crm-primary) 10%, transparent)' : undefined }}>
                {cols.map((f, i) => {
                  const low = entity.fields.some((x) => x.key === 'minimo') && f.key === 'stock' && Number(r.data.stock) < Number(r.data.minimo);
                  // Documents that expire: red once past, amber within a month.
                  const due = f.key === 'caduca' && typeof r.data.caduca === 'string' && r.data.caduca ? (r.data.caduca < isoDay(new Date()) ? 'caducado' : r.data.caduca <= isoDay(new Date(Date.now() + 30 * 864e5)) ? 'caduca pronto' : null) : null;
                  return (
                    <td key={f.key} className="whitespace-nowrap" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', fontWeight: i === 0 ? 500 : undefined, textAlign: isNumeric(f) ? 'right' : 'left', color: low ? '#dc2626' : undefined }}>
                      {f.type === 'select' ? <Chip field={f} value={r.data[f.key]} dark={dark} solid={solid} /> : <Cell field={f} value={r.data[f.key]} dark={dark} titleOf={titleOf} />}
                      {low && <span className="ml-1 text-[0.8em]">bajo mínimo</span>}
                      {due && <span className="ml-1.5 rounded px-1.5 text-[0.8em]" style={chipStyle(due === 'caducado' ? 'red' : 'amber', dark)}>{due}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 'var(--crm-row)', color: 'var(--crm-muted)' }}>Nada todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      {mine.length > 6 && (
        <button onClick={() => setAll((a) => !a)} className="mt-2 text-[0.9em]" style={{ color: 'var(--crm-primary)' }}>
          {all ? 'Ver menos' : `Ver los ${mine.length}`}
        </button>
      )}
    </div>
  );
}

// The agenda as a list of what's coming (and what slipped), grouped by day.
function AgendaList({ view, blueprint, records, dark, onOpen }: BodyProps) {
  const entity = blueprint.entities.find((e) => e.key === view.entity)!;
  const key = view.dateField!;
  const field = entity.fields.find((f) => f.key === key)!;
  const kind = entity.fields.find((f) => f.type === 'select');
  const today = isoDay(new Date());
  const items = records.filter((r) => r.entity === entity.key && r.data[key]).sort((a, b) => String(a.data[key]).localeCompare(String(b.data[key])));
  const upcoming = items.filter((r) => String(r.data[key]).slice(0, 10) >= today).slice(0, 8);
  const groups = new Map<string, AppRecord[]>();
  for (const r of upcoming) { const d = String(r.data[key]).slice(0, 10); groups.set(d, [...(groups.get(d) ?? []), r]); }
  const dayLabel = (d: string) => (d === today ? 'Hoy' : new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }));
  return (
    <div className="flex flex-col gap-3">
      {upcoming.length === 0 && <div style={{ color: 'var(--crm-muted)' }}>Nada a la vista.</div>}
      {[...groups].map(([d, rs]) => (
        <div key={d}>
          <div className="mb-1 text-[0.85em] font-semibold uppercase tracking-wide" style={{ color: d === today ? 'var(--crm-primary)' : 'var(--crm-muted)' }}>{dayLabel(d)}</div>
          <ul className="flex flex-col gap-1">
            {rs.map((r) => {
              const opt = kind?.options?.find((o) => o.value === r.data[kind.key]);
              const time = field.type === 'datetime' ? String(r.data[key]).slice(11, 16) : '';
              return (
                <li key={r.id}>
                  <button onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left" style={{ border: '1px solid var(--crm-border)' }}>
                    <span className="w-11 shrink-0 font-semibold" style={{ fontFamily: 'var(--crm-number-font)' }}>{time || '—'}</span>
                    <span className="h-6 w-1 shrink-0 rounded-full" style={chipStyle(opt?.color ?? 'blue', dark, true)} />
                    <span className="min-w-0 flex-1 truncate">{titleOfRecord(entity, r.data)}</span>
                    {opt && <span className="hidden text-[0.85em] sm:inline" style={{ color: 'var(--crm-muted)' }}>{opt.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
