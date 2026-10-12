import type { AppRecord, Blueprint, Entity, Field } from './types.ts';
import { AUTOMATION_ENTITY } from './automations.ts';

// Appointments for Google Calendar. Datetime fields hold local time in Spain
// ("YYYY-MM-DDTHH:MM", what a datetime-local input produces). The same rules
// run in the browser (the "Añadir a Google Calendar" link) and in crm-google
// (real sync with an account), so both create the same event.

export const TIME_ZONE = 'Europe/Madrid';
export const DEFAULT_MINUTES = 60;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

const pad = (n: number) => String(n).padStart(2, '0');

export const isLocalDateTime = (v: unknown): v is string => typeof v === 'string' && LOCAL.test(v);

// Wall-clock arithmetic on a local "YYYY-MM-DDTHH:MM" (no time zone involved).
export function addMinutes(local: string, minutes: number): string {
  const m = LOCAL.exec(local);
  if (!m) throw new Error('Fecha no válida');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5] + minutes));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "2026-10-12T10:00" -> "20261012T100000" (Google's compact format, local to `ctz`).
export const compactDate = (local: string) => `${local.slice(0, 16).replace(/[-:]/g, '')}00`;

// Minutes the time zone is ahead of UTC at a given instant.
function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - utcMs) / 60000;
}

// Local Spanish time -> ISO instant in UTC ("2026-10-12T08:00:00.000Z").
export function localToUtc(local: string, tz = TIME_ZONE): string {
  const m = LOCAL.exec(local.length === 10 ? `${local}T00:00` : local);
  if (!m) throw new Error('Fecha no válida');
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const guess = naive - offsetMinutes(naive, tz) * 60000;
  return new Date(naive - offsetMinutes(guess, tz) * 60000).toISOString();
}

// Any ISO instant -> local Spanish "YYYY-MM-DDTHH:MM".
export function utcToLocal(iso: string, tz = TIME_ZONE): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error('Fecha no válida');
  const d = new Date(ms + offsetMinutes(ms, tz) * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// How long an appointment of this entity lasts: the worklist's slot length if it has one.
export function slotMinutesFor(bp: Blueprint, entity: string): number {
  const n = bp.views.find((v) => v.entity === entity && v.availability)?.availability?.slotMinutes;
  return typeof n === 'number' && n > 0 ? n : DEFAULT_MINUTES;
}

// The entity's datetime fields (the automation log is not an appointment).
export function datetimeFields(entity: Entity | undefined): Field[] {
  if (!entity || entity.key === AUTOMATION_ENTITY) return [];
  return entity.fields.filter((f) => f.type === 'datetime');
}

export interface CalendarEvent { title: string; start: string; end: string; details: string }

const DETAIL_TYPES = new Set(['phone', 'email', 'text', 'select', 'url', 'relation']);

// The event for a record: its first datetime field with a value, or null.
export function eventFor(bp: Blueprint, record: AppRecord, records: AppRecord[] = []): CalendarEvent | null {
  const entity = bp.entities.find((e) => e.key === record.entity);
  const field = datetimeFields(entity).find((f) => isLocalDateTime(record.data[f.key]));
  if (!entity || !field) return null;
  const start = String(record.data[field.key]).slice(0, 16);
  const raw = record.data[entity.titleField];
  const title = raw === undefined || raw === null || raw === '' ? entity.label : String(raw);

  const lines: string[] = [];
  for (const f of entity.fields) {
    const v = record.data[f.key];
    if (f.key === entity.titleField || !DETAIL_TYPES.has(f.type) || v === undefined || v === null || v === '') continue;
    if (f.type === 'select') { lines.push(`${f.label}: ${f.options?.find((o) => o.value === v)?.label ?? v}`); continue; }
    if (f.type === 'relation') {
      // The client behind an appointment: their name and how to reach them.
      const other = records.find((r) => r.id === v);
      const oe = other && bp.entities.find((e) => e.key === other.entity);
      if (!other || !oe) continue;
      const contact = oe.fields.filter((x) => (x.type === 'phone' || x.type === 'email') && other.data[x.key]).map((x) => String(other.data[x.key]));
      lines.push(`${f.label}: ${[String(other.data[oe.titleField] ?? oe.label), ...contact].join(' · ')}`);
      continue;
    }
    lines.push(`${f.label}: ${v}`);
  }
  const notes = entity.fields.find((f) => f.type === 'longtext' && typeof record.data[f.key] === 'string' && record.data[f.key]);
  if (notes) lines.push('', String(record.data[notes.key]).slice(0, 500));
  lines.push('', 'Desde StateHubs');
  return { title, start, end: addMinutes(start, slotMinutesFor(bp, record.entity)), details: lines.join('\n').slice(0, 2000) };
}

// The no-setup link: opens Google Calendar with the event filled in, ready to save.
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${compactDate(e.start)}/${compactDate(e.end)}`, ctz: TIME_ZONE, details: e.details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
