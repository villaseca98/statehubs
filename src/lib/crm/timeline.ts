import type { AppRecord } from '@shared/blueprint/types.ts';

// The bookings calendar (view `timeline`): one row per property, one column
// per day, one bar per booking. A booking takes nights: it starts in the
// afternoon of check-in and ends in the morning of check-out, so the bar runs
// from the middle of the check-in day to the middle of the check-out day and
// back-to-back stays meet on the changeover day. Dates are «YYYY-MM-DD»;
// everything here works on whole days in UTC so summer time never shifts them.

export type TimelineMode = 'dia' | 'semana' | 'mes';

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const toNum = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY;
const fromNum = (n: number) => { const d = new Date(n * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
export const dayOf = (v: unknown) => (isDay(v) ? v.slice(0, 10) : null);
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (day: string, n: number) => fromNum(toNum(day) + n);
export const daysBetween = (from: string, to: string) => toNum(to) - toNum(from);
// 0 = lunes … 6 = domingo
export const weekday = (day: string) => (new Date(toNum(day) * DAY).getUTCDay() + 6) % 7;
export const isWeekend = (day: string) => weekday(day) >= 5;

export interface Period { start: string; end: string; days: string[] } // end is exclusive

export function periodFor(mode: TimelineMode, anchor: string): Period {
  let start = anchor;
  let length = 1;
  if (mode === 'semana') { start = addDays(anchor, -weekday(anchor)); length = 7; }
  if (mode === 'mes') {
    start = `${anchor.slice(0, 8)}01`;
    const next = Number(anchor.slice(5, 7)) === 12 ? `${Number(anchor.slice(0, 4)) + 1}-01-01` : `${anchor.slice(0, 5)}${pad(Number(anchor.slice(5, 7)) + 1)}-01`;
    length = daysBetween(start, next);
  }
  const days = Array.from({ length }, (_, i) => addDays(start, i));
  return { start, end: addDays(start, length), days };
}

export function shiftAnchor(mode: TimelineMode, anchor: string, dir: 1 | -1): string {
  if (mode === 'dia') return addDays(anchor, dir);
  if (mode === 'semana') return addDays(anchor, 7 * dir);
  const y = Number(anchor.slice(0, 4));
  const m = Number(anchor.slice(5, 7)) - 1 + dir;
  return `${y + Math.floor(m / 12)}-${pad(((m % 12) + 12) % 12 + 1)}-01`;
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const asDate = (day: string) => new Date(toNum(day) * DAY);

export function periodLabel(mode: TimelineMode, p: Period): string {
  if (mode === 'mes') return MONTH.format(asDate(p.start));
  if (mode === 'dia') return LONG.format(asDate(p.start));
  const last = p.days[p.days.length - 1];
  return `${SHORT.format(asDate(p.start))} – ${SHORT.format(asDate(last))} ${last.slice(0, 4)}`;
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// What a booking needs to be drawn.
export interface Stay {
  record: AppRecord;
  row: string;        // property id
  start: string;      // check-in
  end: string;        // check-out
  cancelled: boolean;
  block: boolean;
}

export interface StayFields { row: string; start: string; end: string; status?: string }

export function toStays(records: AppRecord[], entity: string, f: StayFields): Stay[] {
  const out: Stay[] = [];
  for (const r of records) {
    if (r.entity !== entity) continue;
    const start = dayOf(r.data[f.start]);
    let end = dayOf(r.data[f.end]);
    const row = r.data[f.row];
    if (!start || typeof row !== 'string' || !row) continue;
    // No check-out yet, or a wrong one: draw it as one night so it can be seen and fixed.
    if (!end || end <= start) end = addDays(start, 1);
    const status = f.status ? String(r.data[f.status] ?? '') : '';
    out.push({ record: r, row, start, end, cancelled: status === 'cancelada', block: status === 'bloqueo' });
  }
  return out;
}

export const nights = (s: { start: string; end: string }) => Math.max(0, daysBetween(s.start, s.end));

// Nights of a stay inside [from, to).
export function nightsIn(s: { start: string; end: string }, from: string, to: string): number {
  const a = s.start > from ? s.start : from;
  const b = s.end < to ? s.end : to;
  return Math.max(0, daysBetween(a, b));
}

// Ids of the stays (cancelled ones aside) that share a night with another in the same property.
export function findConflicts(stays: Stay[]): Set<string> {
  const out = new Set<string>();
  const byRow = new Map<string, Stay[]>();
  for (const s of stays) if (!s.cancelled) byRow.set(s.row, [...(byRow.get(s.row) ?? []), s]);
  for (const list of byRow.values()) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
        out.add(sorted[i].record.id);
        out.add(sorted[j].record.id);
      }
    }
  }
  return out;
}

// Stays that overlap are stacked in lanes so both can be seen. Returns lane per id and the lane count.
export function assignLanes(stays: Stay[]): { lane: Map<string, number>; lanes: number } {
  const lane = new Map<string, number>();
  const ends: string[] = [];
  for (const s of [...stays].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))) {
    let i = ends.findIndex((e) => e <= s.start);
    if (i < 0) { i = ends.length; ends.push(s.end); } else ends[i] = s.end;
    lane.set(s.record.id, i);
  }
  return { lane, lanes: Math.max(1, ends.length) };
}

// Where the bar goes, in day columns from the start of the period (half-day offsets).
// null when it doesn't touch the period. clippedStart/End: it goes on beyond the edge.
export function barGeometry(s: { start: string; end: string }, p: Period): { left: number; width: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const n = p.days.length;
  const a = daysBetween(p.start, s.start) + 0.5;
  const b = daysBetween(p.start, s.end) + 0.5;
  if (b <= 0 || a >= n) return null;
  const left = Math.max(0, a);
  const right = Math.min(n, b);
  return { left, width: right - left, clippedStart: a < 0, clippedEnd: b > n };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
// Net income of a booking: what it brings minus the channel's cut and the costs.
export const netOf = (r: AppRecord) => num(r.data.importe) - num(r.data.comision) - num(r.data.gastos);

export interface RowStats { nights: number; occupancy: number; net: number }

// Occupancy and net of one property in the period. Blocks and cancelled
// bookings don't count; a booking that crosses the edge counts the part of
// its nights (and of its net) inside the period.
export function rowStats(stays: Stay[], p: Period): RowStats {
  let booked = 0;
  let net = 0;
  for (const s of stays) {
    if (s.cancelled || s.block) continue;
    const inside = nightsIn(s, p.start, p.end);
    if (!inside) continue;
    booked += inside;
    net += (netOf(s.record) * inside) / Math.max(1, nights(s));
  }
  return { nights: booked, occupancy: p.days.length ? Math.min(1, booked / p.days.length) : 0, net: Math.round(net * 100) / 100 };
}
