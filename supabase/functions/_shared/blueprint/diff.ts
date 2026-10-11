import type { Blueprint, Entity, Field, View } from './types.ts';

// One line of "what changes", in plain Spanish, shown before applying.
// `data` notes what happens to existing records, so nobody loses work by surprise.
export interface Change {
  kind: 'add' | 'remove' | 'change';
  text: string;
  data?: string;
}

const TYPE_LABEL: Record<string, string> = {
  text: 'texto', longtext: 'texto largo', number: 'número', money: 'importe (€)', percent: 'porcentaje',
  date: 'fecha', datetime: 'fecha y hora', boolean: 'sí/no', email: 'email', phone: 'teléfono', url: 'enlace', select: 'lista de opciones',
  relation: 'relación', nif: 'NIF/CIF',
};
const VIEW_LABEL: Record<string, string> = { table: 'tabla', kanban: 'tablero', calendar: 'calendario', dashboard: 'panel', worklist: 'lista de trabajo' };

const byKey = <T extends { key: string }>(list: T[] = []) => new Map(list.map((x) => [x.key, x]));

export function diffBlueprints(before: Blueprint | null, after: Blueprint): Change[] {
  const out: Change[] = [];
  if (!before) {
    out.push({ kind: 'add', text: `Crear la aplicación «${after.name}».` });
    for (const e of after.entities) out.push({ kind: 'add', text: `${e.labelPlural}: ${e.fields.map((f) => f.label).join(', ')}.` });
    for (const v of after.views) out.push({ kind: 'add', text: `Pantalla «${v.label}» (${VIEW_LABEL[v.type]}).` });
    return out;
  }

  if (before.name !== after.name) out.push({ kind: 'change', text: `Renombrar la aplicación de «${before.name}» a «${after.name}».` });

  const oldE = byKey(before.entities);
  const newE = byKey(after.entities);
  for (const [k, e] of newE) if (!oldE.has(k)) out.push({ kind: 'add', text: `Nueva sección ${e.labelPlural} con ${e.fields.length} campos.` });
  for (const [k, e] of oldE) {
    if (!newE.has(k)) out.push({ kind: 'remove', text: `Quitar la sección ${e.labelPlural}.`, data: 'Sus registros se ocultan pero no se borran; deshaciendo el cambio vuelven.' });
  }
  for (const [k, n] of newE) {
    const o = oldE.get(k);
    if (o) out.push(...diffEntity(o, n));
  }

  const oldV = byKey(before.views);
  const newV = byKey(after.views);
  for (const [k, v] of newV) {
    const o = oldV.get(k);
    if (!o) out.push({ kind: 'add', text: `Nueva pantalla «${v.label}» (${VIEW_LABEL[v.type]}).` });
    else if (JSON.stringify(o) !== JSON.stringify(v)) out.push({ kind: 'change', text: viewChangeText(o, v) });
  }
  for (const [k, v] of oldV) if (!newV.has(k)) out.push({ kind: 'remove', text: `Quitar la pantalla «${v.label}».`, data: 'Los datos no cambian.' });

  const order = (b: Blueprint) => b.views.map((v) => v.key).filter((k) => oldV.has(k) && newV.has(k)).join();
  if (order(before) !== order(after)) out.push({ kind: 'change', text: 'Cambiar el orden del menú.' });
  return out;
}

