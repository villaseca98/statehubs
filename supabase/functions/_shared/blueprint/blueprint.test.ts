import { describe, expect, it } from 'vitest';
import { validateBlueprint } from './validate.ts';
import { diffBlueprints } from './diff.ts';
import { runAgent, cleanSamples, MAX_ATTEMPTS } from './agent.ts';
import type { CallModel, ContentBlock, ModelRequest } from './agent.ts';
import { DEMO_APPS } from './samples.ts';
import { LOOK } from './look.ts';
import { buildSlots } from './slots.ts';
import { composeApp } from './modules.ts';
import type { Blueprint } from './types.ts';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
// The real-estate demo without its leads list, so indexes below stay stable.
const base = (): Blueprint => {
  const bp = clone(DEMO_APPS[0].blueprint);
  bp.entities = bp.entities.filter((e) => e.key !== 'lead');
  bp.views = bp.views.filter((v) => v.entity !== 'lead');
  return bp;
};
const full = (): Blueprint => clone(DEMO_APPS[0].blueprint);

describe('look', () => {
  it('is a single look: forest green on ivory, with a gold accent', () => {
    expect(LOOK.colors.primary).toBe('#1f5c43');
    expect(LOOK.colors.bg).toBe('#f6f3ea');
    expect(LOOK.colors.accent).toBe('#c8a96a');
  });
});

describe('validateBlueprint', () => {
  it('accepts every demo app', () => {
    for (const app of DEMO_APPS) expect(validateBlueprint(app.blueprint), app.key).toEqual([]);
  });

  it('demo records only use known entities, fields and options', () => {
    for (const app of DEMO_APPS) {
      const ids = new Set(app.records.map((r) => r.id));
      for (const r of app.records) {
        const e = app.blueprint.entities.find((x) => x.key === r.entity);
        expect(e, `${app.key}:${r.id}`).toBeTruthy();
        for (const [k, v] of Object.entries(r.data)) {
          const f = e!.fields.find((x) => x.key === k);
          expect(f, `${app.key}:${r.id}.${k}`).toBeTruthy();
          if (f!.type === 'select') expect(f!.options!.map((o) => o.value)).toContain(v);
          if (f!.type === 'relation') expect(ids.has(String(v))).toBe(true);
        }
      }
    }
  });

  it('rejects non-objects and missing entities', () => {
    expect(validateBlueprint(null)).toEqual(['El plano no es un objeto.']);
    expect(validateBlueprint({ version: 1, name: 'x', entities: [], views: [] })).toContain('Hace falta al menos una entidad.');
  });

  it('catches the mistakes a model is likely to make', () => {
    const bp = base();
    bp.entities[0].fields.push({ key: 'Mal Clave', label: 'x', type: 'text' });
    bp.entities[0].fields.push({ key: 'fase', label: 'Fase', type: 'select' });
    bp.entities[1].fields.push({ key: 'agente', label: 'Agente', type: 'relation', relation: 'agente' });
    bp.entities[2].titleField = 'precio';
    bp.views[0].groupBy = 'importe';
    bp.views[1].dateField = 'titulo';
    bp.views[2].columns = ['nombre', 'no_existe'];
    bp.views.push({ key: 'embudo', label: 'Otra', type: 'table', entity: 'operacion' });
    const errors = validateBlueprint(bp).join('\n');
    expect(errors).toMatch(/clave de campo no válida "Mal Clave"/);
    expect(errors).toMatch(/fase: un select necesita options/);
    expect(errors).toMatch(/relation apunta a "agente"/);
    expect(errors).toMatch(/titleField debe ser de texto/);
    expect(errors).toMatch(/groupBy debe ser un campo select/);
    expect(errors).toMatch(/dateField debe ser un campo date/);
    expect(errors).toMatch(/columna "no_existe"/);
    expect(errors).toMatch(/Vista repetida: embudo/);
  });

  it('checks dashboard widgets', () => {
    const bp = base();
    const dash = bp.views.find((v) => v.type === 'dashboard')!;
    dash.widgets = [
      { kind: 'metric', label: 'Suma', entity: 'operacion', agg: 'sum', field: 'titulo' },
      { kind: 'bars', label: 'Barras', entity: 'operacion', agg: 'count', groupBy: 'importe' },
      { kind: 'metric', label: 'Fantasma', entity: 'nada', agg: 'count' },
    ];
    const errors = validateBlueprint(bp).join('\n');
    expect(errors).toMatch(/"Suma" necesita un campo numérico/);
    expect(errors).toMatch(/"Barras" necesita groupBy de tipo select/);
    expect(errors).toMatch(/"Fantasma" usa la entidad "nada"/);
  });
});

