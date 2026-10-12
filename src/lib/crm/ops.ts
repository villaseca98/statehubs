import type { AppRecord, Blueprint, Entity, Field, SelectOption } from '@shared/blueprint/types.ts';
import { titleOfRecord } from '@/components/crm/theme';
import { dayOf, isClosed } from './today';

// Centro de operaciones: one screen for an agency that sells, rents and runs
// tourist flats. Everything here is read from the records (no AI, nothing
// stored): who arrives and leaves today, what is cleaned, which visits are on,
// the open deals, and the things that will go wrong if nobody looks
// (double bookings, a departure with no cleaning, money not collected…).
// Each part only exists when the blueprint has the entity behind it.

export type OpsKind = 'llegada' | 'salida' | 'servicio' | 'cita';

export interface OpsLine {
  id: string;
  kind: OpsKind;
  record: AppRecord;
  day: string;          // YYYY-MM-DD
  time?: string;        // HH:MM
  title: string;
  place?: string;       // the flat or property
  detail?: string;
  done?: boolean;
}

export type AlertKind = 'solape' | 'sin_limpieza' | 'incidencia' | 'cobro' | 'seguimiento';
export interface OpsAlert {
  id: string;
  kind: AlertKind;
  record: AppRecord;
  title: string;
  detail: string;
}

export interface FunnelStage { value: string; label: string; color?: SelectOption['color']; count: number; amount: number }

export interface Ops {
  occupancy?: { busy: number; total: number };
  income?: { month: string; gross: number; net: number; bookings: number };
  pipeline?: { open: number; count: number; commission: number };
  hot?: { hot: number; active: number };
  today: OpsLine[];
  alerts: OpsAlert[];
  funnel?: { stages: FunnelStage[]; active: AppRecord[]; won: number; lost: number };
  week: { day: string; items: OpsLine[] }[];
  featured: AppRecord[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + n); return dayOf(d); };
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const timeOf = (v: unknown) => (typeof v === 'string' && v.length >= 16 ? v.slice(11, 16) : undefined);

const field = (e: Entity | undefined, key: string): Field | undefined => e?.fields.find((f) => f.key === key);
const option = (e: Entity | undefined, key: string, value: unknown) => field(e, key)?.options?.find((o) => o.value === value);

// A booking that holds the flat (a cancelled one doesn't; an owner's block does).
export const holdsFlat = (r: AppRecord) => r.data.estado !== 'cancelada';
// A booking with guests in it (not cancelled, not a block).
export const hasGuests = (r: AppRecord) => r.data.estado !== 'cancelada' && r.data.estado !== 'bloqueo';

/** Ingreso neto de una reserva: importe − comisión del canal − gastos. */
export const netOf = (r: AppRecord) => num(r.data.importe) - num(r.data.comision) - num(r.data.gastos);

/** Pairs of bookings of the same flat whose nights overlap. Cancelled ones don't count; blocks do. */
export function findOverlaps(bookings: AppRecord[], from?: string): [AppRecord, AppRecord][] {
  const byFlat = new Map<string, AppRecord[]>();
  for (const r of bookings) {
    const { alojamiento, entrada, salida } = r.data;
    if (!holdsFlat(r) || !alojamiento || !isDay(entrada) || !isDay(salida) || salida.slice(0, 10) <= entrada.slice(0, 10)) continue;
    if (from && salida.slice(0, 10) < from) continue;
    const k = String(alojamiento);
    byFlat.set(k, [...(byFlat.get(k) ?? []), r]);
  }
  const out: [AppRecord, AppRecord][] = [];
  for (const list of byFlat.values()) {
    list.sort((a, b) => str(a.data.entrada).localeCompare(str(b.data.entrada)));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (str(b.data.entrada).slice(0, 10) >= str(a.data.salida).slice(0, 10)) break;
        out.push([a, b]);
      }
    }
  }
  return out;
}

/** Tourist flats with guests sleeping there tonight, out of all tourist flats. */
export function occupancy(flats: AppRecord[], bookings: AppRecord[], today: string) {
  const ids = new Set(flats.map((f) => f.id));
  const busy = new Set(bookings
    .filter((r) => hasGuests(r) && ids.has(String(r.data.alojamiento)) && isDay(r.data.entrada) && isDay(r.data.salida)
      && str(r.data.entrada).slice(0, 10) <= today && str(r.data.salida).slice(0, 10) > today)
    .map((r) => String(r.data.alojamiento)));
  return { busy: busy.size, total: flats.length };
}

/** Bookings that arrive in the month (YYYY-MM), cancelled ones out. */
export function monthIncome(bookings: AppRecord[], month: string) {
  const rs = bookings.filter((r) => hasGuests(r) && str(r.data.entrada).startsWith(month));
  return { month, gross: rs.reduce((s, r) => s + num(r.data.importe), 0), net: rs.reduce((s, r) => s + netOf(r), 0), bookings: rs.length };
}

