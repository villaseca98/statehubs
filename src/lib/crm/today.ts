import type { AppRecord, Blueprint, Entity, Field, SelectOption } from '@shared/blueprint/types.ts';
import { stageField, titleOfRecord } from '@/components/crm/theme';

// «Hoy»: the screen the app opens on. It reads any blueprint (made with
// pieces or by the AI) and answers one question: what needs doing? It looks
// at the dates (appointments, due dates, deadlines, expiries), at the state
// of each record (closed ones don't count) and at a few signals that matter
// in a small business: new leads nobody has called, stock under minimum.

export type Bucket = 'atrasado' | 'hoy' | 'proximo';

export interface TodayItem {
  id: string;            // record id + reason, unique in the list
  record: AppRecord;
  entity: Entity;
  bucket: Bucket;
  title: string;
  reason: string;        // «Cita a las 12:30», «Venció hace 3 días»…
  when?: string;         // sortable date (YYYY-MM-DD or YYYY-MM-DDTHH:MM)
  stage?: SelectOption;
  phone?: string;        // for one-tap WhatsApp / call
}

export interface Today {
  atrasado: TodayItem[];
  hoy: TodayItem[];
  proximo: TodayItem[];
  total: number;
}

// Dates that record when something started, not when something is due.
const PAST_MARKERS = /^(abierta|abierto|alta|fecha_alta|creado|creada|creacion|desde|inicio|ultimo_envio|registro)$/;
// States that mean «nothing left to do».
const CLOSED = /(ganad|perdid|cobrad|pagad|entregad|hech|resuelt|cerrad|descartad|firmad|rechazad|aceptad|completad|cancelad|finalizad|archivad|inactiv|^alta$)/i;
// Dates that are about expiry: they warn a month ahead.
const EXPIRY = /(caduc|vencimiento_doc|renovacion|expira)/;
// Things that happen at a time (as opposed to things that are due).
const EVENT = /(cita|visita|reunion|llamada|evento|clase|sesion|consulta)/;
// Field labels too vague to show on their own («Cuándo a las 12:00»).
const VAGUE = /^(cuándo|cuando|fecha|para el|día|dia|hora)$/i;
// First stages that mean «nobody has picked this up yet», and how to say it.
const UNTOUCHED: [RegExp, string][] = [[/^nuev/, 'sin contactar todavía'], [/^abiert/, 'sin atender todavía'], [/^(pendiente|recibid)/, 'sin empezar']];

const pad = (n: number) => String(n).padStart(2, '0');
export const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 864e5);

export const isClosed = (o?: SelectOption) => !!o && CLOSED.test(`${o.value} ${o.label}`);

/** The date fields of an entity that say when something is due. */
export function dueFields(entity: Entity): Field[] {
  const dates = entity.fields.filter((f) => (f.type === 'date' || f.type === 'datetime') && !PAST_MARKERS.test(f.key));
  // A plain «fecha» is when something was issued or paid (an invoice, an expense),
  // except in appointments, where it is the appointment itself.
  return EVENT.test(entity.key) ? dates : dates.filter((f) => f.key !== 'fecha');
}

function label(field: Field, value: string, bucket: Bucket, today: string, entity: Entity): string {
  const time = field.type === 'datetime' && value.length >= 16 ? value.slice(11, 16) : '';
  const name = VAGUE.test(field.label) ? entity.label : field.label;
  const event = EVENT.test(entity.key) || EVENT.test(field.key);
  const day = value.slice(0, 10);
  if (bucket === 'hoy') return time ? `${name} a las ${time}` : `${name}: hoy`;
  if (bucket === 'atrasado') {
    const n = daysBetween(day, today);
    const ago = `hace ${n} ${n === 1 ? 'día' : 'días'}`;
    if (event) return `${name} ${ago} · ¿se hizo?`;
    return /^venc/.test(field.key) ? `Venció ${ago}` : `${name}: ${n} ${n === 1 ? 'día' : 'días'} tarde`;
  }
  const n = daysBetween(today, day);
  const when = n === 1 ? 'mañana' : new Date(`${day}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  return `${name} ${when}${time ? ` a las ${time}` : ''}`;
}

export function computeToday(bp: Blueprint, records: AppRecord[], now = new Date()): Today {
  const today = dayOf(now);
  const week = dayOf(addDays(now, 7));
  const month = dayOf(addDays(now, 30));
  const out: Today = { atrasado: [], hoy: [], proximo: [], total: 0 };
  const worklistEntities = new Set(bp.views.filter((v) => v.type === 'worklist').map((v) => v.entity));

  for (const entity of bp.entities) {
    const stage = stageField(entity, bp.views.find((v) => v.entity === entity.key && v.groupBy)?.groupBy);
    const fields = dueFields(entity);
    const doneFlag = entity.fields.find((f) => f.type === 'boolean' && /^(hecha|hecho|confirmada|completada|pagada|cobrada)$/.test(f.key));
    const phoneField = entity.fields.find((f) => f.type === 'phone');

    for (const r of records.filter((x) => x.entity === entity.key)) {
      const opt = stage?.options?.find((o) => o.value === r.data[stage.key]);
      if (isClosed(opt) || (doneFlag && doneFlag.key !== 'confirmada' && r.data[doneFlag.key] === true)) continue;
      const base = { record: r, entity, title: titleOfRecord(entity, r.data), stage: opt, phone: phoneField ? (r.data[phoneField.key] as string | undefined) || undefined : undefined };
      let dated = false;

      for (const f of fields) {
        const v = r.data[f.key];
        if (typeof v !== 'string' || v.length < 10) continue;
        dated = true;
        const day = v.slice(0, 10);
        const expiry = EXPIRY.test(f.key);
        let bucket: Bucket | null = null;
        if (day < today) bucket = 'atrasado';
        else if (day === today) bucket = 'hoy';
        else if (day <= (expiry ? month : week)) bucket = 'proximo';
        if (!bucket) continue;
        out[bucket].push({ ...base, id: `${r.id}:${f.key}`, bucket, when: v, reason: expiry ? (bucket === 'atrasado' ? 'Caducado' : `Caduca ${bucket === 'hoy' ? 'hoy' : label(f, v, bucket, today, entity).replace(/^.*? (?=mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo)/, '')}`) : label(f, v, bucket, today, entity) });
      }

      // A new lead nobody has called yet goes on today's list.
      const first = stage?.options?.[0];
      const untouched = opt && first && opt.value === first.value ? UNTOUCHED.find(([re]) => re.test(opt.value)) : undefined;
      if (!dated && untouched && stage && /^(estado|etapa)$/.test(stage.key) && (worklistEntities.has(entity.key) || untouched[1] !== 'sin empezar')) {
        out.hoy.push({ ...base, id: `${r.id}:nuevo`, bucket: 'hoy', reason: `${opt!.label}: ${untouched[1]}` });
      }

      // Stock under minimum.
      const stock = Number(r.data.stock);
      const min = Number(r.data.minimo);
      if (entity.fields.some((f) => f.key === 'minimo') && Number.isFinite(stock) && Number.isFinite(min) && r.data.stock !== undefined && stock < min) {
        out.hoy.push({ ...base, id: `${r.id}:stock`, bucket: 'hoy', reason: `Quedan ${stock}; el mínimo es ${min}` });
      }
    }
  }

  const byWhen = (a: TodayItem, b: TodayItem) => (a.when ?? '9999').localeCompare(b.when ?? '9999');
  out.atrasado.sort(byWhen);
  out.hoy.sort(byWhen);
  out.proximo.sort(byWhen);
  out.total = out.atrasado.length + out.hoy.length + out.proximo.length;
  return out;
}