describe('diffBlueprints', () => {
  it('describes a new app', () => {
    const changes = diffBlueprints(null, base());
    expect(changes[0].text).toBe(`Crear la aplicación «${base().name}».`);
    expect(changes.some((c) => c.text.startsWith('Operaciones:'))).toBe(true);
  });

  it('is empty when nothing changes', () => {
    expect(diffBlueprints(base(), base())).toEqual([]);
  });

  it('explains field, option and view changes with data notes', () => {
    const before = base();
    const after = base();
    const op = after.entities[0];
    op.fields.push({ key: 'origen', label: 'Origen', type: 'text', required: true });
    op.fields = op.fields.filter((f) => f.key !== 'comision');
    const etapa = op.fields.find((f) => f.key === 'etapa')!;
    etapa.options = etapa.options!.filter((o) => o.value !== 'perdida');
    etapa.options.find((o) => o.value === 'arras')!.label = 'Reserva';
    etapa.options.push({ value: 'notaria', label: 'Notaría', color: 'teal' });
    after.views = after.views.filter((v) => v.key !== 'visitas');
    after.entities[1].labelPlural = 'Compradores';

    const changes = diffBlueprints(before, after);
    const text = changes.map((c) => c.text).join('\n');
    expect(text).toMatch(/nuevo campo «Origen» \(texto\), obligatorio/);
    expect(text).toMatch(/quitar el campo «Comisión»/);
    expect(text).toMatch(/quitar opciones de «Etapa»: Perdida/);
    expect(text).toMatch(/«Arras» pasa a llamarse «Reserva»/);
    expect(text).toMatch(/nuevas opciones en «Etapa»: Notaría/);
    expect(text).toMatch(/Quitar la pantalla «Visitas»/);
    expect(text).toMatch(/Renombrar Clientes a Compradores/);
    const removedField = changes.find((c) => c.text.includes('quitar el campo'))!;
    expect(removedField.data).toMatch(/no se borr|se guarda/);
  });

  it('flags a type change and removed entity', () => {
    const before = base();
    const after = base();
    after.entities[2].fields.find((f) => f.key === 'metros')!.type = 'text';
    after.entities = after.entities.filter((e) => e.key !== 'inmueble');
    after.entities[0].fields = after.entities[0].fields.filter((f) => f.key !== 'inmueble');
    after.views = after.views.filter((v) => v.entity !== 'inmueble' && v.type !== 'dashboard');
    const text = diffBlueprints(before, after).map((c) => `${c.text} ${c.data ?? ''}`).join('\n');
    expect(text).toMatch(/Quitar la sección Inmuebles\. Sus registros se ocultan pero no se borran/);
  });
});

// A fake model that replays scripted responses and records what it was sent.
function fakeModel(script: Array<(req: ModelRequest) => { content: ContentBlock[]; stop_reason: string }>) {
  const calls: ModelRequest[] = [];
  const callModel: CallModel = async (req) => {
    calls.push(clone(req));
    const step = script[calls.length - 1];
    if (!step) throw new Error('unexpected extra call');
    return step(req);
  };
  return { callModel, calls };
}
const propose = (plano: unknown, extra: Record<string, unknown> = {}) => ({
  content: [
    { type: 'text', text: 'Te preparo el cambio.' },
    { type: 'tool_use', id: `t${Math.random()}`, name: 'proponer_cambios', input: { resumen: 'Añado lo que pides.', plano, ...extra } },
  ],
  stop_reason: 'tool_use',
});

