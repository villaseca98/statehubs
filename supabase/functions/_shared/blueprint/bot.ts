import type { AppRecord, Availability, Blueprint, BotChoice, BotConfig, BotQuestion, BotRule, BotTarget, BotTemplate, Entity, Field, RecordData } from './types.ts';
import { buildSlots, isoDay } from './slots.ts';

// The Instagram assistant. A pure state machine: given the app (blueprint and
// records) and one incoming event (a comment, a story reply, a direct message),
// it says what to answer and which records to create or change. It never
// talks to Instagram or to the database itself, so the browser simulator and
// the server webhook run exactly this code.
//
// The conversation's progress is kept in its own record (`_bot` in the data
// of the «conversacion»): which question it is on and what it has offered.
// It never charges anything: a booking it makes is «pendiente» until a person
// confirms it.

export const CONVERSATION = 'conversacion';
export const CONTACT = 'contacto_inmo';

export type BotEventKind = 'comment' | 'story' | 'dm' | 'ad';
export interface BotEvent {
  kind: BotEventKind;
  text: string;
  username: string;   // Instagram @, with or without the @
  name?: string;      // their display name, when Instagram gives it
  igId?: string;      // their Instagram-scoped id (IGSID); the simulator makes one up
}
export interface BotMessage { text: string; quick?: string[] }
export interface BotOp { op: 'create' | 'update'; entity: string; id: string; data: RecordData }
export interface BotTurn {
  handled: boolean;            // the assistant answered (false: ignored, or a person has it)
  conversationId: string | null;
  replies: BotMessage[];       // in order; a comment gets one (Instagram allows one private reply)
  publicReply?: string;        // answer under the comment
  ops: BotOp[];                // creates first, in an order where links point backwards
  notes: string[];             // what changed in the CRM, in plain Spanish
}

type Step = number | 'slots' | 'llegada' | 'noches' | 'huespedes' | 'alojamiento' | 'fin';
export interface BotState {
  step: Step;
  tries: number;
  skip?: number;                          // «otro día» pressed n times
  offered?: { label: string; value: string }[];
  llegada?: string;
  noches?: number;
  huespedes?: number;
}

const MAX_TRANSCRIPT = 6000;
const QUICK_MAX = 20;
// Fields the assistant fills by itself; questions can't write them.
export const BOT_RESERVED: Record<BotTarget, string[]> = {
  conversacion: ['usuario', 'canal', 'estado', 'puntuacion', 'disparador', 'palabra_clave', 'contacto', 'inmueble', 'cita', 'inicio', 'ultima_actividad', 'enlace', 'ig_id', 'resumen', 'transcripcion'],
  contacto_inmo: ['temperatura', 'origen', 'alta', 'agente', 'seguimiento', 'proxima_accion', 'prioridad'],
};
export const BOT_FIELD_TYPES = ['text', 'longtext', 'number', 'money', 'percent', 'email', 'phone', 'select', 'date', 'nif'];
const NUMERIC = new Set(['number', 'money', 'percent']);
// Answers that live in both places: whatever the question saves, the other side gets it too.
const MIRROR: [string, string][] = [['presupuesto', 'presupuesto'], ['zona', 'zonas'], ['nombre', 'nombre']];
const INTEREST_TO_TYPE: Record<string, string> = { comprar: 'comprador', vender: 'vendedor', alquilar: 'arrendatario', invertir: 'inversor', reservar: 'huesped' };

