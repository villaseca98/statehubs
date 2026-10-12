import { describe, expect, it } from 'vitest';
import { addModule, cardProposal, composeApp, composePack, MODULES, modulesFor, modulesSummary, PACKS, removeModule, sampleRecordsFor, STARTER } from './modules.ts';
import { validateBlueprint } from './validate.ts';

let n = 0;
const newId = () => `id-${++n}`;

describe('modules (cards)', () => {
  it('every module alone, every kind fully loaded and the starters are valid', () => {
    const READERS = ['panel', 'analisis', 'centro'];
    for (const m of MODULES.filter((x) => !READERS.includes(x.key))) expect(validateBlueprint(composeApp(m.kinds[0], 'X', [m.key])), m.key).toEqual([]);
    // Figures, analysis or the operations centre alone have nothing to read: refused, and the UI doesn't offer to create it.
    for (const k of READERS) expect(validateBlueprint(composeApp('crm', 'X', [k]))).not.toEqual([]);
    for (const kind of ['crm', 'erp'] as const) {
      expect(validateBlueprint(composeApp(kind, 'X', modulesFor(kind).map((m) => m.key)))).toEqual([]);
      expect(validateBlueprint(composeApp(kind, 'X', STARTER[kind]))).toEqual([]);
    }
    expect(validateBlueprint(composeApp('crm', 'X', MODULES.map((m) => m.key)))).toEqual([]);
  });

  it('every pair of modules is valid, added in either order', () => {
    for (const a of MODULES) for (const b of MODULES) {
      if (['panel', 'analisis', 'centro'].includes(a.key) && ['panel', 'analisis', 'centro'].includes(b.key)) continue;
      expect(validateBlueprint(composeApp('crm', 'X', [a.key, b.key])), `${a.key}+${b.key}`).toEqual([]);
    }
  });

  it('pulls in the entities a module links to and shares them', () => {
    const bp = composeApp('erp', 'X', ['pedidos', 'facturas']);
    expect(bp.entities.map((e) => e.key).sort()).toEqual(['cliente', 'factura', 'pedido']);
    expect(bp.kind).toBe('erp');
    expect(bp.modules).toEqual(['pedidos', 'facturas']);
  });

  it('removing a module keeps entities others still need and keeps custom edits', () => {
    let bp = composeApp('crm', 'X', ['panel', 'clientes', 'embudo']);
    bp.entities.find((e) => e.key === 'cliente')!.fields.push({ key: 'provincia', label: 'Provincia', type: 'text' });
    bp = removeModule(bp, 'clientes');
    // The pipeline links to clients, so the entity stays (with the custom field), only its screen goes.
    expect(bp.entities.find((e) => e.key === 'cliente')?.fields.some((f) => f.key === 'provincia')).toBe(true);
    expect(bp.views.some((v) => v.entity === 'cliente')).toBe(false);
    bp = removeModule(bp, 'embudo');
    expect(bp.entities.map((e) => e.key)).toEqual([]);
    // The panel only shows figures for what is there.
    bp = addModule(bp, 'facturas');
    const panel = bp.views.find((v) => v.key === 'panel')!;
    expect(panel.widgets!.every((w) => w.entity === 'factura' || w.entity === 'cliente')).toBe(true);
    expect(validateBlueprint(bp)).toEqual([]);
  });

  it('sample rows fit the fields and drop links to missing entities', () => {
    const bp = composeApp('erp', 'X', ['compras']);
    const rows = sampleRecordsFor(bp);
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      const e = bp.entities.find((x) => x.key === r.entity)!;
      for (const k of Object.keys(r.data)) expect(e.fields.some((f) => f.key === k), `${r.entity}.${k}`).toBe(true);
    }
    expect(sampleRecordsFor(composeApp('crm', 'X', ['embudo'])).every((r) => r.entity !== 'oportunidad' || r.data.cliente)).toBe(true);
  });

  it('card proposal: validated, readable summary, samples only for new entities with links rewritten', () => {
    const before = composeApp('erp', 'X', ['clientes']);
    const after = addModule(before, 'pedidos');
    const made = cardProposal(before, after, newId);
    if ('errors' in made) throw new Error(made.errors.join());
    expect(made.proposal.summary).toBe('Añadir Pedidos');
    expect(made.proposal.changes.some((c) => c.kind === 'add')).toBe(true);
    expect(made.proposal.samples.every((s) => s.entity === 'pedido')).toBe(true);
    // Links to clients that already exist in the app are dropped (their sample ids aren't there).
    expect(made.proposal.samples.every((s) => s.data.cliente === undefined)).toBe(true);

    const fresh = cardProposal(null, composeApp('erp', 'X', ['clientes', 'pedidos']), newId);
    if ('errors' in fresh) throw new Error(fresh.errors.join());
    const ids = new Set(fresh.proposal.samples.map((s) => s.id));
    const linked = fresh.proposal.samples.filter((s) => s.entity === 'pedido');
    expect(linked.every((s) => ids.has(String(s.data.cliente)))).toBe(true);

    expect(modulesSummary(after, removeModule(after, 'pedidos'))).toBe('Quitar Pedidos');
    expect('errors' in cardProposal(null, { ...after, entities: [] }, newId)).toBe(true);
  });

  it('a launch action needs a target entity that links back', () => {
    const bp = composeApp('erp', 'X', ['operaciones']);
    expect(validateBlueprint(bp)).toEqual([]);
    const broken = JSON.parse(JSON.stringify(bp));
    const launch = broken.views.find((v: { key: string }) => v.key === 'procesos').actions[0];
    launch.entity = 'persona';
    expect(validateBlueprint(broken).join()).toMatch(/persona necesita un campo relation a proceso/);
    launch.entity = undefined;
    expect(validateBlueprint(broken).join()).toMatch(/necesita en entity/);
    launch.entity = 'tarea'; launch.field = 'nombre';
    expect(validateBlueprint(broken).join()).toMatch(/longtext/);
  });
});