describe('runAgent', () => {
  it('returns a plain answer when the model only talks', async () => {
    const { callModel } = fakeModel([() => ({ content: [{ type: 'text', text: '¿Vendes o alquilas?' }], stop_reason: 'end_turn' })]);
    const res = await runAgent({ callModel, current: null, history: [], message: 'Quiero un CRM' });
    expect(res).toEqual({ reply: '¿Vendes o alquilas?', proposal: null });
  });

  it('creates an app with cleaned sample records', async () => {
    const bp = base();
    const { callModel, calls } = fakeModel([() => propose(bp, {
      ejemplos: [
        { entity: 'cliente', data: { nombre: 'Ana', tipo: 'compra', inventado: 1 } },
        { entity: 'cliente', data: { nombre: 'Leo', tipo: 'no-existe' } },
        { entity: 'operacion', data: { titulo: 'X', cliente: 'c1' } },
        { entity: 'fantasma', data: { a: 1 } },
      ],
    })]);
    const res = await runAgent({ callModel, current: null, history: [], message: 'CRM para inmobiliaria' });
    expect(res.proposal?.blueprint).toEqual(bp);
    expect(res.proposal?.samples).toEqual([
      { entity: 'cliente', data: { nombre: 'Ana', tipo: 'compra' } },
      { entity: 'cliente', data: { nombre: 'Leo' } },
      { entity: 'operacion', data: { titulo: 'X' } },
    ]);
    expect(res.reply).toBe('Añado lo que pides.');
    expect(calls[0].system).toMatch(/Todavía no hay aplicación/);
    expect(calls[0].messages.at(-1)).toEqual({ role: 'user', content: 'CRM para inmobiliaria' });
  });

  it('sends validation errors back and accepts the corrected plan', async () => {
    const bad = base();
    bad.views[0].type = 'inventada' as never;
    const good = base();
    const { callModel, calls } = fakeModel([() => propose(bad), () => propose(good)]);
    const res = await runAgent({ callModel, current: null, history: [], message: 'hazlo' });
    expect(res.proposal?.blueprint.views[0].type).toBe(base().views[0].type);
    const retry = calls[1].messages.at(-1)!.content as ContentBlock[];
    expect(retry[0]).toMatchObject({ type: 'tool_result', is_error: true });
    expect(retry[0].content).toMatch(/inventada/);
  });

  it(`gives up after ${MAX_ATTEMPTS} invalid proposals`, async () => {
    const bad = { version: 2 };
    const { callModel, calls } = fakeModel(Array(MAX_ATTEMPTS).fill(() => propose(bad)));
    const res = await runAgent({ callModel, current: null, history: [], message: 'hazlo' });
    expect(res.proposal).toBeNull();
    expect(res.reply).toMatch(/No he conseguido/);
    expect(calls).toHaveLength(MAX_ATTEMPTS);
  });

  it('includes the current blueprint and skips samples on edits', async () => {
    const current = base();
    const next = base();
    next.entities[1].fields.push({ key: 'dni', label: 'DNI', type: 'nif' });
    const { callModel, calls } = fakeModel([() => propose(next, { ejemplos: [{ entity: 'cliente', data: { nombre: 'Z' } }] })]);
    const res = await runAgent({ callModel, current, history: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'hola' }], message: 'añade DNI' });
    expect(calls[0].system).toContain('"key":"operacion"');
    expect(calls[0].messages).toHaveLength(3);
    expect(res.proposal?.samples).toEqual([]);
    expect(res.proposal?.changes.map((c) => c.text)).toEqual(['Clientes: nuevo campo «DNI» (NIF/CIF).']);
  });

  it('does not propose a no-op', async () => {
    const { callModel } = fakeModel([() => propose(base())]);
    const res = await runAgent({ callModel, current: base(), history: [], message: 'déjalo igual' });
    expect(res.proposal).toBeNull();
    expect(res.reply).toMatch(/ya está así/);
  });

  it('resumes a paused turn', async () => {
    const { callModel, calls } = fakeModel([
      () => ({ content: [{ type: 'text', text: 'Pensando…' }], stop_reason: 'pause_turn' }),
      () => propose(base()),
    ]);
    const res = await runAgent({ callModel, current: null, history: [], message: 'hazlo' });
    expect(calls).toHaveLength(2);
    expect(res.proposal).not.toBeNull();
  });

  it('cleanSamples ignores junk input', () => {
    expect(cleanSamples(base(), 'no')).toEqual([]);
    expect(cleanSamples(base(), [null, { entity: 'cliente' }])).toEqual([]);
  });
});