// ---- Text helpers ----

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pad = (n: number) => String(n).padStart(2, '0');
const stampOf = (d: Date) => `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const quickLabel = (s: string) => (s.length <= QUICK_MAX ? s : `${s.slice(0, QUICK_MAX - 1).trimEnd()}…`);

const HUMAN = /(hablar con (una persona|alguien|un agente|un humano|un asesor)|con una persona|\bun humano\b|\bagente\b|\basesor|llamadme|llam(eis|ais)\b|me podeis llamar)/;
const OPTOUT = /(no me interesa|no estoy interesad|dejad de escribir|^stop$|\bdarme de baja\b|^no,? gracias$)/;
const SKIP = /^(no|paso|prefiero no|ahora no|luego|mejor no|ninguno|nada|no tengo|-)\b/;
const OTHER_DAY = /(otro dia|otra hora|otro momento|mas tarde|otros huecos|ninguno)/;

export function hasKeyword(text: string, keywords: string[]): string | null {
  const t = norm(text);
  for (const k of keywords) {
    const n = norm(k);
    if (n && new RegExp(`(^|[^a-z0-9])${escape(n)}($|[^a-z0-9])`).test(t)) return k.toUpperCase();
  }
  return null;
}

const WORDS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20 };

/** «250.000 €», «250k», «250 mil», «1,5 millones», «tres» → number; null when there is none. */
export function parseAmount(text: string): number | null {
  const t = norm(text);
  const m = t.match(/\d+(?:[.,]\d+)*/);
  let n: number;
  if (m) {
    const raw = m[0];
    let clean: string;
    if (raw.includes('.') && raw.includes(',')) clean = raw.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw) || /^\d{1,3}(,\d{3})+$/.test(raw)) clean = raw.replace(/[.,]/g, '');
    else clean = raw.replace(',', '.');
    n = Number(clean);
    if (!Number.isFinite(n)) return null;
    const after = t.slice((m.index ?? 0) + raw.length).trim();
    if (/^(millon|millones|m\b)/.test(after)) n *= 1e6;
    else if (/^(mil\b|k\b|k$)/.test(after)) n *= 1e3;
  } else {
    const w = t.split(/[^a-z]+/).find((x) => x in WORDS);
    if (!w) return null;
    n = WORDS[w];
  }
  return Math.round(n * 100) / 100;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAY = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** «14/11», «14-11-2026», «14 de noviembre», «mañana» → YYYY-MM-DD, never in the past. */
export function parseDate(text: string, now: Date): string | null {
  const t = norm(text);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return isoDay(d); };
  if (/\bpasado manana\b/.test(t)) return plus(2);
  if (/\bmanana\b/.test(t)) return plus(1);
  if (/\bhoy\b/.test(t)) return plus(0);
  let day: number | undefined, month: number | undefined, year: number | undefined;
  const num = t.match(/\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?\b/);
  if (num) { day = Number(num[1]); month = Number(num[2]); if (num[3]) year = Number(num[3].length === 2 ? `20${num[3]}` : num[3]); }
  else {
    const named = t.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})(?:\s+(?:de\s+)?(\d{4}))?/);
    const idx = named ? MONTHS.findIndex((mn, i) => named[2] === mn || named[2] === MONTH_SHORT[i] || (named[2].length >= 3 && mn.startsWith(named[2]))) : -1;
    if (named && idx >= 0) { day = Number(named[1]); month = idx + 1; if (named[3]) year = Number(named[3]); }
  }
  if (!day || !month || month > 12) return null;
  const build = (y: number) => { const d = new Date(y, month! - 1, day!); return d.getMonth() === month! - 1 && d.getDate() === day ? d : null; };
  let d = build(year ?? today.getFullYear());
  if (!d) return null;
  if (!year && d < today) d = build(today.getFullYear() + 1);
  if (!d || d < today) return null;
  return isoDay(d);
}

const dateOf = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00`);
/** «jue 15 oct · 10:00»: short enough for a quick-reply button. */
export const slotLabel = (v: string) => { const d = dateOf(v); return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} · ${v.slice(11, 16)}`; };
/** «el jueves 15 de octubre a las 10:00». */
export const slotLong = (v: string) => { const d = dateOf(v); return `el ${WEEKDAY[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}${v.length >= 16 ? ` a las ${v.slice(11, 16)}` : ''}`; };
const shortDay = (day: string) => { const d = dateOf(day); return `${d.getDate()}/${d.getMonth() + 1}`; };
const addDays = (day: string, n: number) => { const d = dateOf(day); d.setDate(d.getDate() + n); return isoDay(d); };
export const euros = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;

// ---- Reading the blueprint ----

const entityOf = (bp: Blueprint, key: string) => bp.entities.find((e) => e.key === key);
const fieldIn = (e: Entity | undefined, key: string): Field | undefined => e?.fields.find((f) => f.key === key);
const hasOption = (e: Entity | undefined, field: string, value: string) => !!fieldIn(e, field)?.options?.some((o) => o.value === value);
const optionLabel = (e: Entity | undefined, field: string, value: unknown) => fieldIn(e, field)?.options?.find((o) => o.value === value)?.label;

/** The bookable hours the assistant offers: the contacts' list, else any list with hours. */
export function agendaAvailability(bp: Blueprint): Availability | undefined {
  const lists = bp.views.filter((v) => v.type === 'worklist' && v.availability);
  return (lists.find((v) => v.entity === CONTACT) ?? lists[0])?.availability;
}
export const agendaReady = (bp: Blueprint) => !!entityOf(bp, 'cita_inmo') && !!fieldIn(entityOf(bp, 'cita_inmo'), 'cuando') && !!agendaAvailability(bp);
export const reservaReady = (bp: Blueprint) => hasOption(entityOf(bp, 'reserva'), 'estado', 'pendiente') && !!entityOf(bp, 'inmueble');

// ---- Templates ----

export const BOT_TEMPLATES: { key: BotTemplate; name: string; pitch: string }[] = [
  { key: 'compradores', name: 'Compradores', pitch: 'Pregunta qué busca, zona, presupuesto y plazo, y le da cita para ver pisos.' },
  { key: 'vendedores', name: 'Vendedores', pitch: 'Pregunta dónde está la casa, precio y plazo, y le da cita para valorarla.' },
  { key: 'reservas', name: 'Reservas directas', pitch: 'Pregunta fechas y huéspedes, mira qué alojamiento está libre y deja una prerreserva.' },
];

const PLAZO: BotChoice[] = [{ label: 'Cuanto antes', value: 'ya' }, { label: 'En 3–6 meses', value: 'tres_meses' }, { label: 'Más adelante', value: 'mas_adelante' }, { label: 'Solo estoy mirando', value: 'mirando' }];
const PHONE_Q: BotQuestion = { key: 'telefono', text: '¿Me dejas un teléfono para confirmarte la cita? (si prefieres que no, escribe «no»)', entity: 'contacto_inmo', field: 'telefono', optional: true };

/** A ready-made assistant that fits the app: what it can do at the end depends on the pieces it has. */
export function botTemplate(bp: Blueprint, template?: BotTemplate): BotConfig {
  const key: BotTemplate = template ?? (entityOf(bp, 'reserva') && !entityOf(bp, 'operacion') ? 'reservas' : 'compradores');
  const fallback = { mode: 'humano' as const, text: '¡Gracias! Un compañero te escribe enseguida para darte cita.' };
  const base = { enabled: true, template: key, auto: true, anyDm: true };
  if (key === 'reservas') {
    return {
      ...base,
      keywords: ['RESERVA', 'LIBRE', 'PRECIO'],
      commentReply: '¡Te escribo por privado con la disponibilidad! 📩',
      welcome: '¡Hola! 👋 Soy el asistente de {negocio}. Reservando directo no pagas comisiones de plataforma. Te miro la disponibilidad en un momento.',
      questions: [
        { key: 'nombre', text: '¿A nombre de quién hago la reserva?', entity: 'contacto_inmo', field: 'nombre' },
        { key: 'email', text: '¿Un email para mandarte la confirmación? (o escribe «no»)', entity: 'contacto_inmo', field: 'email', optional: true },
      ],
      rules: [
        { entity: 'contacto_inmo', field: 'email', op: 'filled', points: 50 },
        { entity: 'contacto_inmo', field: 'telefono', op: 'filled', points: 30 },
      ],
      hot: 50, warm: 20, qualify: 0,
      finish: reservaReady(bp) ? { mode: 'reserva', text: '¿Qué día llegaríais? Escríbelo así: 14/11.' } : fallback,
      goodbye: 'Te escribimos en cuanto esté confirmada. ¡Gracias!',
    };
  }
  if (key === 'vendedores') {
    return {
      ...base,
      keywords: ['VENDER', 'TASACIÓN', 'VALORACIÓN'],
      commentReply: '¡Te escribo por privado! 📩',
      welcome: '¡Hola! 👋 Soy el asistente de {negocio}. Te hago cuatro preguntas y te damos cita para valorar tu casa, sin compromiso.',
      questions: [
        { key: 'interes', text: '¿Qué quieres hacer con tu vivienda?', entity: 'conversacion', field: 'interes', options: [{ label: 'Venderla', value: 'vender' }, { label: 'Alquilarla', value: 'alquilar' }] },
        { key: 'zona', text: '¿En qué zona está?', entity: 'conversacion', field: 'zona' },
        { key: 'presupuesto', text: '¿Qué precio tienes en mente? Si no lo sabes, escribe «no».', entity: 'conversacion', field: 'presupuesto', optional: true },
        { key: 'plazo', text: '¿Para cuándo te gustaría venderla?', entity: 'conversacion', field: 'plazo', options: PLAZO },
        PHONE_Q,
      ],
      rules: [
        { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'ya', points: 40 },
        { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'tres_meses', points: 25 },
        { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'mirando', points: -40 },
        { entity: 'contacto_inmo', field: 'telefono', op: 'filled', points: 30 },
        { entity: 'conversacion', field: 'presupuesto', op: 'filled', points: 20 },
        { entity: 'conversacion', field: 'zona', op: 'filled', points: 10 },
      ],
      hot: 70, warm: 40, qualify: 40,
      finish: agendaReady(bp) ? { mode: 'agenda', citaTipo: 'tasacion', text: '¿Cuándo pasamos a verla? La valoración es gratis.' } : fallback,
      goodbye: 'Cualquier cosa, escríbeme por aquí. ¡Gracias!',
    };
  }
  return {
    ...base,
    keywords: ['INFO', 'PISO', 'VISITA'],
    commentReply: '¡Te escribo por privado! 📩',
    welcome: '¡Hola! 👋 Soy el asistente de {negocio}. Te hago cuatro preguntas rápidas y te busco un hueco para verlo.',
    questions: [
      { key: 'interes', text: '¿Qué estás buscando?', entity: 'conversacion', field: 'interes', options: [{ label: 'Comprar', value: 'comprar' }, { label: 'Alquilar', value: 'alquilar' }, { label: 'Invertir', value: 'invertir' }, { label: 'Vender mi casa', value: 'vender' }] },
      { key: 'zona', text: '¿En qué zona te gustaría?', entity: 'conversacion', field: 'zona' },
      { key: 'presupuesto', text: '¿Qué presupuesto manejas, más o menos?', entity: 'conversacion', field: 'presupuesto', options: [{ label: 'Hasta 150.000 €', value: '140000' }, { label: '150.000–300.000 €', value: '225000' }, { label: 'Más de 300.000 €', value: '350000' }] },
      { key: 'plazo', text: '¿Para cuándo lo necesitas?', entity: 'conversacion', field: 'plazo', options: PLAZO },
      PHONE_Q,
    ],
    rules: [
      { entity: 'conversacion', field: 'presupuesto', op: 'gte', value: 150000, points: 25 },
      { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'ya', points: 35 },
      { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'tres_meses', points: 20 },
      { entity: 'conversacion', field: 'plazo', op: 'eq', value: 'mirando', points: -40 },
      { entity: 'contacto_inmo', field: 'telefono', op: 'filled', points: 20 },
      { entity: 'conversacion', field: 'interes', op: 'eq', value: 'comprar', points: 10 },
      { entity: 'conversacion', field: 'interes', op: 'eq', value: 'invertir', points: 20 },
    ],
    hot: 70, warm: 40, qualify: 40,
    finish: agendaReady(bp) ? { mode: 'agenda', citaTipo: 'visita', text: '¿Cuándo te viene bien que te enseñemos lo que tenemos?' } : fallback,
    goodbye: 'Cualquier cosa, escríbeme por aquí. ¡Gracias!',
  };
}

/** Keeps an untouched template in step with the pieces; a bot someone edited is left alone. */
export function fitBot(bp: Blueprint): void {
  if (!bp.bot) return;
  const ready = !!entityOf(bp, CONVERSATION) && !!entityOf(bp, CONTACT);
  if (bp.bot.auto) {
    const enabled = bp.bot.enabled;
    bp.bot = botTemplate(bp, bp.bot.template);
    bp.bot.enabled = enabled && ready;
  } else if (!ready) bp.bot.enabled = false;
}

// ---- Scoring ----

const filled = (v: unknown) => v !== undefined && v !== null && v !== '';
export function ruleMatches(r: BotRule, value: unknown): boolean {
  if (r.op === 'filled') return filled(value);
  if (!filled(value)) return false;
  if (r.op === 'eq') return String(value) === String(r.value);
  const n = Number(value), lim = Number(r.value);
  if (!Number.isFinite(n) || !Number.isFinite(lim)) return false;
  return r.op === 'gte' ? n >= lim : n <= lim;
}
export function scoreOf(rules: BotRule[], conv: RecordData, contact: RecordData): number {
  const sum = rules.reduce((s, r) => s + (ruleMatches(r, (r.entity === CONVERSATION ? conv : contact)[r.field]) ? r.points : 0), 0);
  return Math.max(0, Math.min(100, Math.round(sum)));
}
export const temperatureOf = (bot: BotConfig, score: number) => (score >= bot.hot ? 'caliente' : score >= bot.warm ? 'templado' : 'frio');

// ---- Answers ----

function pickChoice<T extends { label: string; value: string }>(text: string, choices: T[]): T | null {
  const t = norm(text).replace(/[¡!¿?.]+/g, '').trim();
  if (!t) return null;
  const label = (c: T) => norm(c.label).replace(/…$/, '');
  return choices.find((c) => label(c) === t || norm(quickLabel(c.label)) === norm(text))
    ?? choices.find((c) => norm(c.value) === t)
    ?? (/^\d$/.test(t) && !choices.some((c) => /^\d/.test(c.label)) ? choices[Number(t) - 1] : undefined)
    ?? choices.find((c) => label(c).length >= 3 && (t.includes(label(c)) || (t.length >= 3 && label(c).startsWith(t))))
    ?? byWord(t, choices, label);
}
// «el ático» → «Ático Ruzafa»: a word of four letters or more that only one choice has.
function byWord<T>(t: string, choices: T[], label: (c: T) => string): T | null {
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const hits = choices.filter((c) => label(c).split(/[^a-z0-9]+/).some((w) => words.includes(w)));
  return hits.length === 1 ? hits[0] : null;
}

/** The value to save for an answer, or null if it doesn't fit the field. */
export function parseAnswer(field: Field, q: BotQuestion | null, text: string, now: Date): unknown {
  if (q?.options?.length) {
    const c = pickChoice(text, q.options);
    if (c) return NUMERIC.has(field.type) ? Number(c.value) : c.value;
  }
  const raw = text.trim();
  if (!raw) return null;
  switch (field.type) {
    case 'select': return pickChoice(text, (field.options ?? []).map((o) => ({ label: o.label, value: o.value })))?.value ?? null;
    case 'number': case 'money': case 'percent': return parseAmount(raw);
    case 'email': return raw.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0].toLowerCase() ?? null;
    case 'phone': { const p = raw.replace(/[^\d+]/g, ''); return p.replace(/\D/g, '').length >= 9 ? raw.replace(/[^\d+ ]/g, '').trim() : null; }
    case 'date': return parseDate(raw, now);
    default: return raw.slice(0, 200);
  }
}

// ---- The conversation ----

interface Rec { id: string; data: RecordData; patch: RecordData; isNew: boolean }

class Run {
  turn: BotTurn = { handled: false, conversationId: null, replies: [], ops: [], notes: [] };
  conv!: Rec;
  contact!: Rec;
  st!: BotState;
  created: BotOp[] = [];
  convE: Entity;
  contactE: Entity;
  constructor(public bp: Blueprint, public bot: BotConfig, public records: AppRecord[], public ev: BotEvent, public now: Date, public newId: () => string) {
    this.convE = entityOf(bp, CONVERSATION)!;
    this.contactE = entityOf(bp, CONTACT)!;
  }
  get user() { return `@${this.ev.username.replace(/^@/, '').trim() || 'usuario'}`; }
  get stamp() { return stampOf(this.now); }
  vars(text: string) {
    const name = String(this.contact?.data.nombre ?? '');
    return text.replace(/\{negocio\}/g, this.bp.name.replace(/\s*\((demo|prueba)\)\s*$/i, '')).replace(/\{nombre\}/g, name.startsWith('@') ? '' : name.split(' ')[0]).replace(/\s+([,!.])/g, '$1');
  }
  set(rec: Rec, e: Entity, key: string, value: unknown) {
    if (key !== '_bot' && !fieldIn(e, key)) return;
    if (value === undefined || value === null || value === '') return;
    rec.data[key] = value;
    rec.patch[key] = value;
  }
  conv_(key: string, v: unknown) { this.set(this.conv, this.convE, key, v); }
  contact_(key: string, v: unknown) { this.set(this.contact, this.contactE, key, v); }
  opt(e: Entity, field: string, value: string) { return hasOption(e, field, value) ? value : undefined; }
  say(text: string, quick?: string[]) {
    this.turn.replies.push(quick?.length ? { text, quick: quick.slice(0, 13).map(quickLabel) } : { text });
  }
  log(who: string, text: string) {
    const line = `[${this.stamp.slice(11)}] ${who}: ${text}`;
    const prev = String(this.conv.data.transcripcion ?? '');
    const next = prev ? `${prev}\n${line}` : line;
    this.conv_('transcripcion', next.length > MAX_TRANSCRIPT ? next.slice(next.length - MAX_TRANSCRIPT).replace(/^[^\n]*\n/, '…\n') : next);
  }
  name() { return String(this.contact.data.nombre || this.conv.data.nombre || this.user); }

  // ---- start ----
  start(keyword: string | null, reuseContact: AppRecord | undefined) {
    const ev = this.ev;
    const contactId = reuseContact?.id ?? this.newId();
    this.contact = { id: contactId, data: { ...(reuseContact?.data ?? {}) }, patch: {}, isNew: !reuseContact };
    if (!reuseContact) {
      this.contact_('nombre', ev.name?.trim() || this.user);
      this.contact_('alta', isoDay(this.now));
    }
    this.contact_('temperatura', this.opt(this.contactE, 'temperatura', 'templado'));
    this.contact_('origen', reuseContact?.data.origen ? undefined : this.opt(this.contactE, 'origen', 'instagram'));
    this.contact_('proxima_accion', 'Respondiendo al asistente de Instagram');
    this.conv = { id: this.newId(), data: {}, patch: {}, isNew: true };
    const handle = this.user.slice(1);
    this.conv_('usuario', this.user);
    this.conv_('nombre', ev.name?.trim());
    this.conv_('canal', this.opt(this.convE, 'canal', 'instagram'));
    this.conv_('estado', 'en_curso');
    this.conv_('disparador', this.opt(this.convE, 'disparador', { comment: 'comentario', story: 'historia', dm: 'dm', ad: 'anuncio' }[ev.kind]));
    this.conv_('palabra_clave', keyword ?? undefined);
    this.conv_('contacto', contactId);
    this.conv_('inicio', this.stamp);
    this.conv_('enlace', /^[a-z0-9._]{1,30}$/i.test(handle) && handle !== 'usuario' ? `https://ig.me/m/${handle}` : undefined);
    this.conv_('ig_id', ev.igId);
    this.st = { step: 0, tries: 0 };
    this.turn.notes.push(reuseContact ? `Nueva conversación con ${this.name()} (ya era contacto)` : `Contacto nuevo: ${this.name()} (origen Instagram)`);
    this.log(this.user, ev.kind === 'comment' ? `(comentario) ${ev.text}` : ev.kind === 'story' ? `(respuesta a historia) ${ev.text}` : ev.text);
    this.say(this.vars(this.bot.welcome));
    if (ev.kind === 'comment' && this.bot.commentReply) this.turn.publicReply = this.vars(this.bot.commentReply);
    this.next(0);
  }

  // ---- continue ----
  resume(conv: AppRecord) {
    this.conv = { id: conv.id, data: { ...conv.data }, patch: {}, isNew: false };
    const c = this.records.find((r) => r.id === conv.data.contacto && r.entity === CONTACT);
    this.contact = c ? { id: c.id, data: { ...c.data }, patch: {}, isNew: false } : { id: this.newId(), data: {}, patch: {}, isNew: true };
    if (!c) { this.contact_('nombre', String(conv.data.nombre || conv.data.usuario || this.user)); this.contact_('temperatura', this.opt(this.contactE, 'temperatura', 'templado')); this.contact_('origen', this.opt(this.contactE, 'origen', 'instagram')); this.conv_('contacto', this.contact.id); }
    this.st = { ...(conv.data._bot as BotState) };
    const text = this.ev.text.trim().slice(0, 1000);
    this.log(this.user, text);
    const t = norm(text);
    if (HUMAN.test(t)) return this.handoff('Te paso con una persona del equipo. Te escribimos por aquí en cuanto podamos.', 'Llamar: lo ha pedido por Instagram');
    if (OPTOUT.test(t)) {
      this.conv_('estado', 'descartado');
      this.contact_('temperatura', this.opt(this.contactE, 'temperatura', 'descartado'));
      this.contact_('proxima_accion', 'No le interesa (Instagram)');
      this.st.step = 'fin';
      this.turn.notes.push('Descartado: no le interesa');
      return this.say('Entendido, no te escribimos más. Si cambias de idea, aquí estamos. ¡Gracias!');
    }
    const step = this.st.step;
    if (typeof step === 'number') return this.answer(step, text);
    if (step === 'slots') return this.pickSlot(text);
    if (step === 'llegada') return this.gotArrival(text);
    if (step === 'noches') return this.gotNights(text);
    if (step === 'huespedes') return this.gotGuests(text);
    if (step === 'alojamiento') return this.pickFlat(text);
  }

  handoff(text: string, action: string) {
    this.conv_('estado', 'humano');
    this.contact_('proxima_accion', action);
    this.st.step = 'fin';
    this.turn.notes.push('Pasa a una persona del equipo');
    this.say(text);
  }

  fieldOf(q: BotQuestion) {
    const f = fieldIn(q.entity === CONVERSATION ? this.convE : this.contactE, q.field);
    return f && !BOT_RESERVED[q.entity]?.includes(f.key) ? f : undefined;
  }

  ask(i: number, prefix = '') {
    const q = this.bot.questions[i];
    const f = this.fieldOf(q)!;
    const quick = q.options?.length ? q.options.map((o) => o.label) : f.type === 'select' ? (f.options ?? []).slice(0, 8).map((o) => o.label) : undefined;
    this.say(`${prefix}${this.vars(q.text)}`, quick);
  }

  next(i: number) {
    while (i < this.bot.questions.length && !this.fieldOf(this.bot.questions[i])) i++;
    if (i < this.bot.questions.length) { this.st = { ...this.st, step: i, tries: 0 }; this.ask(i); } else this.finish();
  }

  answer(i: number, text: string) {
    const q = this.bot.questions[i];
    const f = q && this.fieldOf(q);
    if (!q || !f) return this.next(i + 1);
    if (q.optional && SKIP.test(norm(text))) return this.next(i + 1);
    const value = parseAnswer(f, q, text, this.now);
    if (value === null || value === undefined || value === '') {
      this.st.tries += 1;
      if (this.st.tries >= 2) return this.next(i + 1);
      return this.ask(i, f.type === 'email' ? 'Perdona, no parece un email. ' : f.type === 'phone' ? 'Perdona, no parece un teléfono. ' : 'Perdona, no te he entendido. ');
    }
    this.save(q.entity, f, value);
    this.next(i + 1);
  }

  save(target: BotTarget, f: Field, value: unknown) {
    const [rec, e, other, otherE] = target === CONVERSATION ? [this.conv, this.convE, this.contact, this.contactE] : [this.contact, this.contactE, this.conv, this.convE];
    this.set(rec, e, f.key, value);
    for (const [convKey, contactKey] of MIRROR) {
      const [mine, theirs] = target === CONVERSATION ? [convKey, contactKey] : [contactKey, convKey];
      if (f.key !== mine || !fieldIn(otherE, theirs)) continue;
      // A name always wins over the @ it started with; other answers don't overwrite what the contact had.
      if (theirs === 'nombre' || !filled(other.data[theirs])) this.set(other, otherE, theirs, value);
    }
    if (target === CONVERSATION && f.key === 'interes' && !filled(this.contact.data.tipo)) this.contact_('tipo', this.opt(this.contactE, 'tipo', INTEREST_TO_TYPE[String(value)] ?? ''));
    const shown = f.type === 'select' ? optionLabel(e, f.key, value) ?? String(value) : f.type === 'money' ? euros(Number(value)) : String(value);
    this.turn.notes.push(`${f.label}: ${shown}`);
  }

  summary(outcome?: string) {
    const c = this.conv.data, k = this.contact.data;
    const budget = c.presupuesto ?? k.presupuesto;
    const parts = [
      optionLabel(this.convE, 'interes', c.interes),
      typeof budget === 'number' ? euros(budget) : '',
      String(c.zona ?? k.zonas ?? ''),
      optionLabel(this.convE, 'plazo', c.plazo),
      String(c.fechas ?? ''),
      typeof c.huespedes === 'number' ? `${c.huespedes} ${c.huespedes === 1 ? 'persona' : 'personas'}` : '',
      typeof c.puntuacion === 'number' ? `${c.puntuacion}/100` : '',
      outcome ?? '',
    ].filter(Boolean);
    this.conv_('resumen', parts.join(' · '));
  }

  finish() {
    const score = scoreOf(this.bot.rules, this.conv.data, this.contact.data);
    const temp = temperatureOf(this.bot, score);
    this.conv_('puntuacion', score);
    this.contact_('temperatura', this.opt(this.contactE, 'temperatura', temp));
    this.turn.notes.push(`Puntuación ${score}/100 · ${optionLabel(this.contactE, 'temperatura', temp) ?? temp}`);
    this.summary();
    if (score < this.bot.qualify) {
      this.conv_('estado', 'humano');
      this.contact_('proxima_accion', 'Revisar su conversación de Instagram');
      this.st.step = 'fin';
      this.turn.notes.push('No llega al mínimo: lo revisa una persona');
      return this.say(this.vars(`¡Gracias! Le paso lo que me has contado al equipo y te escriben por aquí. ${this.bot.goodbye}`.trim()));
    }
    this.conv_('estado', 'cualificado');
    this.turn.notes.push('Cualificado');
    const mode = this.bot.finish.mode;
    if (mode === 'agenda' && agendaReady(this.bp)) return this.offerSlots(0);
    if (mode === 'reserva' && reservaReady(this.bp)) {
      this.st = { ...this.st, step: 'llegada', tries: 0 };
      return this.say(this.vars(this.bot.finish.text || '¿Qué día llegaríais? Escríbelo así: 14/11.'));
    }
    this.contact_('proxima_accion', 'Llamar: viene cualificado de Instagram');
    this.st.step = 'fin';
    this.say(this.vars([this.bot.finish.text, this.bot.goodbye].filter(Boolean).join(' ')));
  }

  // ---- agenda ----
  takenSlots() {
    return [...this.records, ...this.created.map((o) => ({ id: o.id, entity: o.entity, data: o.data }))]
      .filter((r) => r.entity === 'cita_inmo' && typeof r.data.cuando === 'string').map((r) => String(r.data.cuando));
  }
  offerSlots(skip: number, prefix = '') {
    const av = agendaAvailability(this.bp)!;
    const days = buildSlots(av, this.takenSlots(), this.now, 12);
    const perDay = days.map((d) => d.slots.find((s) => !s.taken)?.value).filter((v): v is string => !!v);
    const offered = perDay.slice(skip * 3, skip * 3 + 3);
    if (offered.length === 0) return this.handoff(`${prefix}Ahora mismo no me quedan huecos en la agenda. Te paso con el equipo y te dan cita ellos.`, 'Darle cita: no había huecos');
    this.st = { ...this.st, step: 'slots', tries: 0, skip, offered: offered.map((v) => ({ label: slotLabel(v), value: v })) };
    const text = skip === 0 && !prefix ? this.vars(this.bot.finish.text || '¿Cuándo te viene bien?') : `${prefix}¿Y alguno de estos?`;
    this.say(text, [...offered.map(slotLabel), 'Otro día', 'Que me llaméis']);
  }
  pickSlot(text: string) {
    const offered = this.st.offered ?? [];
    const t = norm(text);
    let c = pickChoice(text, offered);
    if (!c) {
      const hour = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(h|horas)?\b/);
      const wd = WEEKDAY.findIndex((w) => t.includes(norm(w)));
      c = offered.find((o) => {
        const d = dateOf(o.value);
        const okDay = wd < 0 || d.getDay() === wd;
        const okHour = !hour || Number(o.value.slice(11, 13)) === Number(hour[1]) && (!hour[2] || o.value.slice(14, 16) === hour[2]);
        return (wd >= 0 || hour) && okDay && okHour;
      }) ?? null;
    }
    if (!c && OTHER_DAY.test(t)) return this.offerSlots((this.st.skip ?? 0) + 1);
    if (!c) {
      this.st.tries += 1;
      if (this.st.tries >= 3) return this.handoff('No te quiero liar: te paso con una persona del equipo y te dan cita.', 'Darle cita (Instagram)');
      return this.say('Elige uno de estos huecos o escribe «otro día».', [...offered.map((o) => o.label), 'Otro día', 'Que me llaméis']);
    }
    if (this.takenSlots().some((v) => v.slice(0, 16) === c!.value)) return this.offerSlots(this.st.skip ?? 0, 'Ese hueco se acaba de ocupar. ');
    const citaE = entityOf(this.bp, 'cita_inmo')!;
    const interes = String(this.conv.data.interes ?? '');
    const tipo = (interes === 'vender' && this.opt(citaE, 'tipo', 'tasacion')) || (this.bot.finish.citaTipo && this.opt(citaE, 'tipo', this.bot.finish.citaTipo)) || this.opt(citaE, 'tipo', 'visita');
    const tipoLabel = (tipo && optionLabel(citaE, 'tipo', tipo)) || 'Cita';
    const data: RecordData = {};
    const put = (k: string, v: unknown) => { if (fieldIn(citaE, k) && filled(v)) data[k] = v; };
    put(citaE.titleField, `${tipoLabel} con ${this.name()}`);
    put('tipo', tipo);
    put('cuando', c.value);
    put('contacto', this.contact.id);
    put('resultado', this.opt(citaE, 'resultado', 'pendiente'));
    put('notas', `Agendada por el asistente de Instagram (${this.user}).`);
    const id = this.newId();
    this.created.push({ op: 'create', entity: 'cita_inmo', id, data });
    this.conv_('estado', 'agendado');
    this.contact_('seguimiento', c.value);
    this.contact_('proxima_accion', `${tipoLabel} ${slotLong(c.value)}`);
    this.summary(`${tipoLabel} ${slotLabel(c.value)}`);
    this.st = { ...this.st, step: 'fin', offered: undefined };
    this.turn.notes.push(`Cita creada: ${tipoLabel.toLowerCase()} ${slotLong(c.value)}`);
    this.say(this.vars(`¡Hecho! Te apunto: ${tipoLabel.toLowerCase()} ${slotLong(c.value)}. ${this.bot.goodbye}`.trim()));
  }

  // ---- bookings ----
  gotArrival(text: string) {
    const day = parseDate(text, this.now);
    if (!day) return this.retry('Perdona, no he entendido la fecha. Escríbela así: 14/11.');
    this.st = { ...this.st, step: 'noches', tries: 0, llegada: day };
    this.say(`Llegada ${slotLong(day)}. ¿Cuántas noches?`, ['2', '3', '4', '5', '7']);
  }
  gotNights(text: string) {
    const n = parseAmount(text);
    if (!n || n < 1 || n > 30 || !Number.isInteger(n)) return this.retry('¿Cuántas noches? Escribe un número, por ejemplo 3.');
    this.st = { ...this.st, step: 'huespedes', tries: 0, noches: n };
    this.say('¿Cuántas personas seréis?', ['1', '2', '3', '4', '5', '6+']);
  }
  gotGuests(text: string) {
    const n = parseAmount(text);
    if (!n || n < 1 || n > 30 || !Number.isInteger(n)) return this.retry('¿Cuántas personas? Escribe un número, por ejemplo 2.');
    this.st = { ...this.st, huespedes: n };
    const llegada = this.st.llegada!, noches = this.st.noches!;
    this.conv_('huespedes', n);
    this.conv_('fechas', `${shortDay(llegada)} → ${shortDay(addDays(llegada, noches))} (${noches} ${noches === 1 ? 'noche' : 'noches'})`);
    this.conv_('interes', filled(this.conv.data.interes) ? undefined : this.opt(this.convE, 'interes', 'reservar'));
    if (!filled(this.contact.data.tipo)) this.contact_('tipo', this.opt(this.contactE, 'tipo', 'huesped'));
    this.offerFlats();
  }
  retry(text: string) {
    this.st.tries += 1;
    if (this.st.tries >= 3) return this.handoff('Te paso con una persona del equipo para cerrar las fechas contigo.', 'Cerrar fechas de la reserva (Instagram)');
    this.say(text);
  }
  freeFlats() {
    const llegada = this.st.llegada!, salida = addDays(llegada, this.st.noches!), n = this.st.huespedes!;
    const inmE = entityOf(this.bp, 'inmueble');
    const all = [...this.records, ...this.created.map((o) => ({ id: o.id, entity: o.entity, data: o.data }))];
    const bookings = all.filter((r) => r.entity === 'reserva' && r.data.estado !== 'cancelada');
    return this.records
      .filter((r) => r.entity === 'inmueble' && (!fieldIn(inmE, 'operacion') || r.data.operacion === 'turistico'))
      .filter((r) => !(Number(r.data.capacidad) > 0) || Number(r.data.capacidad) >= n)
      .filter((r) => !bookings.some((b) => b.data.alojamiento === r.id && String(b.data.entrada).slice(0, 10) < salida && String(b.data.salida).slice(0, 10) > llegada))
      .map((r) => {
        const name = String(r.data[inmE?.titleField ?? 'direccion'] ?? r.data.referencia ?? 'Alojamiento').split(' · ')[0];
        const night = Number(r.data.precio_noche);
        const price = night > 0 ? night * this.st.noches! + (Number(r.data.tarifa_limpieza) || 0) : undefined;
        return { id: r.id, name, price };
      })
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  offerFlats(prefix = '') {
    const flats = this.freeFlats().slice(0, 3);
    const noches = this.st.noches!;
    if (flats.length === 0) {
      this.summary('Sin disponibilidad');
      return this.handoff(`${prefix}Para esas fechas no me queda nada libre para ${this.st.huespedes} ${this.st.huespedes === 1 ? 'persona' : 'personas'}. Le paso tu petición al equipo por si se puede hacer algo.`, `Buscarle alojamiento: ${String(this.conv.data.fechas ?? '')}`);
    }
    this.st = { ...this.st, step: 'alojamiento', tries: 0, offered: flats.map((f) => ({ label: quickLabel(f.name), value: f.id })) };
    const lines = flats.map((f) => `• ${f.name}: ${noches} ${noches === 1 ? 'noche' : 'noches'}${f.price ? `, unos ${euros(f.price)}` : ''}`);
    this.say(`${prefix}Del ${shortDay(this.st.llegada!)} al ${shortDay(addDays(this.st.llegada!, noches))} tengo libre:\n${lines.join('\n')}\n¿Cuál te guardo?`, [...flats.map((f) => f.name), 'Que me llaméis']);
  }
  pickFlat(text: string) {
    const c = pickChoice(text, this.st.offered ?? []);
    if (!c) return this.retry('Elige uno de los alojamientos de la lista.');
    const flat = this.freeFlats().find((f) => f.id === c.value);
    if (!flat) return this.offerFlats('Ese se acaba de ocupar. ');
    const resE = entityOf(this.bp, 'reserva')!;
    const llegada = this.st.llegada!, noches = this.st.noches!, salida = addDays(llegada, noches);
    const data: RecordData = {};
    const put = (k: string, v: unknown) => { if (fieldIn(resE, k) && filled(v)) data[k] = v; };
    put(resE.titleField, this.name());
    put('alojamiento', flat.id);
    put('canal', this.opt(resE, 'canal', 'directa'));
    put('entrada', llegada);
    put('salida', salida);
    put('estado', 'pendiente');
    put('huespedes', this.st.huespedes);
    put('importe', flat.price);
    put('pago', this.opt(resE, 'pago', 'pendiente'));
    put('telefono', this.contact.data.telefono);
    put('email', this.contact.data.email);
    put('notas', `Pedida por Instagram (${this.user}). Pendiente de confirmar: confírmala y envía tú la forma de pago; el asistente no cobra nada.`);
    const id = this.newId();
    this.created.push({ op: 'create', entity: 'reserva', id, data });
    this.conv_('estado', 'reservado');
    this.conv_('inmueble', flat.id);
    this.contact_('temperatura', this.opt(this.contactE, 'temperatura', 'caliente'));
    this.contact_('proxima_accion', 'Confirmar la prerreserva y enviarle la forma de pago');
    this.summary(`Prerreserva ${flat.name}`);
    this.st = { ...this.st, step: 'fin', offered: undefined };
    this.turn.notes.push(`Reserva pendiente: ${flat.name}, ${shortDay(llegada)} → ${shortDay(salida)}`);
    const n = this.st.huespedes!;
    this.say(this.vars(`¡Te la guardo! ${flat.name}, del ${shortDay(llegada)} al ${shortDay(salida)} (${noches} ${noches === 1 ? 'noche' : 'noches'}, ${n} ${n === 1 ? 'persona' : 'personas'})${flat.price ? `: unos ${euros(flat.price)}` : ''}. Es una prerreserva: un compañero te la confirma y te dice cómo pagar. Por aquí no se cobra nada. ${this.bot.goodbye}`.trim()));
  }

  // ---- output ----
  done(): BotTurn {
    for (const m of this.turn.replies) this.log('Asistente', m.quick?.length ? `${m.text} [${m.quick.join(' | ')}]` : m.text);
    this.conv_('ultima_actividad', this.stamp);
    this.conv_('_bot', this.st);
    if (this.ev.kind === 'comment' && this.turn.replies.length > 1) {
      // A comment gets one private reply: everything in one message, with the choices written out.
      const last = this.turn.replies[this.turn.replies.length - 1];
      const text = this.turn.replies.map((m) => m.text).join('\n\n') + (last.quick?.length ? `\n\nResponde: ${last.quick.join(' · ')}` : '');
      this.turn.replies = [{ text }];
    } else if (this.ev.kind === 'comment' && this.turn.replies[0]?.quick?.length) {
      const m = this.turn.replies[0];
      this.turn.replies = [{ text: `${m.text}\n\nResponde: ${m.quick!.join(' · ')}` }];
    }
    const ops: BotOp[] = [];
    if (this.contact.isNew) ops.push({ op: 'create', entity: CONTACT, id: this.contact.id, data: this.contact.data });
    if (this.conv.isNew) ops.push({ op: 'create', entity: CONVERSATION, id: this.conv.id, data: this.conv.data });
    ops.push(...this.created);
    if (!this.contact.isNew && Object.keys(this.contact.patch).length) ops.push({ op: 'update', entity: CONTACT, id: this.contact.id, data: this.contact.patch });
    if (!this.conv.isNew && Object.keys(this.conv.patch).length) ops.push({ op: 'update', entity: CONVERSATION, id: this.conv.id, data: this.conv.patch });
    this.turn.ops = ops;
    this.turn.conversationId = this.conv.id;
    return this.turn;
  }
}

