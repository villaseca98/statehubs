import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { AppRecord, Entity, Field } from '@shared/blueprint/types.ts';
import {
  WEEKDAY_SHORT, addDays, assignLanes, barGeometry, findConflicts, localDay, nights, periodFor, periodLabel, rowStats, shiftAnchor, toStays, weekday, isWeekend,
} from '@/lib/crm/timeline';
import type { Stay, TimelineMode } from '@/lib/crm/timeline';
import { SOLID, titleOfRecord } from './theme';
import type { ViewProps } from './views';

// Bookings calendar: one row per property, one column per day and a bar per
// booking, coloured by channel. Overlaps are flagged in red. Click a bar to
// open the booking, click an empty day to start one there. The column with
// the property names stays put while the days scroll sideways.

export interface TimelineViewProps extends ViewProps {
  // Reads the Airbnb/Booking calendars; returns a line to show. No button without it.
  onSync?: () => Promise<string> | string;
  now?: Date;
}

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const MODES: { key: TimelineMode; label: string }[] = [{ key: 'dia', label: 'Día' }, { key: 'semana', label: 'Semana' }, { key: 'mes', label: 'Mes' }];
const DAY_MIN: Record<TimelineMode, number> = { dia: 240, semana: 92, mes: 30 };
const LANE = 30;
const CONFLICT = SOLID.red;
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (v: number) => `${Math.round(v * 100)} %`;
const shortDate = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const tint = (v: string, p: number) => `color-mix(in srgb, ${v} ${p}%, transparent)`;

export function TimelineView(props: TimelineViewProps) {
  const { blueprint, view } = props;
  const entity = blueprint.entities.find((e) => e.key === view.entity);
  const rowField = entity?.fields.find((f) => f.key === view.rowField && f.type === 'relation');
  const rowEntity = blueprint.entities.find((e) => e.key === rowField?.relation);
  if (!entity || !rowField || !rowEntity || !view.startField || !view.endField) {
    return <p style={{ ...card, padding: 'var(--crm-pad)', color: 'var(--crm-muted)' }}>A este calendario le falta saber qué filas y qué fechas usar.</p>;
  }
  return <Timeline {...props} entity={entity} rowField={rowField} rowEntity={rowEntity} startKey={view.startField} endKey={view.endField} />;
}

