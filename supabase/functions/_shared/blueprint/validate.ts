import { ACTION_KINDS, ANALYSIS_LENSES, BOT_FINISH_MODES, BOT_RULE_OPS, BOT_TARGETS, FIELD_TYPES, OPTION_COLORS, VIEW_TYPES } from './types.ts';
import type { Availability, Blueprint, BotConfig, Entity, Field, View } from './types.ts';
import { BOT_FIELD_TYPES, BOT_RESERVED, agendaReady, norm, reservaReady } from './bot.ts';

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_LOGO = 200_000;
const NUMERIC = new Set(['number', 'money', 'percent']);
const DATE_TYPES = new Set(['date', 'datetime']);
const TITLE_TYPES = new Set(['text', 'email', 'phone', 'nif', 'url']);

// Returns a list of problems in plain Spanish; empty means valid.
// The agent gets these back verbatim when its proposal is rejected.
export function validateBlueprint(bp: unknown): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (!bp || typeof bp !== 'object') return ['El plano no es un objeto.'];
  const b = bp as Blueprint;

  if (b.version !== 1) err('version debe ser 1.');
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 60) err('name es obligatorio (máx. 60 caracteres).');
  if (b.kind !== undefined && b.kind !== 'crm' && b.kind !== 'erp') err('kind debe ser crm o erp.');
  if (b.modules !== undefined && (!Array.isArray(b.modules) || b.modules.some((m) => typeof m !== 'string'))) err('modules debe ser una lista de claves.');
  // [SECURITY] Only small raster images as data URLs: no SVG (it can carry script) and no remote URLs.
  if (b.logo !== undefined && (typeof b.logo !== 'string' || b.logo.length > MAX_LOGO || !LOGO.test(b.logo))) err('logo debe ser una imagen PNG, JPEG o WebP pequeña.');
  if (b.sector !== undefined && (typeof b.sector !== 'string' || !KEY.test(b.sector))) err('sector debe ser una clave.');
  if (!Array.isArray(b.entities) || b.entities.length === 0) return [...errors, 'Hace falta al menos una entidad.'];
  if (b.entities.length > 30) err('Máximo 30 entidades.');
  if (!Array.isArray(b.views) || b.views.length === 0) err('Hace falta al menos una vista.');

  const entities = new Map<string, Entity>();
  for (const e of b.entities) {
    if (!e || typeof e !== 'object') { err('Hay una entidad vacía.'); continue; }
    if (!KEY.test(e.key ?? '')) { err(`Clave de entidad no válida: "${e.key}" (minúsculas, números y _).`); continue; }
    if (entities.has(e.key)) err(`Entidad repetida: ${e.key}.`);
    entities.set(e.key, e);
    if (!e.label || !e.labelPlural) err(`${e.key}: faltan label o labelPlural.`);
    if (!Array.isArray(e.fields) || e.fields.length === 0) { err(`${e.key}: necesita campos.`); continue; }
    if (e.fields.length > 60) err(`${e.key}: máximo 60 campos.`);
    const seen = new Set<string>();
    for (const f of e.fields) {
      if (!KEY.test(f?.key ?? '')) { err(`${e.key}: clave de campo no válida "${f?.key}".`); continue; }
      if (seen.has(f.key)) err(`${e.key}: campo repetido ${f.key}.`);
      seen.add(f.key);
      if (!f.label) err(`${e.key}.${f.key}: falta label.`);
      if (!FIELD_TYPES.includes(f.type)) err(`${e.key}.${f.key}: tipo "${f.type}" no existe. Tipos: ${FIELD_TYPES.join(', ')}.`);
      if (f.type === 'select') checkOptions(e.key, f, err);
      if (f.type !== 'select' && f.options) err(`${e.key}.${f.key}: solo los campos select llevan options.`);
    }
    const title = e.fields.find((f) => f.key === e.titleField);
    if (!title) err(`${e.key}: titleField "${e.titleField}" no es un campo de la entidad.`);
    else if (!TITLE_TYPES.has(title.type)) err(`${e.key}: titleField debe ser de texto.`);
  }

  // Relations need the whole entity map, so check them after the first pass.
  for (const e of entities.values()) {
    for (const f of e.fields ?? []) {
      if (f.type === 'relation' && !entities.has(f.relation ?? '')) err(`${e.key}.${f.key}: relation apunta a "${f.relation}", que no existe.`);
    }
  }

  const fieldOf = (entity: string, key?: string): Field | undefined => entities.get(entity)?.fields.find((f) => f.key === key);
  const viewKeys = new Set<string>();
  for (const v of b.views ?? []) {
    if (!KEY.test(v?.key ?? '')) { err(`Clave de vista no válida "${v?.key}".`); continue; }
    if (viewKeys.has(v.key)) err(`Vista repetida: ${v.key}.`);
    viewKeys.add(v.key);
    if (!v.label) err(`Vista ${v.key}: falta label.`);
    if (!VIEW_TYPES.includes(v.type)) { err(`Vista ${v.key}: tipo "${v.type}" no existe.`); continue; }
    if (v.type === 'dashboard') {
      if (!Array.isArray(v.widgets) || v.widgets.length === 0) err(`Vista ${v.key}: un panel necesita widgets.`);
      for (const w of v.widgets ?? []) {
        if (!entities.has(w.entity)) { err(`Vista ${v.key}: widget "${w.label}" usa la entidad "${w.entity}", que no existe.`); continue; }
        if (!['metric', 'bars'].includes(w.kind)) err(`Vista ${v.key}: widget "${w.label}" tiene kind no válido.`);
        if (!['count', 'sum', 'avg'].includes(w.agg)) err(`Vista ${v.key}: widget "${w.label}" tiene agg no válido.`);
        if (w.agg !== 'count' && !NUMERIC.has(fieldOf(w.entity, w.field)?.type ?? '')) err(`Vista ${v.key}: widget "${w.label}" necesita un campo numérico en field.`);
        if (w.kind === 'bars' && fieldOf(w.entity, w.groupBy)?.type !== 'select') err(`Vista ${v.key}: widget "${w.label}" necesita groupBy de tipo select.`);
      }
      continue;
    }
    if (v.type === 'analysis') {
      const a = v.analysis;
      if (!a || typeof a !== 'object') { err(`Vista ${v.key}: un análisis necesita analysis con lenses y staleDays.`); continue; }
      if (!Array.isArray(a.lenses) || a.lenses.length === 0 || a.lenses.some((l) => !ANALYSIS_LENSES.includes(l))) err(`Vista ${v.key}: analysis.lenses es una lista con algunos de: ${ANALYSIS_LENSES.join(', ')}.`);
      if (!Number.isInteger(a.staleDays) || a.staleDays < 1 || a.staleDays > 90) err(`Vista ${v.key}: analysis.staleDays es un número de días entre 1 y 90.`);
      if (a.entities !== undefined && (!Array.isArray(a.entities) || a.entities.length > 8)) err(`Vista ${v.key}: analysis.entities es una lista de hasta 8 entidades.`);
      for (const k of Array.isArray(a.entities) ? a.entities : []) if (!entities.has(k)) err(`Vista ${v.key}: analysis.entities incluye "${k}", que no existe.`);
      continue;
    }
    if (v.type === 'ops') continue;
    if (!entities.has(v.entity ?? '')) { err(`Vista ${v.key}: la entidad "${v.entity}" no existe.`); continue; }
    const ent = v.entity as string;
    if (v.type === 'table') {
      for (const c of v.columns ?? []) if (!fieldOf(ent, c)) err(`Vista ${v.key}: la columna "${c}" no es un campo de ${ent}.`);
    }
    if (v.type === 'kanban') {
      if (fieldOf(ent, v.groupBy)?.type !== 'select') err(`Vista ${v.key}: groupBy debe ser un campo select de ${ent}.`);
      if (v.sumField && !NUMERIC.has(fieldOf(ent, v.sumField)?.type ?? '')) err(`Vista ${v.key}: sumField debe ser numérico.`);
    }
    if (v.type === 'calendar' && !DATE_TYPES.has(fieldOf(ent, v.dateField)?.type ?? '')) err(`Vista ${v.key}: dateField debe ser un campo date o datetime de ${ent}.`);
    if (v.type === 'worklist') checkWorklist(v, entities.get(ent)!, entities, err);
    if (v.type === 'timeline') {
      if (!DATE_TYPES.has(fieldOf(ent, v.startField)?.type ?? '')) err(`Vista ${v.key}: startField debe ser un campo date o datetime de ${ent}.`);
      if (!DATE_TYPES.has(fieldOf(ent, v.endField)?.type ?? '')) err(`Vista ${v.key}: endField debe ser un campo date o datetime de ${ent}.`);
      if (fieldOf(ent, v.rowField)?.type !== 'relation') err(`Vista ${v.key}: rowField debe ser un campo relation de ${ent}.`);
    }
    if (v.type === 'cards') {
      for (const c of v.columns ?? []) if (!fieldOf(ent, c)) err(`Vista ${v.key}: la columna "${c}" no es un campo de ${ent}.`);
      if (v.imageField && fieldOf(ent, v.imageField)?.type !== 'url') err(`Vista ${v.key}: imageField debe ser un campo url de ${ent}.`);
    }
    if ((v.type === 'timeline' || v.type === 'cards') && v.groupBy && fieldOf(ent, v.groupBy)?.type !== 'select') err(`Vista ${v.key}: groupBy debe ser un campo select de ${ent}.`);
  }
  if (b.bot !== undefined) checkBot(b, entities, err);
  return errors;
}

