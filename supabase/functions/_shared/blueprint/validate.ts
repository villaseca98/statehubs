import { ACTION_KINDS, ANALYSIS_LENSES, FIELD_TYPES, OPTION_COLORS, VIEW_TYPES } from './types.ts';
import type { Availability, Blueprint, Entity, Field, View } from './types.ts';

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
  return errors;
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
const ACTION_FIELD: Record<string, string[]> = { call: ['phone'], whatsapp: ['phone'], email: ['email'], schedule: ['datetime'], launch: ['longtext'], webhook: ['url'] };

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