describe('worklist', () => {
  const leads = (bp: Blueprint) => bp.views.find((v) => v.key === 'leads')!;

  it('the demo leads list is valid', () => {
    expect(validateBlueprint(full())).toEqual([]);
  });

  it('checks actions, stages and availability', () => {
    const bp = full();
    const v = leads(bp);
    v.actions = [
      { kind: 'call', label: 'Llamar', field: 'email' },
      { kind: 'move', label: 'Mover' },
      { kind: 'move', label: 'Raro', to: 'inventado', when: ['tampoco'] },
      { kind: 'schedule', label: 'Agendar', field: 'presupuesto' },
      { kind: 'fax' as never, label: 'Fax' },
    ];
    v.availability = { days: [0, 8], from: '19:00', to: '09:00', slotMinutes: 5, breakFrom: '14:00' };
    const errors = validateBlueprint(bp).join('\n');
    expect(errors).toMatch(/"Llamar" necesita en field un campo de tipo phone/);
    expect(errors).toMatch(/"Mover" necesita to/);
    expect(errors).toMatch(/to "inventado" no es una opción/);
    expect(errors).toMatch(/when "tampoco" no es una opción/);
    expect(errors).toMatch(/"Agendar" necesita en field un campo de tipo datetime/);
    expect(errors).toMatch(/"Fax" tiene kind no válido/);
    expect(errors).toMatch(/days son números del 1/);
    expect(errors).toMatch(/from debe ser antes que to/);
    expect(errors).toMatch(/slotMinutes entre 15 y 240/);
    expect(errors).toMatch(/breakFrom y breakTo van juntos/);
  });

  it('schedule actions need availability', () => {
    const bp = full();
    delete leads(bp).availability;
    expect(validateBlueprint(bp).join()).toMatch(/schedule necesitan availability/);
  });

  it('describes action and availability changes', () => {
    const after = full();
    leads(after).availability!.to = '20:00';
    expect(diffBlueprints(full(), after).map((c) => c.text)).toEqual(['Cambiar los horarios disponibles de «Leads».']);
    const after2 = full();
    leads(after2).actions!.pop();
    expect(diffBlueprints(full(), after2).map((c) => c.text)).toEqual(['Cambiar las acciones de «Leads».']);
  });
});

describe('buildSlots', () => {
  const a = { days: [1, 2, 3, 4, 5], from: '09:00', to: '13:00', slotMinutes: 60, breakFrom: '11:00', breakTo: '12:00' };

  it('skips weekends, the break, past slots today and marks taken ones', () => {
    // Friday 2026-10-09 at 09:30
    const days = buildSlots(a, ['2026-10-12T10:00'], new Date(2026, 9, 9, 9, 30), 2);
    expect(days.map((d) => d.date)).toEqual(['2026-10-09', '2026-10-12']);
    expect(days[0].slots.map((s) => s.time)).toEqual(['10:00', '12:00']);
    expect(days[1].slots.map((s) => [s.time, s.taken])).toEqual([['09:00', false], ['10:00', true], ['12:00', false]]);
  });

  it('marks slots that overlap a Google Calendar busy interval', () => {
    const busy = [{ from: '2026-10-12T09:30', to: '2026-10-12T10:15' }, { from: '2026-10-12T12:00', to: '2026-10-12T12:00' }, { from: '2026-10-12T13:00', to: '2026-10-12T14:00' }];
    const [day] = buildSlots(a, [], new Date(2026, 9, 12, 8, 0), 1, busy);
    expect(day.slots.map((s) => [s.time, s.taken, !!s.google])).toEqual([['09:00', true, true], ['10:00', true, true], ['12:00', false, false]]);
  });

  it('drops a day with nothing left', () => {
    const days = buildSlots(a, [], new Date(2026, 9, 9, 12, 30), 1);
    expect(days[0].date).toBe('2026-10-12');
  });
});

describe('agent on an app built from cards', () => {
  it('keeps kind and modules even if the model leaves them out', async () => {
    const current = composeApp('erp', 'Taller', ['clientes', 'facturas']);
    const { kind: _k, modules: _m, ...plain } = current;
    const next = { ...plain, name: 'Taller Ruiz' };
    const { callModel } = fakeModel([() => propose(next)]);
    const res = await runAgent({ callModel, current, history: [], message: 'llámalo Taller Ruiz' });
    expect(res.proposal?.blueprint).toMatchObject({ kind: 'erp', modules: ['clientes', 'facturas'], name: 'Taller Ruiz' });
  });
});