const NUMBER_TYPES = new Set(['number', 'money', 'percent']);
const isText = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

// The Instagram assistant. Its shape is always checked; what it points at only
// while it is switched on, so taking the piece away keeps it, switched off.
function checkBot(b: Blueprint, entities: Map<string, Entity>, err: (m: string) => void) {
  const bot = b.bot as BotConfig;
  const W = 'Asistente de Instagram';
  if (!bot || typeof bot !== 'object') { err(`${W}: bot debe ser un objeto.`); return; }
  if (typeof bot.enabled !== 'boolean') err(`${W}: enabled es true o false.`);
  if (typeof bot.anyDm !== 'boolean') err(`${W}: anyDm es true o false.`);
  if (bot.template !== undefined && !['compradores', 'vendedores', 'reservas'].includes(bot.template)) err(`${W}: template no existe.`);
  if (bot.auto !== undefined && typeof bot.auto !== 'boolean') err(`${W}: auto es true o false.`);
  if (!Array.isArray(bot.keywords) || bot.keywords.length > 20) err(`${W}: keywords es una lista de hasta 20 palabras.`);
  else {
    const seen = new Set<string>();
    for (const k of bot.keywords) {
      if (!isText(k, 2, 30)) { err(`${W}: cada palabra clave tiene entre 2 y 30 letras.`); continue; }
      if (seen.has(norm(k))) err(`${W}: palabra clave repetida «${k}».`);
      seen.add(norm(k));
    }
  }
  if (bot.commentReply !== undefined && !isText(bot.commentReply, 0, 300)) err(`${W}: la respuesta al comentario tiene como mucho 300 caracteres.`);
  if (!isText(bot.welcome, 1, 600)) err(`${W}: el mensaje de bienvenida es obligatorio (máx. 600 caracteres).`);
  if (!isText(bot.goodbye ?? '', 0, 400)) err(`${W}: la despedida tiene como mucho 400 caracteres.`);
  for (const k of ['hot', 'warm', 'qualify'] as const) if (!isInt(bot[k], 0, 100)) err(`${W}: ${k} es un número de 0 a 100.`);
  if (isInt(bot.hot, 0, 100) && isInt(bot.warm, 0, 100) && bot.warm > bot.hot) err(`${W}: «templado desde» no puede ser mayor que «caliente desde».`);
  if (!bot.finish || !BOT_FINISH_MODES.includes(bot.finish.mode)) err(`${W}: finish.mode es ${BOT_FINISH_MODES.join(', ')}.`);
  else if (bot.finish.text !== undefined && !isText(bot.finish.text, 0, 400)) err(`${W}: el mensaje final tiene como mucho 400 caracteres.`);
  if (!Array.isArray(bot.questions) || bot.questions.length > 10) { err(`${W}: questions es una lista de hasta 10 preguntas.`); return; }
  if (!Array.isArray(bot.rules) || bot.rules.length > 15) { err(`${W}: rules es una lista de hasta 15 reglas.`); return; }
  if (!bot.enabled) return;

  if (!entities.has('conversacion') || !entities.has('contacto_inmo')) { err(`${W}: necesita la pieza «Leads de Instagram» (conversaciones y contactos).`); return; }
  const target = (t: unknown) => (BOT_TARGETS.includes(t as never) ? entities.get(t as string) : undefined);
  const keys = new Set<string>();
  bot.questions.forEach((q, i) => {
    const where = `${W}, pregunta ${i + 1}`;
    if (!q || typeof q !== 'object') { err(`${where}: está vacía.`); return; }
    if (!KEY.test(q.key ?? '')) err(`${where}: key no válida.`);
    else if (keys.has(q.key)) err(`${where}: key repetida ${q.key}.`);
    keys.add(q.key);
    if (!isText(q.text, 1, 300)) err(`${where}: el texto es obligatorio (máx. 300 caracteres).`);
    const e = target(q.entity);
    if (!e) { err(`${where}: entity es ${BOT_TARGETS.join(' o ')}.`); return; }
    const f = e.fields.find((x) => x.key === q.field);
    if (!f) { err(`${where}: «${q.field}» no es un campo de ${e.labelPlural}.`); return; }
    if (!BOT_FIELD_TYPES.includes(f.type)) err(`${where}: no puede guardar en «${f.label}» (${f.type}).`);
    if (BOT_RESERVED[q.entity].includes(f.key)) err(`${where}: «${f.label}» lo rellena el asistente solo.`);
    if (q.options !== undefined) {
      if (!Array.isArray(q.options) || q.options.length > 8) { err(`${where}: hasta 8 respuestas rápidas.`); return; }
      const labels = new Set<string>();
      for (const o of q.options) {
        if (!isText(o?.label, 1, 20)) err(`${where}: cada respuesta rápida tiene entre 1 y 20 caracteres (lo pide Instagram).`);
        else if (labels.has(norm(o.label))) err(`${where}: respuesta rápida repetida «${o.label}».`);
        labels.add(norm(o?.label ?? ''));
        if (!isText(o?.value, 1, 200)) err(`${where}: cada respuesta rápida necesita value.`);
        else if (f.type === 'select' && !f.options?.some((x) => x.value === o.value)) err(`${where}: «${o.value}» no es una opción de «${f.label}».`);
        else if (NUMBER_TYPES.has(f.type) && !Number.isFinite(Number(o.value))) err(`${where}: «${o.label}» necesita un número en value.`);
      }
    }
  });
  bot.rules.forEach((r, i) => {
    const where = `${W}, regla ${i + 1}`;
    const e = target(r?.entity);
    const f = e?.fields.find((x) => x.key === r.field);
    if (!e || !f) { err(`${where}: el campo no existe.`); return; }
    if (!BOT_RULE_OPS.includes(r.op)) err(`${where}: op es ${BOT_RULE_OPS.join(', ')}.`);
    if ((r.op === 'gte' || r.op === 'lte') && (!NUMBER_TYPES.has(f.type) || !Number.isFinite(Number(r.value)))) err(`${where}: «mayor o menor que» necesita un campo numérico y un número.`);
    if (r.op === 'eq' && (r.value === undefined || r.value === '')) err(`${where}: «es» necesita un valor.`);
    if (r.op === 'eq' && f.type === 'select' && !f.options?.some((o) => o.value === String(r.value))) err(`${where}: «${r.value}» no es una opción de «${f.label}».`);
    if (!isInt(r.points, -100, 100)) err(`${where}: los puntos van de −100 a 100.`);
  });
  if (bot.finish?.mode === 'agenda') {
    if (!agendaReady(b)) err(`${W}: para dar cita hace falta la Agenda y horario en la lista de Contactos.`);
    const tipo = entities.get('cita_inmo')?.fields.find((f) => f.key === 'tipo');
    if (bot.finish.citaTipo && tipo && !tipo.options?.some((o) => o.value === bot.finish.citaTipo)) err(`${W}: el tipo de cita «${bot.finish.citaTipo}» no existe.`);
  }
  if (bot.finish?.mode === 'reserva' && !reservaReady(b)) err(`${W}: para guardar reservas hacen falta Inmuebles y Reservas con el estado «pendiente».`);
}

