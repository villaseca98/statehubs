import type { AppRecord, RecordData } from './types.ts';

// iCal sync for holiday lets. Airbnb and Booking only publish which dates are
// taken (an .ics link per listing): no guest names, prices or messages. We
// read that link and keep one «reserva» per event, keyed by its UID, so the
// calendar shows every channel in one place. The network side lives in the
// crm-ical function; everything here is pure so it can be tested.

export type IcalSource = 'airbnb' | 'booking';
export const ICAL_FIELDS: Record<IcalSource, string> = { airbnb: 'ical_airbnb', booking: 'ical_booking' };
const SOURCE_LABEL: Record<IcalSource, string> = { airbnb: 'Airbnb', booking: 'Booking' };

export interface IcalEvent {
  uid: string;
  start: string;    // YYYY-MM-DD (check-in)
  end: string;      // YYYY-MM-DD (check-out; DTEND of an all-day event is exclusive)
  summary: string;
  description?: string;
  cancelled?: boolean;
}

export interface SyncSummary { nuevas: number; actualizadas: number; canceladas: number; errores: string[] }

const MAX_EVENTS = 2000;

// Long lines are folded: a line break followed by a space or tab continues it.
const unfold = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

// DTSTART;VALUE=DATE:20261012 or DTSTART:20261012T140000Z → 2026-10-12.
function toDay(value: string): string | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function parseIcal(text: string): IcalEvent[] {
  const out: IcalEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfold(text).split('\n')) {
    const t = line.trim();
    if (t === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (t === 'END:VEVENT') {
      if (cur) {
        const start = toDay(cur.DTSTART ?? '');
        let end = toDay(cur.DTEND ?? '');
        // No DTEND: an all-day event lasts one day.
        if (start && !end) end = addDays(start, 1);
        if (cur.UID && start && end && end > start) {
          out.push({
            uid: cur.UID.slice(0, 255), start, end,
            summary: unescape(cur.SUMMARY ?? ''),
            ...(cur.DESCRIPTION ? { description: unescape(cur.DESCRIPTION).slice(0, 1000) } : {}),
            ...(cur.STATUS?.toUpperCase() === 'CANCELLED' ? { cancelled: true } : {}),
          });
          if (out.length >= MAX_EVENTS) break;
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(';')[0].trim().toUpperCase();
    if (['UID', 'DTSTART', 'DTEND', 'SUMMARY', 'DESCRIPTION', 'STATUS'].includes(name) && !(name in cur)) cur[name] = line.slice(colon + 1).trim();
  }
  return out;
}

// Airbnb: "Reserved" is a booking, "Airbnb (Not available)" is a date closed by hand.
// Booking: everything comes as "CLOSED - Not available"; it doesn't say which are bookings.
export function isBlock(source: IcalSource, summary: string): boolean {
  const s = summary.toLowerCase();
  if (source === 'airbnb') return /not available|no disponible|blocked|bloquead/.test(s);
  return /^(blocked|bloquead)/.test(s);
}

const placeholder = (source: IcalSource) => `Reserva ${SOURCE_LABEL[source]}`;
const isPlaceholder = (v: unknown) => /^(Reserva (Airbnb|Booking)|Bloqueo( Airbnb| Booking)?)$/.test(String(v ?? ''));

// Airbnb's "Reserved" and Booking's "CLOSED - Not available" carry no name.
function guestName(summary: string): string | null {
  const s = summary.trim();
  if (!s || /^(reserved|reservado|closed|not available|airbnb|booking|blocked|bloquead|unavailable)/i.test(s)) return null;
  return s.slice(0, 120);
}

// The record data an event becomes (fields the sync owns).
export function eventToReserva(ev: IcalEvent, source: IcalSource, alojamiento: string): RecordData {
  const block = isBlock(source, ev.summary);
  return {
    huesped: block ? `Bloqueo ${SOURCE_LABEL[source]}` : guestName(ev.summary) ?? placeholder(source),
    alojamiento,
    canal: source,
    entrada: ev.start,
    salida: ev.end,
    estado: block ? 'bloqueo' : 'confirmada',
    ref_externa: ev.uid,
    origen_sync: 'ical',
  };
}

export interface SyncPlan {
  create: RecordData[];
  update: { id: string; data: RecordData }[];
  cancel: { id: string; data: RecordData }[];
}

// Compares one listing's feed with the reservations already saved and says
// what to create, update and cancel. Only what the sync owns is touched: a
// guest name typed by hand, «en la casa» or «finalizada», prices and notes stay.
// Events already over are ignored, and reservations only get cancelled when
// they haven't started yet and came from this same feed.
export function planSync(existing: AppRecord[], alojamiento: string, source: IcalSource, events: IcalEvent[], today: string): SyncPlan {
  const plan: SyncPlan = { create: [], update: [], cancel: [] };
  const mine = existing.filter((r) => r.entity === 'reserva' && r.data.alojamiento === alojamiento);
  const byUid = new Map(mine.filter((r) => r.data.ref_externa).map((r) => [String(r.data.ref_externa), r]));
  const seen = new Set<string>();

  for (const ev of events) {
    if (ev.end < today) continue;
    seen.add(ev.uid);
    if (ev.cancelled) continue;
    const next = eventToReserva(ev, source, alojamiento);
    const old = byUid.get(ev.uid);
    if (!old) {
      plan.create.push(source === 'booking' && next.estado !== 'bloqueo'
        ? { ...next, notas: 'Llegó por el calendario iCal de Booking, que no dice si es una reserva o fechas cerradas a mano.' }
        : next);
      continue;
    }
    const patch: RecordData = {};
    for (const k of ['entrada', 'salida', 'canal', 'origen_sync'] as const) if (old.data[k] !== next[k]) patch[k] = next[k];
    const wasCancelled = old.data.estado === 'cancelada';
    const kindChanged = (old.data.estado === 'bloqueo') !== (next.estado === 'bloqueo');
    if (wasCancelled || kindChanged || !old.data.estado) patch.estado = next.estado;
    if (isPlaceholder(old.data.huesped) && old.data.huesped !== next.huesped) patch.huesped = next.huesped;
    if (Object.keys(patch).length) plan.update.push({ id: old.id, data: { ...old.data, ...patch } });
  }

  for (const r of mine) {
    const uid = String(r.data.ref_externa ?? '');
    if (!uid || seen.has(uid) || r.data.origen_sync !== 'ical' || r.data.canal !== source) continue;
    if (r.data.estado === 'cancelada' || String(r.data.entrada ?? '') < today) continue;
    plan.cancel.push({ id: r.id, data: { ...r.data, estado: 'cancelada' } });
  }
  // A cancelled event still in the feed (STATUS:CANCELLED) cancels too.
  for (const ev of events) {
    const old = byUid.get(ev.uid);
    if (ev.cancelled && old && old.data.estado !== 'cancelada' && !plan.cancel.some((c) => c.id === old.id)) {
      plan.cancel.push({ id: old.id, data: { ...old.data, estado: 'cancelada' } });
    }
  }
  return plan;
}

// One line for a toast: «3 nuevas, 1 actualizada, 0 canceladas».
export function syncSummaryText(s: SyncSummary & { mensaje?: string }): string {
  if (s.mensaje) return s.mensaje;
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  const head = s.nuevas + s.actualizadas + s.canceladas === 0
    ? 'Todo al día: no hay cambios en los calendarios.'
    : `${n(s.nuevas, 'nueva', 'nuevas')}, ${n(s.actualizadas, 'actualizada', 'actualizadas')}, ${n(s.canceladas, 'cancelada', 'canceladas')}.`;
  return s.errores.length ? `${head} No se pudo leer: ${s.errores.join(' · ')}` : head;
}