export function computeOps(bp: Blueprint, records: AppRecord[], now = new Date()): Ops {
  const today = dayOf(now);
  const nowStamp = `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const ent = (k: string) => bp.entities.find((e) => e.key === k);
  const of = (k: string) => (ent(k) ? records.filter((r) => r.entity === k) : []);
  const titles = new Map<string, string>();
  for (const r of records) titles.set(r.id, titleOfRecord(bp.entities.find((e) => e.key === r.entity), r.data));
  const name = (id: unknown) => (id ? titles.get(String(id)) : undefined);

  const E = { reserva: ent('reserva'), servicio: ent('servicio'), incidencia: ent('incidencia'), cita: ent('cita_inmo'), operacion: ent('operacion'), contacto: ent('contacto_inmo'), inmueble: ent('inmueble') };
  const reservas = of('reserva');
  const servicios = of('servicio');
  const incidencias = of('incidencia');
  const citas = of('cita_inmo');
  const operaciones = of('operacion');
  const contactos = of('contacto_inmo');
  const inmuebles = of('inmueble');
  const out: Ops = { today: [], alerts: [], week: [], featured: [] };

  // ---- KPI ----
  if (E.reserva && E.inmueble && field(E.inmueble, 'operacion')) {
    out.occupancy = occupancy(inmuebles.filter((r) => r.data.operacion === 'turistico'), reservas, today);
  }
  if (E.reserva && field(E.reserva, 'importe')) out.income = monthIncome(reservas, today.slice(0, 7));
  const stage = field(E.operacion, 'etapa');
  const openDeals = operaciones.filter((r) => !isClosed(option(E.operacion, 'etapa', r.data.etapa)));
  if (E.operacion) {
    out.pipeline = {
      open: openDeals.reduce((s, r) => s + num(r.data.importe), 0),
      count: openDeals.length,
      commission: openDeals.reduce((s, r) => s + num(r.data.importe) * num(r.data.comision) / 100 * num(r.data.probabilidad) / 100, 0),
    };
  }
  if (E.contacto && field(E.contacto, 'temperatura')) {
    const active = contactos.filter((r) => !isClosed(option(E.contacto, 'temperatura', r.data.temperatura)));
    out.hot = { hot: contactos.filter((r) => r.data.temperatura === 'caliente').length, active: active.length };
  }

  // ---- Lines (today and the week) ----
  const channel = (r: AppRecord) => option(E.reserva, 'canal', r.data.canal)?.label;
  const guests = (r: AppRecord) => (num(r.data.huespedes) ? `${num(r.data.huespedes)} ${num(r.data.huespedes) === 1 ? 'huésped' : 'huéspedes'}` : '');
  const lines: OpsLine[] = [];
  for (const r of reservas.filter(hasGuests)) {
    const title = titleOfRecord(E.reserva, r.data);
    if (isDay(r.data.entrada)) {
      lines.push({ id: `${r.id}:in`, kind: 'llegada', record: r, day: str(r.data.entrada).slice(0, 10), time: /^\d{1,2}:\d{2}$/.test(str(r.data.llegada)) ? str(r.data.llegada).padStart(5, '0') : undefined, title, place: name(r.data.alojamiento), detail: [guests(r), channel(r)].filter(Boolean).join(' · ') });
    }
    if (isDay(r.data.salida)) {
      lines.push({ id: `${r.id}:out`, kind: 'salida', record: r, day: str(r.data.salida).slice(0, 10), title, place: name(r.data.alojamiento), detail: channel(r) });
    }
  }
  for (const r of servicios) {
    if (!isDay(r.data.fecha)) continue;
    lines.push({ id: `${r.id}:sv`, kind: 'servicio', record: r, day: str(r.data.fecha).slice(0, 10), time: timeOf(r.data.fecha), title: titleOfRecord(E.servicio, r.data), place: name(r.data.alojamiento), detail: [option(E.servicio, 'tipo', r.data.tipo)?.label, name(r.data.responsable)].filter(Boolean).join(' · '), done: isClosed(option(E.servicio, 'estado', r.data.estado)) });
  }
  for (const r of citas) {
    if (!isDay(r.data.cuando)) continue;
    lines.push({ id: `${r.id}:ci`, kind: 'cita', record: r, day: str(r.data.cuando).slice(0, 10), time: timeOf(r.data.cuando), title: titleOfRecord(E.cita, r.data), place: name(r.data.inmueble), detail: [option(E.cita, 'tipo', r.data.tipo)?.label, name(r.data.contacto)].filter(Boolean).join(' · '), done: !!r.data.resultado && r.data.resultado !== 'pendiente' });
  }
  const ORDER: Record<OpsKind, number> = { salida: 0, servicio: 1, llegada: 2, cita: 3 };
  const byTime = (a: OpsLine, b: OpsLine) => (a.time ?? '99').localeCompare(b.time ?? '99') || ORDER[a.kind] - ORDER[b.kind];
  out.today = lines.filter((l) => l.day === today).sort(byTime);
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, i);
    const items = lines.filter((l) => l.day === day && l.kind !== 'servicio').sort(byTime);
    out.week.push({ day, items });
  }

  // ---- Alerts ----
  for (const [a, b] of findOverlaps(reservas, today)) {
    out.alerts.push({ id: `solape:${a.id}:${b.id}`, kind: 'solape', record: b, title: `Reservas solapadas en ${name(a.data.alojamiento) ?? 'un alojamiento'}`, detail: `${titleOfRecord(E.reserva, a.data)} y ${titleOfRecord(E.reserva, b.data)} coinciden` });
  }
  if (E.servicio) {
    const until = addDays(today, 7);
    for (const r of reservas.filter(hasGuests)) {
      const out_ = str(r.data.salida).slice(0, 10);
      if (!isDay(out_) || out_ < today || out_ > until) continue;
      const covered = servicios.some((s) => {
        if (s.data.tipo !== 'limpieza') return false;
        const linked = s.data.reserva === r.id;
        if (!isDay(s.data.fecha)) return linked;
        const d = str(s.data.fecha).slice(0, 10);
        return (linked || (!!r.data.alojamiento && s.data.alojamiento === r.data.alojamiento)) && d >= out_ && d <= addDays(out_, 1);
      });
      if (!covered) out.alerts.push({ id: `limpieza:${r.id}`, kind: 'sin_limpieza', record: r, title: `Salida sin limpieza: ${titleOfRecord(E.reserva, r.data)}`, detail: `${name(r.data.alojamiento) ?? 'Alojamiento'} · sale ${out_ === today ? 'hoy' : out_ === addDays(today, 1) ? 'mañana' : `el ${Number(out_.slice(8, 10))}`}` });
    }
  }
  for (const r of incidencias) {
    if (r.data.prioridad !== 'alta' || isClosed(option(E.incidencia, 'estado', r.data.estado))) continue;
    out.alerts.push({ id: `inc:${r.id}`, kind: 'incidencia', record: r, title: titleOfRecord(E.incidencia, r.data), detail: `Prioridad alta · ${[option(E.incidencia, 'estado', r.data.estado)?.label, name(r.data.alojamiento)].filter(Boolean).join(' · ')}` });
  }
  if (field(E.reserva, 'pago')) {
    for (const r of reservas.filter(hasGuests)) {
      if (!isDay(r.data.entrada) || str(r.data.entrada).slice(0, 10) > today || (r.data.pago !== 'pendiente' && r.data.pago !== 'parcial')) continue;
      out.alerts.push({ id: `cobro:${r.id}`, kind: 'cobro', record: r, title: `Cobro ${r.data.pago === 'parcial' ? 'parcial' : 'pendiente'}: ${titleOfRecord(E.reserva, r.data)}`, detail: [num(r.data.importe) ? `${num(r.data.importe).toLocaleString('es-ES')} €` : '', name(r.data.alojamiento)].filter(Boolean).join(' · ') });
    }
  }
  for (const r of contactos) {
    const when = str(r.data.seguimiento);
    if (!isDay(when) || isClosed(option(E.contacto, 'temperatura', r.data.temperatura))) continue;
    if ((when.length >= 16 ? when.slice(0, 16) : when.slice(0, 10)) >= (when.length >= 16 ? nowStamp : today)) continue;
    const late = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${when.slice(0, 10)}T00:00:00`).getTime()) / 864e5);
    out.alerts.push({ id: `seg:${r.id}`, kind: 'seguimiento', record: r, title: `Seguimiento vencido: ${titleOfRecord(E.contacto, r.data)}`, detail: [late > 0 ? `hace ${late} ${late === 1 ? 'día' : 'días'}` : 'hoy', str(r.data.proxima_accion)].filter(Boolean).join(' · ') });
  }

  // ---- Funnel ----
  if (E.operacion && stage?.options) {
    const stages = stage.options.filter((o) => !isClosed(o)).map((o) => {
      const rs = openDeals.filter((r) => r.data.etapa === o.value);
      return { value: o.value, label: o.label, color: o.color, count: rs.length, amount: rs.reduce((s, r) => s + num(r.data.importe), 0) };
    });
    const closed = operaciones.filter((r) => isClosed(option(E.operacion, 'etapa', r.data.etapa)));
    out.funnel = {
      stages,
      active: [...openDeals].sort((a, b) => (str(a.data.cierre) || '9999').localeCompare(str(b.data.cierre) || '9999')).slice(0, 5),
      won: closed.filter((r) => /cerrad|ganad/.test(String(r.data.etapa))).length,
      lost: closed.filter((r) => /perdid/.test(String(r.data.etapa))).length,
    };
  }

  // ---- Featured properties: in exclusive first, then available, then the newest ----
  const live = inmuebles.filter((r) => !isClosed(option(E.inmueble, 'estado', r.data.estado)) && !/^(vendido|alquilado|retirado)$/.test(String(r.data.estado ?? '')));
  const score = (r: AppRecord) => (r.data.exclusiva ? 2 : 0) + (r.data.estado === 'disponible' ? 1 : 0);
  out.featured = live.sort((a, b) => score(b) - score(a) || str(b.data.captado).localeCompare(str(a.data.captado))).slice(0, 3);

  return out;
}