const isActive = (r: AppRecord) => {
  const st = r.data._bot as BotState | undefined;
  return !!st && st.step !== 'fin' && (r.data.estado === 'en_curso' || r.data.estado === 'cualificado');
};

/**
 * One step of the assistant. `records` are the app's records as they are now
 * (the caller applies the returned ops, rewriting new ids, see applyBotOps).
 */
export function runBot(bp: Blueprint, records: AppRecord[], ev: BotEvent, opts: { now: Date; newId: () => string }): BotTurn {
  const empty: BotTurn = { handled: false, conversationId: null, replies: [], ops: [], notes: [] };
  const bot = bp.bot;
  if (!bot?.enabled || !entityOf(bp, CONVERSATION) || !entityOf(bp, CONTACT) || !ev.text.trim()) return empty;
  const user = `@${ev.username.replace(/^@/, '').trim()}`;
  const mine = records
    .filter((r) => r.entity === CONVERSATION && (ev.igId ? r.data.ig_id === ev.igId : r.data.usuario === user))
    .sort((a, b) => String(b.data.inicio ?? '').localeCompare(String(a.data.inicio ?? '')));
  const last = mine[0];
  const run = new Run(bp, bot, records, ev, opts.now, opts.newId);

  if (last && isActive(last)) {
    // Already talking in private: a new comment doesn't restart anything.
    if (ev.kind === 'comment') return { ...empty, conversationId: last.id };
    run.resume(last);
    const turn = run.done();
    turn.handled = turn.replies.length > 0;
    return turn;
  }

  const keyword = hasKeyword(ev.text, bot.keywords);
  // Comments need a keyword; ads always start; a DM or a story reply needs a keyword or «any DM» (and no earlier chat).
  const starts = ev.kind === 'comment' ? !!keyword : ev.kind === 'ad' ? true : !!keyword || (bot.anyDm && !last);
  if (!starts) {
    if (!last || ev.kind === 'comment') return empty;
    // A person has this one now: keep the message in the history, say nothing.
    run.conv = { id: last.id, data: { ...last.data }, patch: {}, isNew: false };
    run.log(user, ev.text.trim().slice(0, 1000));
    run.conv_('ultima_actividad', stampOf(opts.now));
    return { ...empty, conversationId: last.id, ops: [{ op: 'update', entity: CONVERSATION, id: last.id, data: run.conv.patch }] };
  }
  const contact = records.find((r) => r.entity === CONTACT && r.id === last?.data.contacto);
  run.start(keyword, contact);
  const turn = run.done();
  turn.handled = true;
  return turn;
}