function checkOptions(entity: string, f: Field, err: (m: string) => void) {
  if (!Array.isArray(f.options) || f.options.length === 0) { err(`${entity}.${f.key}: un select necesita options.`); return; }
  if (f.options.length > 30) err(`${entity}.${f.key}: máximo 30 opciones.`);
  const values = new Set<string>();
  for (const o of f.options) {
    if (!o?.value || !o.label) err(`${entity}.${f.key}: cada opción necesita value y label.`);
    else if (values.has(o.value)) err(`${entity}.${f.key}: opción repetida ${o.value}.`);
    values.add(o?.value);
    if (o?.color && !OPTION_COLORS.includes(o.color)) err(`${entity}.${f.key}: color "${o.color}" no existe.`);
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const ACTION_FIELD: Record<string, string[]> = { call: ['phone'], whatsapp: ['phone'], email: ['email'], schedule: ['datetime'], launch: ['longtext'], webhook: ['url'], link: ['url'] };

function checkWorklist(v: View, e: Entity, entities: Map<string, Entity>, err: (m: string) => void) {
  const where = `Vista ${v.key}`;
  const field = (k?: string) => e.fields.find((f) => f.key === k);
  for (const c of v.columns ?? []) if (!field(c)) err(`${where}: la columna "${c}" no es un campo de ${e.key}.`);
  const stage = v.groupBy ? field(v.groupBy) : undefined;
  if (v.groupBy && stage?.type !== 'select') err(`${where}: groupBy debe ser un campo select de ${e.key}.`);
  const stages = new Set((stage?.options ?? []).map((o) => o.value));
  if (!Array.isArray(v.actions) || v.actions.length === 0) err(`${where}: una lista de trabajo necesita actions.`);
  if ((v.actions ?? []).length > 12) err(`${where}: máximo 12 acciones.`);
  let schedules = 0;
  for (const a of v.actions ?? []) {
    const name = `${where}: acción "${a?.label}"`;
    if (!a?.label) err(`${where}: cada acción necesita label.`);
    if (!ACTION_KINDS.includes(a?.kind)) { err(`${name} tiene kind no válido. Usa: ${ACTION_KINDS.join(', ')}.`); continue; }
    const need = ACTION_FIELD[a.kind];
    if (need && !need.includes(field(a.field)?.type ?? '')) err(`${name} necesita en field un campo de tipo ${need.join(' o ')}.`);
    if (a.kind === 'move' && !a.to) err(`${name} necesita to (la etapa a la que mueve).`);
    if (a.to && !stages.has(a.to)) err(`${name}: to "${a.to}" no es una opción de groupBy.`);
    for (const w of a.when ?? []) if (!stages.has(w)) err(`${name}: when "${w}" no es una opción de groupBy.`);
    if ((a.to || a.when?.length) && !stage) err(`${name}: to y when necesitan groupBy.`);
    if (a.kind === 'launch') {
      const target = entities.get(a.entity ?? '');
      if (!target) err(`${name} necesita en entity la entidad donde se crean los pasos.`);
      else if (!target.fields.some((f) => f.type === 'relation' && f.relation === e.key)) err(`${name}: ${target.key} necesita un campo relation a ${e.key}.`);
    }
    if (a.kind === 'schedule') schedules++;
  }
  if (schedules && !v.availability) err(`${where}: las acciones schedule necesitan availability.`);
  if (v.availability) checkAvailability(where, v.availability, err);
}

function checkAvailability(where: string, a: Availability, err: (m: string) => void) {
  if (!Array.isArray(a.days) || a.days.length === 0 || a.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) err(`${where}: availability.days son números del 1 (lunes) al 7 (domingo).`);
  if (!HHMM.test(a.from ?? '') || !HHMM.test(a.to ?? '')) { err(`${where}: availability.from y to van en formato HH:MM.`); return; }
  if (minutes(a.from) >= minutes(a.to)) err(`${where}: availability.from debe ser antes que to.`);
  if (!Number.isInteger(a.slotMinutes) || a.slotMinutes < 15 || a.slotMinutes > 240) err(`${where}: availability.slotMinutes entre 15 y 240.`);
  if (!!a.breakFrom !== !!a.breakTo) err(`${where}: breakFrom y breakTo van juntos.`);
  if (a.breakFrom && a.breakTo && (!HHMM.test(a.breakFrom) || !HHMM.test(a.breakTo) || minutes(a.breakFrom) >= minutes(a.breakTo))) err(`${where}: el descanso no es válido.`);
}
