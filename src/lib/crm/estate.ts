import type { AppRecord } from '@shared/blueprint/types.ts';
import { matchProperty } from './matching';
import { dayOf } from './today';
import { hasGuests } from './ops';

// Figures for the agency dashboard that ops.ts doesn't already give:
// a year of income and costs, how full the flats are this month, which
// contacts fit a property, and the days of the week with something on.

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** A photo the app can show: a web address or one of its own files ('/demo/…'). */
export const photoOf = (v: unknown) => (typeof v === 'string' && (/^https?:\/\/\S+$/.test(v) || /^\/[^/]/.test(v)) ? v : '');

export interface MonthPoint { month: string; label: string; income: number; costs: number }

/**
 * The last `months` months up to this one. Income is what bookings bring in
 * (by arrival month) plus the commission of deals closed that month; costs
 * are the channel commissions and the booking expenses.
 */
export function monthlySeries(reservas: AppRecord[], operaciones: AppRecord[], now = new Date(), months = 12): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const label = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    out.push({ month: key, label: label.charAt(0).toUpperCase() + label.slice(1), income: 0, costs: 0 });
  }
  const at = new Map(out.map((p) => [p.month, p]));
  for (const r of reservas) {
    const p = hasGuests(r) ? at.get(str(r.data.entrada).slice(0, 7)) : undefined;
    if (!p) continue;
    p.income += num(r.data.importe);
    p.costs += num(r.data.comision) + num(r.data.gastos);
  }
  for (const r of operaciones) {
    const p = r.data.etapa === 'cerrada' ? at.get(str(r.data.cierre).slice(0, 7)) : undefined;
    if (p) p.income += num(r.data.importe) * num(r.data.comision) / 100;
  }
  for (const p of out) { p.income = Math.round(p.income); p.costs = Math.round(p.costs); }
  return out;
}

/** Nights booked this month across the tourist flats, out of every night they have. */
export function monthOccupancy(flats: AppRecord[], reservas: AppRecord[], now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ids = new Set(flats.map((f) => f.id));
  const from = dayOf(first);
  const to = dayOf(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  let booked = 0;
  let blocked = 0;
  for (const r of reservas) {
    if (!ids.has(str(r.data.alojamiento)) || r.data.estado === 'cancelada') continue;
    const a = str(r.data.entrada).slice(0, 10);
    const b = str(r.data.salida).slice(0, 10);
    if (!a || !b) continue;
    const start = a > from ? a : from;
    const end = b < to ? b : to;
    const nights = Math.max(0, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 864e5));
    if (r.data.estado === 'bloqueo') blocked += nights; else booked += nights;
  }
  const total = flats.length * days;
  return { booked, blocked, free: Math.max(0, total - booked - blocked), total };
}

/** Legacy dashboard uses the same strict engine; incomplete qualification is not a confirmed match. */
export function matchesFor(property: AppRecord, contactos: AppRecord[]): AppRecord[] {
  return contactos.filter(contact => { const result=matchProperty(contact,property); return result.eligible && result.score!==null && result.reasons.every(r=>r.state==='match'); });
}

export interface DayItem { id: string; record: AppRecord; time?: string; title: string; kind: 'cita' | 'llegada' | 'salida' | 'servicio' }

/** Monday-to-Sunday days of the week `now` falls in. */
export function weekDays(now = new Date()): string[] {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
}

/** What happens on a day: appointments, arrivals, departures and services, by time. */
export function itemsOn(day: string, records: AppRecord[], titleOf: (id: unknown) => string | undefined): DayItem[] {
  const out: DayItem[] = [];
  for (const r of records) {
    const d = r.data;
    if (r.entity === 'cita_inmo' && str(d.cuando).startsWith(day)) out.push({ id: `c${r.id}`, record: r, time: str(d.cuando).slice(11, 16), title: str(d.titulo), kind: 'cita' });
    if (r.entity === 'servicio' && str(d.fecha).startsWith(day)) out.push({ id: `s${r.id}`, record: r, time: str(d.fecha).slice(11, 16), title: str(d.titulo), kind: 'servicio' });
    if (r.entity === 'reserva' && hasGuests(r)) {
      const flat = titleOf(d.alojamiento)?.split(' · ')[0];
      if (str(d.entrada).startsWith(day)) out.push({ id: `e${r.id}`, record: r, time: str(d.llegada) || undefined, title: `Llega ${str(d.huesped)}${flat ? ` · ${flat}` : ''}`, kind: 'llegada' });
      if (str(d.salida).startsWith(day)) out.push({ id: `x${r.id}`, record: r, title: `Sale ${str(d.huesped)}${flat ? ` · ${flat}` : ''}`, kind: 'salida' });
    }
  }
  return out.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}
