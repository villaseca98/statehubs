import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, Search } from 'lucide-react';
import type { AppRecord, Blueprint, Entity, Field, View, RecordData } from '@shared/blueprint/types.ts';
import { chipStyle, formatMoney, formatValue, isNumeric, titleOfRecord } from './theme';

export interface ViewProps {
  blueprint: Blueprint;
  view: View;
  records: AppRecord[];
  dark: boolean;
  solid?: boolean;
  /** The section already has the filter bar above it: no own search box. */
  filtered?: boolean;
  titleOf: (id: string) => string | undefined;
  selectedId?: string | null;
  onOpen: (r: AppRecord) => void;
  onCreate: (entity: string, data: RecordData) => void;
  onUpdate: (id: string, data: RecordData) => void;
}

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;

export function Chip({ field, value, dark, solid }: { field: Field; value: unknown; dark: boolean; solid?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  const opt = field.options?.find((o) => o.value === value);
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.85em] font-medium" style={chipStyle(opt?.color, dark, solid)}>
      {opt?.label ?? String(value)}
    </span>
  );
}

export function Cell({ field, value, dark, solid, titleOf }: { field: Field; value: unknown; dark: boolean; solid?: boolean; titleOf: (id: string) => string | undefined }) {
  if (field.type === 'select') return <Chip field={field} value={value} dark={dark} solid={solid} />;
  if (field.type === 'percent' && typeof value === 'number') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: 'var(--crm-border)' }}>
          <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: 'var(--crm-primary)' }} />
        </span>
        <span style={{ fontFamily: 'var(--crm-number-font)' }}>{formatValue(field, value)}</span>
      </span>
    );
  }
  const text = formatValue(field, value, titleOf);
  if (field.type === 'relation' && text) return <span style={{ color: 'var(--crm-primary)' }}>{text}</span>;
  if (isNumeric(field)) return <span style={{ fontFamily: 'var(--crm-number-font)' }}>{text}</span>;
  if (field.type === 'email' && text) return <a href={`mailto:${text}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--crm-primary)' }}>{text}</a>;
  return <>{text}</>;
}

const entityOf = (bp: Blueprint, key?: string) => bp.entities.find((e) => e.key === key) as Entity;

export function TableView({ blueprint, view, records, dark, solid, filtered, titleOf, selectedId, onOpen }: ViewProps) {
  const entity = entityOf(blueprint, view.entity);
  const columns = (view.columns?.length ? view.columns : entity.fields.slice(0, 6).map((f) => f.key))
    .map((k) => entity.fields.find((f) => f.key === k))
    .filter(Boolean) as Field[];
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = records.filter((r) => r.entity === entity.key);
    if (q) list = list.filter((r) => entity.fields.some((f) => formatValue(f, r.data[f.key], titleOf).toLowerCase().includes(q)));
    if (sort) {
      const f = entity.fields.find((x) => x.key === sort.key)!;
      list = [...list].sort((a, b) => {
        const va = a.data[sort.key];
        const vb = b.data[sort.key];
        if (isNumeric(f)) return ((Number(va) || 0) - (Number(vb) || 0)) * sort.dir;
        return formatValue(f, va, titleOf).localeCompare(formatValue(f, vb, titleOf), 'es') * sort.dir;
      });
    }
    return list;
  }, [records, entity, query, sort, titleOf]);

  const totals = columns.map((f) => (f.type === 'money' || f.type === 'number' ? rows.reduce((s, r) => s + (Number(r.data[f.key]) || 0), 0) : null));

  return (
    <div className="flex flex-col" style={{ gap: 'var(--crm-gap)' }}>
      {!filtered && (
        <label className="flex max-w-xs items-center gap-2 px-2 py-1.5" style={card}>
          <Search className="h-3.5 w-3.5" style={{ color: 'var(--crm-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar en ${entity.labelPlural.toLowerCase()}`}
            className="w-full bg-transparent outline-none" style={{ color: 'var(--crm-text)' }} />
        </label>
      )}
      <div className="overflow-x-auto" style={card}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {columns.map((f) => (
                <th key={f.key} className="cursor-pointer select-none whitespace-nowrap font-medium" style={{ padding: 'var(--crm-row)', color: 'var(--crm-muted)', borderBottom: '1px solid var(--crm-border)' }}
                  onClick={() => setSort((s) => (s?.key === f.key ? { key: f.key, dir: s.dir === 1 ? -1 : 1 } : { key: f.key, dir: 1 }))}>
                  <span className="inline-flex items-center gap-1">{f.label}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer"
                style={{ background: r.id === selectedId ? 'color-mix(in srgb, var(--crm-primary) 10%, transparent)' : undefined }}>
                {columns.map((f, i) => (
                  <td key={f.key} className="whitespace-nowrap" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', fontWeight: i === 0 ? 500 : undefined }}>
                    <Cell field={f} value={r.data[f.key]} dark={dark} solid={solid} titleOf={titleOf} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} style={{ padding: 'var(--crm-pad)', color: 'var(--crm-muted)' }}>{filtered ? `No hay ${entity.labelPlural.toLowerCase()} que mostrar con estos filtros.` : `No hay ${entity.labelPlural.toLowerCase()} todavía.`}</td></tr>
            )}
          </tbody>
          {totals.some((t) => t !== null) && rows.length > 0 && (
            <tfoot>
              <tr>
                {columns.map((f, i) => (
                  <td key={f.key} style={{ padding: 'var(--crm-row)', color: 'var(--crm-muted)', fontFamily: 'var(--crm-number-font)' }}>
                    {i === 0 ? `${rows.length} ${rows.length === 1 ? entity.label.toLowerCase() : entity.labelPlural.toLowerCase()}` : totals[i] !== null ? formatValue(f, totals[i]) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function KanbanView({ blueprint, view, records, dark, solid, titleOf, onOpen, onUpdate, onCreate }: ViewProps) {
  const entity = entityOf(blueprint, view.entity);
  const group = entity.fields.find((f) => f.key === view.groupBy)!;
  const sum = entity.fields.find((f) => f.key === view.sumField);
  const shown = entity.fields.filter((f) => f.key !== group.key && f.key !== entity.titleField && f.type !== 'longtext').slice(0, 3);
  const [over, setOver] = useState<string | null>(null);
  const columns = [...(group.options ?? []).map((o) => ({ value: o.value as string | null, label: o.label, color: o.color })), { value: null, label: 'Sin asignar', color: 'gray' as const }];
  const mine = records.filter((r) => r.entity === entity.key);

  return (
    <div className="flex overflow-x-auto pb-2" style={{ gap: 'var(--crm-gap)' }}>
      {columns.map((col) => {
        const items = mine.filter((r) => (col.value === null ? !group.options?.some((o) => o.value === r.data[group.key]) : r.data[group.key] === col.value));
        if (col.value === null && items.length === 0) return null;
        const total = sum ? items.reduce((s, r) => s + (Number(r.data[sum.key]) || 0), 0) : null;
        return (
          <div key={col.label} className="flex w-64 shrink-0 flex-col"
            onDragOver={(e) => { e.preventDefault(); setOver(col.label); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id && col.value !== null) onUpdate(id, { [group.key]: col.value }); }}
            style={{ ...card, background: over === col.label ? 'color-mix(in srgb, var(--crm-primary) 8%, var(--crm-bg))' : 'color-mix(in srgb, var(--crm-border) 35%, var(--crm-bg))', borderStyle: over === col.label ? 'dashed' : 'solid' }}>
            <div className="flex items-center justify-between gap-2" style={{ padding: 'var(--crm-row)', ...(solid ? { ...chipStyle(col.color, dark, true), borderRadius: 'var(--crm-radius) var(--crm-radius) 0 0' } : {}) }}>
              <span className="flex items-center gap-2 font-semibold">
                <span className="h-2 w-2 rounded-full" style={chipStyle(col.color, dark, true)} />
                {col.label}
                <span className="font-normal" style={{ color: solid ? 'inherit' : 'var(--crm-muted)', opacity: solid ? 0.85 : 1 }}>{items.length}</span>
              </span>
              {total !== null && <span style={{ color: solid ? 'inherit' : 'var(--crm-muted)', fontFamily: 'var(--crm-number-font)' }}>{sum!.type === 'money' ? formatMoney(total) : formatValue(sum!, total)}</span>}
            </div>
            <div className="flex flex-col p-2" style={{ gap: '8px' }}>
              {items.map((r) => (
                <button key={r.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', r.id)} onClick={() => onOpen(r)}
                  className="text-left shadow-sm transition hover:-translate-y-px" style={{ ...card, padding: 'var(--crm-row)' }}>
                  <div className="font-medium">{titleOfRecord(entity, r.data)}</div>
                  {shown.map((f) => {
                    const v = r.data[f.key];
                    if (v === undefined || v === '' || v === null) return null;
                    return <div key={f.key} className="mt-1 truncate" style={{ color: 'var(--crm-muted)' }}><Cell field={f} value={v} dark={dark} titleOf={titleOf} /></div>;
                  })}
                </button>
              ))}
              {col.value !== null && (
                <button onClick={() => onCreate(entity.key, { [group.key]: col.value })} className="rounded px-2 py-1 text-left" style={{ color: 'var(--crm-muted)' }}>
                  + Añadir
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarView({ blueprint, view, records, dark, onOpen, onCreate }: ViewProps) {
  const entity = entityOf(blueprint, view.entity);
  const dateKey = view.dateField!;
  const color = entity.fields.find((f) => f.type === 'select');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const byDay = new Map<string, AppRecord[]>();
  for (const r of records) {
    if (r.entity !== entity.key || !r.data[dateKey]) continue;
    const k = String(r.data[dateKey]).slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const today = iso(new Date());
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div style={card}>
      <div className="flex items-center justify-between" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)' }}>
        <span className="font-semibold capitalize" style={{ fontFamily: 'var(--crm-heading-font)' }}>{month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        <span className="flex gap-1">
          <button aria-label="Mes anterior" onClick={() => shift(-1)} className="rounded p-1"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setMonth(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })} className="rounded px-2 text-[0.9em]">Hoy</button>
          <button aria-label="Mes siguiente" onClick={() => shift(1)} className="rounded p-1"><ChevronRight className="h-4 w-4" /></button>
        </span>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1 text-[0.85em]" style={{ color: 'var(--crm-muted)' }}>{d}</div>)}
        {days.map((d) => {
          const k = iso(d);
          const items = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div key={k} onDoubleClick={() => onCreate(entity.key, { [dateKey]: k })} className="min-h-[84px] p-1"
              style={{ borderTop: '1px solid var(--crm-border)', borderLeft: d.getDay() === 1 ? undefined : '1px solid var(--crm-border)', opacity: inMonth ? 1 : 0.45 }}>
              <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.85em]"
                style={k === today ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { color: 'var(--crm-muted)' }}>{d.getDate()}</div>
              {items.map((r) => {
                const opt = color?.options?.find((o) => o.value === r.data[color.key]);
                return (
                  <button key={r.id} onClick={() => onOpen(r)} className="mb-1 block w-full truncate rounded px-1.5 py-0.5 text-left text-[0.85em]" style={chipStyle(opt?.color ?? 'blue', dark)}>
                    {titleOfRecord(entity, r.data)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function aggregate(records: AppRecord[], agg: string, field?: string) {
  if (agg === 'count') return records.length;
  const values = records.map((r) => Number(r.data[field ?? '']) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  return agg === 'avg' ? (values.length ? total / values.length : 0) : total;
}

export function DashboardView({ blueprint, view, records, dark }: ViewProps) {
  const widgets = view.widgets ?? [];
  const metrics = widgets.filter((w) => w.kind === 'metric');
  const bars = widgets.filter((w) => w.kind === 'bars');
  const show = (entity: Entity, agg: string, fieldKey: string | undefined, v: number) => {
    const f = entity.fields.find((x) => x.key === fieldKey);
    if (agg === 'count' || !f) return new Intl.NumberFormat('es-ES').format(Math.round(v));
    return f.type === 'money' ? formatMoney(v) : formatValue(f, Math.round(v * 100) / 100);
  };
  return (
    <div className="flex flex-col" style={{ gap: 'var(--crm-gap)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--crm-gap)' }}>
        {metrics.map((w) => {
          const entity = entityOf(blueprint, w.entity);
          const v = aggregate(records.filter((r) => r.entity === w.entity), w.agg, w.field);
          return (
            <div key={w.label} style={{ ...card, padding: 'var(--crm-pad)' }}>
              <div style={{ color: 'var(--crm-muted)' }}>{w.label}</div>
              <div className="mt-1 text-[1.9em] font-semibold leading-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{show(entity, w.agg, w.field, v)}</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--crm-gap)' }}>
        {bars.map((w) => {
          const entity = entityOf(blueprint, w.entity);
          const group = entity.fields.find((f) => f.key === w.groupBy)!;
          const mine = records.filter((r) => r.entity === w.entity);
          const rows = (group.options ?? []).map((o) => ({ o, v: aggregate(mine.filter((r) => r.data[group.key] === o.value), w.agg, w.field) }));
          const max = Math.max(1, ...rows.map((r) => r.v));
          return (
            <div key={w.label} style={{ ...card, padding: 'var(--crm-pad)' }}>
              <div className="mb-3 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{w.label}</div>
              <div className="flex flex-col gap-2">
                {rows.map(({ o, v }) => (
                  <div key={o.value} className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
                    <span className="truncate" style={{ color: 'var(--crm-muted)' }}>{o.label}</span>
                    <span className="h-3 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--crm-border) 60%, transparent)' }}>
                      <span className="block h-full rounded-full transition-all" style={{ width: `${(v / max) * 100}%`, ...chipStyle(o.color, dark, true) }} />
                    </span>
                    <span className="text-right" style={{ fontFamily: 'var(--crm-number-font)' }}>{show(entity, w.agg, w.field, v)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ViewBody(props: ViewProps) {
  switch (props.view.type) {
    case 'table': return <TableView {...props} />;
    case 'kanban': return <KanbanView {...props} />;
    case 'calendar': return <CalendarView {...props} />;
    case 'dashboard': return <DashboardView {...props} />;
    default: return null;
  }
}