function Timeline({ view, records, onOpen, onCreate, onSync, now, entity, rowField, rowEntity, startKey, endKey }: TimelineViewProps & { entity: Entity; rowField: Field; rowEntity: Entity; startKey: string; endKey: string }) {
  const today = localDay(now ?? new Date());
  const [mode, setMode] = useState<TimelineMode>('mes');
  const [anchor, setAnchor] = useState(today);
  const [showAll, setShowAll] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const group = entity.fields.find((f) => f.key === view.groupBy && f.type === 'select');
  const status = entity.fields.find((f) => f.type === 'select' && f.options?.some((o) => o.value === 'cancelada' || o.value === 'bloqueo'));
  const kind = rowEntity.fields.find((f) => f.key === 'operacion' && f.options?.some((o) => o.value === 'turistico'));
  const period = useMemo(() => periodFor(mode, anchor), [mode, anchor]);
  const n = period.days.length;

  const rows = useMemo(() => records.filter((r) => r.entity === rowEntity.key && (showAll || !kind || r.data[kind.key] === 'turistico')), [records, rowEntity.key, showAll, kind]);
  const hiddenRows = kind && !showAll ? records.filter((r) => r.entity === rowEntity.key).length - rows.length : 0;
  const stays = useMemo(() => toStays(records, entity.key, { row: rowField.key, start: startKey, end: endKey, status: status?.key }), [records, entity.key, rowField.key, startKey, endKey, status?.key]);
  const conflicts = useMemo(() => findConflicts(stays), [stays]);
  const byRow = useMemo(() => {
    const m = new Map<string, Stay[]>();
    for (const s of stays) m.set(s.row, [...(m.get(s.row) ?? []), s]);
    return m;
  }, [stays]);

  const visible = (s: Stay) => (!s.cancelled || showCancelled) && barGeometry(s, period) !== null;
  const rowIds = new Set(rows.map((r) => r.id));
  const clashing = new Set(stays.filter((s) => rowIds.has(s.row) && conflicts.has(s.record.id) && barGeometry(s, period)).map((s) => s.record.id)).size;
  const stats = new Map(rows.map((r) => [r.id, rowStats(byRow.get(r.id) ?? [], period)]));
  const totalNights = [...stats.values()].reduce((a, s) => a + s.nights, 0);
  const totalNet = [...stats.values()].reduce((a, s) => a + s.net, 0);

  // Bring today into view when the days don't fit (phones, month view).
  useEffect(() => {
    const box = scroller.current;
    const cell = box?.querySelector<HTMLElement>(`[data-day="${today}"]`);
    const name = box?.querySelector<HTMLElement>('[data-namecol]');
    if (!box || !cell || !name || typeof box.scrollTo !== 'function') return;
    box.scrollTo({ left: Math.max(0, cell.offsetLeft - name.offsetWidth - 2 * cell.offsetWidth) });
  }, [today, mode, period.start]);

  const sync = async () => {
    if (!onSync) return;
    setSyncing(true);
    setSyncNote(null);
    try { setSyncNote((await onSync()) || 'Calendarios al día.'); } catch (e) { setSyncNote((e as Error).message || 'No se pudo sincronizar.'); }
    setSyncing(false);
  };
  const createAt = (row: AppRecord, day: string) => onCreate(entity.key, { [rowField.key]: row.id, [startKey]: day, [endKey]: addDays(day, 1) });

  const barStyle = (s: Stay, clippedStart: boolean, clippedEnd: boolean): CSSProperties => {
    const color = group?.options?.find((o) => o.value === s.record.data[group.key])?.color ?? 'gray';
    const radius = `${clippedStart ? 2 : 8}px ${clippedEnd ? 2 : 8}px ${clippedEnd ? 2 : 8}px ${clippedStart ? 2 : 8}px`;
    if (s.cancelled) return { borderRadius: radius, border: '1px dashed var(--crm-muted)', color: 'var(--crm-muted)', background: 'var(--crm-surface)', textDecoration: 'line-through' };
    const base: CSSProperties = s.block
      ? { background: `repeating-linear-gradient(135deg, ${tint('var(--crm-muted)', 28)} 0 6px, ${tint('var(--crm-muted)', 12)} 6px 12px)`, color: 'var(--crm-text)' }
      : { background: SOLID[color], color: '#fff' };
    return { ...base, borderRadius: radius, ...(conflicts.has(s.record.id) ? { outline: `2px solid ${CONFLICT}`, outlineOffset: 1 } : {}) };
  };

  return (
    <div className="flex flex-col" style={{ gap: 'var(--crm-gap)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
        <div className="flex shrink-0 items-center gap-0.5">
          <button aria-label="Anterior" onClick={() => setAnchor((a) => shiftAnchor(mode, a, -1))} className="rounded-lg p-1.5 hover:bg-black/5"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setAnchor(today)} className="rounded-lg px-2.5 py-1 font-medium hover:bg-black/5" style={{ border: '1px solid var(--crm-border)' }}>Hoy</button>
          <button aria-label="Siguiente" onClick={() => setAnchor((a) => shiftAnchor(mode, a, 1))} className="rounded-lg p-1.5 hover:bg-black/5"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h2 className="min-w-0 flex-1 truncate font-semibold first-letter:uppercase" aria-live="polite">{periodLabel(mode, period)}</h2>
        </div>
        <div role="radiogroup" aria-label="Escala" className="inline-flex rounded-lg p-0.5" style={{ background: tint('var(--crm-border)', 70) }}>
          {MODES.map((m) => (
            <button key={m.key} role="radio" aria-checked={mode === m.key} onClick={() => setMode(m.key)}
              className="rounded-md px-3 py-1 text-[0.92em] font-medium transition"
              style={mode === m.key ? { background: 'var(--crm-surface)', color: 'var(--crm-text)', boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { color: 'var(--crm-muted)' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.92em]">
        <span style={{ color: 'var(--crm-muted)' }}>Ocupación <b style={{ color: 'var(--crm-text)' }}>{pct(rows.length ? totalNights / (rows.length * n) : 0)}</b></span>
        <span style={{ color: 'var(--crm-muted)' }}>Neto <b style={{ color: 'var(--crm-text)' }}>{euros.format(totalNet)}</b></span>
        {clashing > 0 && (
          <span role="alert" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium" style={{ background: tint(CONFLICT, 12), color: CONFLICT }}>
            <AlertTriangle className="h-3.5 w-3.5" /> {clashing} {clashing === 1 ? 'reserva se solapa' : 'reservas se solapan'}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
          {kind && (
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} style={{ accentColor: 'var(--crm-primary)' }} /> Ver todos
            </label>
          )}
          {status && (
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} style={{ accentColor: 'var(--crm-primary)' }} /> Ver canceladas
            </label>
          )}
          {onSync && (
            <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium disabled:opacity-60" style={{ border: '1px solid var(--crm-border)', background: 'var(--crm-surface)' }}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando…' : 'Sincronizar Airbnb y Booking'}
            </button>
          )}
        </span>
      </div>
      {syncNote && <p role="status" className="text-[0.92em]" style={{ ...card, padding: '8px 12px' }}>{syncNote}</p>}

      <div ref={scroller} className="max-w-full overflow-x-auto" style={card} aria-label={`Calendario de ${entity.labelPlural.toLowerCase()}`} role="region">
        <div className="relative inline-flex min-w-full flex-col">
          <div className="flex" style={{ borderBottom: '1px solid var(--crm-border)' }}>
            <NameCell header>
              <span className="text-[0.85em] font-medium" style={{ color: 'var(--crm-muted)' }}>{rowEntity.labelPlural} · {rows.length}</span>
            </NameCell>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(${DAY_MIN[mode]}px, 1fr))` }}>
              {period.days.map((d) => (
                <div key={d} data-day={d} className="flex flex-col items-center py-1.5 text-center leading-tight"
                  style={{ background: d === today ? tint('var(--crm-primary)', 8) : isWeekend(d) ? tint('var(--crm-border)', 45) : undefined, borderLeft: '1px solid var(--crm-border)' }}>
                  <span className="text-[0.72em] uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>{WEEKDAY_SHORT[weekday(d)]}</span>
                  <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[0.9em] font-medium"
                    style={d === today ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : undefined}
                    aria-current={d === today ? 'date' : undefined}>
                    {mode === 'dia' ? shortDate(d) : Number(d.slice(8, 10))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => {
            const mine = (byRow.get(row.id) ?? []).filter(visible);
            const { lane, lanes } = assignLanes(mine);
            const st = stats.get(row.id)!;
            const title = titleOfRecord(rowEntity, row.data);
            const rowClash = mine.some((s) => conflicts.has(s.record.id) && !s.cancelled);
            return (
              <div key={row.id} className="flex" style={{ borderBottom: '1px solid var(--crm-border)' }}>
                <NameCell>
                  <button onClick={() => onOpen(row)} className="block w-full min-w-0 text-left" title={title}>
                    {/* «Loft Carmen · C/ Quart 40» → the name; the address is in the tooltip. */}
                    <span className="block truncate font-medium">{title.split(' · ')[0]}</span>
                    <span className="block truncate text-[0.8em]" style={{ color: 'var(--crm-muted)' }}>{pct(st.occupancy)} · {euros.format(st.net)}</span>
                    {rowClash && <span className="mt-0.5 flex items-center gap-1 text-[0.8em] font-medium" style={{ color: CONFLICT }}><AlertTriangle className="h-3 w-3 shrink-0" />Se solapan</span>}
                  </button>
                </NameCell>
                <div className="relative flex-1" style={{ minHeight: lanes * LANE + 14, minWidth: n * DAY_MIN[mode] }}>
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(${DAY_MIN[mode]}px, 1fr))` }}>
                    {period.days.map((d) => (
                      <button key={d} tabIndex={-1} aria-label={`Nueva ${entity.label.toLowerCase()} en ${title} el ${shortDate(d)}`} onClick={() => createAt(row, d)}
                        className="h-full transition hover:bg-black/[.04]"
                        style={{ background: d === today ? tint('var(--crm-primary)', 6) : isWeekend(d) ? tint('var(--crm-border)', 35) : undefined, borderLeft: '1px solid var(--crm-border)' }} />
                    ))}
                  </div>
                  {mine.map((s) => {
                    const g = barGeometry(s, period)!;
                    const guest = titleOfRecord(entity, s.record.data);
                    const nn = nights(s);
                    const clash = conflicts.has(s.record.id) && !s.cancelled;
                    const label = s.block ? `Bloqueo · ${guest}` : guest;
                    return (
                      <button key={s.record.id} onClick={() => onOpen(s.record)}
                        aria-label={`${label}, ${nn} ${nn === 1 ? 'noche' : 'noches'}, del ${shortDate(s.start)} al ${shortDate(s.end)}${s.cancelled ? ', cancelada' : ''}${clash ? '. Se solapa con otra reserva' : ''}`}
                        title={clash ? 'Se solapan: dos reservas en las mismas noches' : undefined}
                        className="absolute flex items-center gap-1 overflow-hidden whitespace-nowrap px-2 text-left text-[0.84em] font-medium shadow-sm transition hover:brightness-95"
                        style={{ left: `calc(${(g.left / n) * 100}% + 1px)`, width: `calc(${(g.width / n) * 100}% - 2px)`, top: 7 + (lane.get(s.record.id) ?? 0) * LANE, height: LANE - 4, ...barStyle(s, g.clippedStart, g.clippedEnd) }}>
                        {clash && <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: s.block ? CONFLICT : '#fff' }} aria-hidden />}
                        <span className="truncate">{s.block ? 'Bloqueo' : guest}</span>
                        {!s.block && <span className="shrink-0 opacity-80">· {nn} n.</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="p-6 text-center" style={{ color: 'var(--crm-muted)' }}>
              {hiddenRows > 0
                ? <>Ningún {rowEntity.label.toLowerCase()} es de alquiler turístico. <button onClick={() => setShowAll(true)} className="underline">Ver todos</button></>
                : <>Todavía no hay {rowEntity.labelPlural.toLowerCase()}. Añade uno para ver aquí sus {entity.labelPlural.toLowerCase()}.</>}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.88em]" style={{ color: 'var(--crm-muted)' }} aria-label="Leyenda">
        {group?.options?.map((o) => (
          <span key={o.value} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full" style={{ background: SOLID[o.color ?? 'gray'] }} />{o.label}</span>
        ))}
        {status?.options?.some((o) => o.value === 'bloqueo') && (
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full" style={{ background: `repeating-linear-gradient(135deg, ${tint('var(--crm-muted)', 40)} 0 3px, ${tint('var(--crm-muted)', 15)} 3px 6px)` }} />Bloqueo</span>
        )}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full" style={{ outline: `2px solid ${CONFLICT}`, outlineOffset: -1 }} />Se solapan</span>
        <span>Clic en un día libre para crear una {entity.label.toLowerCase()}.</span>
      </div>
      {onSync && (
        <p className="text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>
          Las reservas llegan por el calendario iCal de cada anuncio (al pulsar Sincronizar). Precios y mensajes no se sincronizan.
        </p>
      )}
    </div>
  );
}

function NameCell({ children, header }: { children: ReactNode; header?: boolean }) {
  return (
    <div data-namecol="" className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center px-3 md:w-[200px]"
      style={{ background: 'var(--crm-surface)', borderRight: '1px solid var(--crm-border)', paddingTop: header ? 6 : 8, paddingBottom: header ? 6 : 8, boxShadow: '4px 0 6px -4px rgba(0,0,0,.08)' }}>
      {children}
    </div>
  );
}
