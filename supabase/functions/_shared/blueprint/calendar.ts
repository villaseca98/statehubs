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

// A stay (a booking): the start and end date fields of the entity's timeline
// view, or «entrada»/«salida». Shown as an all-day event, like Airbnb does.
export function dateRangeFields(bp: Blueprint, entity: Entity | undefined): [Field, Field] | null {
  if (!entity) return null;
  const v = bp.views.find((x) => x.type === 'timeline' && x.entity === entity.key && x.startField && x.endField);
  const [a, b] = v ? [v.startField, v.endField] : ['entrada', 'salida'];
  const start = entity.fields.find((f) => f.key === a && f.type === 'date');
  const end = entity.fields.find((f) => f.key === b && f.type === 'date');
  return start && end ? [start, end] : null;
}

// Field keys whose change moves the event (what makes a save reach Google Calendar).
export function eventFieldKeys(bp: Blueprint, entity: Entity | undefined): string[] {
  return [...datetimeFields(entity).map((f) => f.key), ...(dateRangeFields(bp, entity)?.map((f) => f.key) ?? [])];
}

// `start`/`end` are local "YYYY-MM-DDTHH:MM", or "YYYY-MM-DD" when `allDay` (end exclusive).
export interface CalendarEvent { title: string; start: string; end: string; details: string; location?: string; allDay?: boolean }

const DETAIL_TYPES = new Set(['phone', 'email', 'text', 'select', 'url', 'relation', 'date', 'number']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CANCELLED = new Set(['cancelada', 'cancelado']);

export const addDays = (day: string, n: number) => addMinutes(`${day}T00:00`, n * 1440).slice(0, 10);

// The event for a record: its first datetime field with a value (an
// appointment), or its stay dates (a booking). Null when there is no date or
// the record is cancelled.
export function eventFor(bp: Blueprint, record: AppRecord, records: AppRecord[] = []): CalendarEvent | null {
  const entity = bp.entities.find((e) => e.key === record.entity);
  if (!entity) return null;
  if (CANCELLED.has(String(record.data.estado ?? ''))) return null;
  const field = datetimeFields(entity).find((f) => isLocalDateTime(record.data[f.key]));
  const range = field ? null : dateRangeFields(bp, entity);
  let start: string; let end: string; let allDay = false;
  if (field) {
    start = String(record.data[field.key]).slice(0, 16);
    end = addMinutes(start, slotMinutesFor(bp, record.entity));
  } else if (range && DAY.test(String(record.data[range[0].key] ?? '').slice(0, 10))) {
    start = String(record.data[range[0].key]).slice(0, 10);
    const last = String(record.data[range[1].key] ?? '').slice(0, 10);
    end = DAY.test(last) && last > start ? last : addDays(start, 1);
    allDay = true;
  } else return null;

  const raw = record.data[entity.titleField];
  let title = raw === undefined || raw === null || raw === '' ? entity.label : String(raw);
  let location: string | undefined;
  const lines: string[] = [];
  for (const f of entity.fields) {
    const v = record.data[f.key];
    if (f.key === entity.titleField || !DETAIL_TYPES.has(f.type) || v === undefined || v === null || v === '') continue;
    if (f.type === 'select') { lines.push(`${f.label}: ${f.options?.find((o) => o.value === v)?.label ?? v}`); continue; }
    if (f.type === 'date') { if (allDay) lines.push(`${f.label}: ${String(v).slice(8, 10)}/${String(v).slice(5, 7)}/${String(v).slice(0, 4)}`); continue; }
    if (f.type === 'relation') {
      // The client behind an appointment (name and how to reach them), or the property and its address.
      const other = records.find((r) => r.id === v);
      const oe = other && bp.entities.find((e) => e.key === other.entity);
      if (!other || !oe) continue;
      const name = String(other.data[oe.titleField] ?? oe.label);
      const address = typeof other.data.direccion === 'string' && other.data.direccion ? other.data.direccion : undefined;
      if (address && !location) location = address;
      const contact = oe.fields.filter((x) => (x.type === 'phone' || x.type === 'email') && other.data[x.key]).map((x) => String(other.data[x.key]));
      lines.push(`${f.label}: ${[name, ...contact].join(' · ')}`);
      continue;
    }
    lines.push(`${f.label}: ${v}`);
  }
  if (allDay) {
    // «Ana López · Loft Carmen»: who and where, at a glance in the calendar.
    const place = entity.fields.find((f) => f.type === 'relation' && records.some((r) => r.id === record.data[f.key] && typeof r.data.direccion === 'string'));
    const where = place && records.find((r) => r.id === record.data[place.key]);
    const short = where && String(where.data.referencia || where.data.direccion || '').split(' · ')[0];
    if (short) title = `${title} · ${short}`;
  }
  const notes = entity.fields.find((f) => f.type === 'longtext' && typeof record.data[f.key] === 'string' && record.data[f.key]);
  if (notes) lines.push('', String(record.data[notes.key]).slice(0, 500));
  lines.push('', 'Desde StateHubs');
  return { title: title.slice(0, 200), start, end, details: lines.join('\n').slice(0, 2000), ...(location ? { location: location.slice(0, 300) } : {}), ...(allDay ? { allDay } : {}) };
}

// "2026-10-14" -> "20261014"; "2026-10-14T10:00" -> "20261014T100000".
const googleDate = (v: string, allDay?: boolean) => (allDay ? v.slice(0, 10).replace(/-/g, '') : compactDate(v));

// The no-setup link: opens Google Calendar with the event filled in, ready to save.
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${googleDate(e.start, e.allDay)}/${googleDate(e.end, e.allDay)}`, ctz: TIME_ZONE, details: e.details });
  if (e.location) q.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// iCalendar text escaping (RFC 5545 §3.3.11) and line folding at 75 octets.
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const utcStamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// A .ics file with one event: opens in Google Calendar, Apple Calendar or Outlook.
// Timed events are written in UTC so no time zone block is needed.
export function icsFor(e: CalendarEvent, uid: string, now = new Date()): string {
  const when = e.allDay
    ? [`DTSTART;VALUE=DATE:${googleDate(e.start, true)}`, `DTEND;VALUE=DATE:${googleDate(e.end, true)}`]
    : [`DTSTART:${utcStamp(localToUtc(e.start))}`, `DTEND:${utcStamp(localToUtc(e.end))}`];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StateHubs//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid.replace(/[^\w.@-]/g, '')}@statehubs`, `DTSTAMP:${utcStamp(now.toISOString())}`, ...when,
    `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(e.details)}`, ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// What crm-google sends to the Calendar API for an event.
export function googleEventBody(e: CalendarEvent, recordId: string) {
  const at = (v: string) => (e.allDay ? { date: v.slice(0, 10) } : { dateTime: `${v.slice(0, 16)}:00`, timeZone: TIME_ZONE });
  return {
    summary: e.title, description: e.details, ...(e.location ? { location: e.location } : {}),
    start: at(e.start), end: at(e.end), status: 'confirmed',
    extendedProperties: { private: { statehubs_record: recordId } },
  };
}

// Google lets us choose the event id (base32hex: 0-9 and a-v, 5–1024 chars).
// Deriving it from the record makes every save an update of the same event.
export async function googleEventId(userId: string, recordId: string): Promise<string> {
  const data = new TextEncoder().encode(`statehubs:${userId}:${recordId}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return `sh${[...hash].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