function diffEntity(o: Entity, n: Entity): Change[] {
  const out: Change[] = [];
  const where = n.labelPlural;
  if (o.label !== n.label || o.labelPlural !== n.labelPlural) out.push({ kind: 'change', text: `Renombrar ${o.labelPlural} a ${n.labelPlural}.` });
  const of = byKey(o.fields);
  const nf = byKey(n.fields);
  for (const [k, f] of nf) {
    const prev = of.get(k);
    if (!prev) {
      out.push({ kind: 'add', text: `${where}: nuevo campo «${f.label}» (${TYPE_LABEL[f.type]})${f.required ? ', obligatorio' : ''}.`, data: f.required ? 'Los registros que ya existen lo tendrán vacío hasta que lo rellenes.' : undefined });
    } else {
      out.push(...diffField(where, prev, f));
    }
  }
  for (const [k, f] of of) {
    if (!nf.has(k)) out.push({ kind: 'remove', text: `${where}: quitar el campo «${f.label}».`, data: 'El dato se oculta pero se guarda; deshaciendo el cambio vuelve.' });
  }
  if (o.titleField !== n.titleField) out.push({ kind: 'change', text: `${where}: el nombre de cada registro pasa a ser «${nf.get(n.titleField)?.label}».` });
  return out;
}

function diffField(where: string, o: Field, n: Field): Change[] {
  const out: Change[] = [];
  if (o.label !== n.label) out.push({ kind: 'change', text: `${where}: renombrar «${o.label}» a «${n.label}».` });
  if (o.type !== n.type) {
    out.push({ kind: 'change', text: `${where}: «${n.label}» pasa de ${TYPE_LABEL[o.type]} a ${TYPE_LABEL[n.type]}.`, data: 'Los valores que no encajen con el nuevo tipo se ven como texto hasta que los corrijas.' });
  }
  if (!!o.required !== !!n.required) out.push({ kind: 'change', text: `${where}: «${n.label}» ${n.required ? 'pasa a ser obligatorio' : 'deja de ser obligatorio'}.` });
  if (o.type === 'select' && n.type === 'select') {
    const ov = new Map((o.options ?? []).map((x) => [x.value, x]));
    const nv = new Map((n.options ?? []).map((x) => [x.value, x]));
    const added = [...nv.values()].filter((x) => !ov.has(x.value)).map((x) => x.label);
    const removed = [...ov.values()].filter((x) => !nv.has(x.value)).map((x) => x.label);
    const renamed = [...nv.values()].filter((x) => ov.has(x.value) && ov.get(x.value)!.label !== x.label);
    if (added.length) out.push({ kind: 'add', text: `${where}: nuevas opciones en «${n.label}»: ${added.join(', ')}.` });
    if (removed.length) out.push({ kind: 'remove', text: `${where}: quitar opciones de «${n.label}»: ${removed.join(', ')}.`, data: 'Los registros con esas opciones las conservan y se ven en gris.' });
    for (const r of renamed) out.push({ kind: 'change', text: `${where}: la opción «${ov.get(r.value)!.label}» pasa a llamarse «${r.label}».` });
    const order = (f: Field) => (f.options ?? []).map((x) => x.value).filter((v) => ov.has(v) && nv.has(v)).join();
    if (order(o) !== order(n)) out.push({ kind: 'change', text: `${where}: nuevo orden de las opciones de «${n.label}».` });
  }
  if (o.relation !== n.relation && n.type === 'relation') out.push({ kind: 'change', text: `${where}: «${n.label}» ahora enlaza con otra sección.` });
  return out;
}

function viewChangeText(o: View, n: View): string {
  if (o.type !== n.type) return `La pantalla «${n.label}» pasa de ${VIEW_LABEL[o.type]} a ${VIEW_LABEL[n.type]}.`;
  if (o.label !== n.label) return `Renombrar la pantalla «${o.label}» a «${n.label}».`;
  if (JSON.stringify(o.columns) !== JSON.stringify(n.columns)) return `Cambiar las columnas de «${n.label}».`;
  if (n.type === 'dashboard') return `Cambiar los indicadores de «${n.label}».`;
  if (JSON.stringify(o.actions) !== JSON.stringify(n.actions)) return `Cambiar las acciones de «${n.label}».`;
  if (JSON.stringify(o.availability) !== JSON.stringify(n.availability)) return `Cambiar los horarios disponibles de «${n.label}».`;
  return `Ajustar la pantalla «${n.label}».`;
}