describe('inmobiliaria y alquiler turístico', () => {
  it('each pack is one valid app with its screens and demo data that links up', () => {
    for (const p of PACKS) {
      const bp = composePack(p.key, 'Agencia');
      expect(validateBlueprint(bp), p.key).toEqual([]);
      expect(bp.views[0].type, p.key).toBe('ops');
      const rows = sampleRecordsFor(bp);
      const ids = new Set(rows.map((r) => r.id));
      for (const r of rows) {
        const e = bp.entities.find((x) => x.key === r.entity)!;
        for (const f of e.fields) if (f.type === 'relation' && r.data[f.key] != null) expect(ids.has(String(r.data[f.key])), `${p.key} ${r.id}.${f.key}`).toBe(true);
      }
    }
    const tour = composePack('turistico', 'Pisos');
    expect(tour.views.map((v) => v.type)).toContain('timeline');
    expect(tour.entities.map((e) => e.key)).not.toContain('operacion');
    const sales = composePack('compraventa', 'Agencia');
    expect(sales.entities.map((e) => e.key)).not.toContain('reserva');
    // Tourist flats only show up where there are bookings.
    expect(sampleRecordsFor(sales).filter((r) => r.entity === 'inmueble' && r.data.operacion === 'turistico')).toEqual([]);
  });

  it('timeline and cards need the right fields', () => {
    const bp = composePack('ambos', 'Agencia');
    const timeline = bp.views.find((v) => v.type === 'timeline')!;
    timeline.rowField = 'huesped';
    const cards = bp.views.find((v) => v.type === 'cards')!;
    cards.imageField = 'precio';
    const errors = validateBlueprint(bp).join(' ');
    expect(errors).toMatch(/rowField/);
    expect(errors).toMatch(/imageField/);
  });
});