/**
 * Applies a turn's ops through a store (the app's API in the browser, the
 * database on the server). New records get their real ids from the store,
 * and links to them in later ops are rewritten.
 */
export async function applyBotOps(ops: BotOp[], store: {
  create: (entity: string, data: RecordData) => Promise<string>;
  update: (id: string, patch: RecordData) => Promise<void>;
}): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const swap = (data: RecordData) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'string' && ids.has(v) ? ids.get(v) : v]));
  for (const op of ops) {
    if (op.op === 'create') ids.set(op.id, await store.create(op.entity, swap(op.data)));
    else await store.update(ids.get(op.id) ?? op.id, swap(op.data));
  }
  return ids;
}

/**
 * The blueprint with an edited assistant, ready to propose. An edited one stops
 * following the template, and a booking assistant brings the «por confirmar»
 * state to older apps whose bookings don't have it yet.
 */
export function withBot(bp: Blueprint, bot: BotConfig): Blueprint {
  const next: Blueprint = JSON.parse(JSON.stringify(bp));
  next.bot = { ...JSON.parse(JSON.stringify(bot)), auto: false };
  const estado = fieldIn(entityOf(next, 'reserva'), 'estado');
  if (bot.finish.mode === 'reserva' && estado?.type === 'select' && !estado.options?.some((o) => o.value === 'pendiente')) {
    estado.options = [{ value: 'pendiente', label: 'Por confirmar', color: 'amber' }, ...(estado.options ?? [])];
  }
  return next;
}
