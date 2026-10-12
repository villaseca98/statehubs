import { describe, expect, it } from 'vitest';
import { SECTORS, getSector } from './sectors.ts';
import { addModule, cardProposal, composeApp, removeModule, sampleRecordsFor } from './modules.ts';
import { analyse, duplicatesOf, sectionOf } from './analysis.ts';
import { validateBlueprint } from './validate.ts';

const build = (key: string, modules?: string[]) => {
  const s = getSector(key)!;
  return composeApp(s.kind, 'X', modules ?? s.modules, key);
};

describe('sectores', () => {
  it('cada sector monta una app válida con sus campos y datos de ejemplo', () => {
    for (const s of SECTORS) {
      const bp = build(s.key);
      expect(validateBlueprint(bp), s.key).toEqual([]);
      expect(bp.sector).toBe(s.key);
      for (const [entity, fields] of Object.entries(s.fields)) {
        const e = bp.entities.find((x) => x.key === entity);
        if (e) for (const f of fields) expect(e.fields.some((x) => x.key === f.key), `${s.key}: ${entity}.${f.key}`).toBe(true);
      }
      // Every sample value for an extra field lands on a record.
      const records = sampleRecordsFor(bp);
      for (const [id, patch] of Object.entries(s.samples ?? {})) {
        const r = records.find((x) => x.id === id);
        if (r) for (const k of Object.keys(patch)) expect(r.data[k], `${s.key}: ${id}.${k}`).toBeDefined();
      }
    }
  });

  it('ventas: muchos más parámetros por lead, y el comercial trae al equipo aunque falte su pieza', () => {
    const bp = build('ventas', ['leads']);
    const lead = bp.entities.find((e) => e.key === 'lead')!;
    expect(lead.fields.length).toBeGreaterThanOrEqual(25);
    expect(lead.fields.at(-1)!.key).toBe('notas');
    expect(bp.entities.some((e) => e.key === 'persona')).toBe(true);
    expect(bp.views.find((v) => v.key === 'leads')!.columns).toEqual(['empresa', 'valor', 'plazo', 'comercial', 'cita']);
    expect(validateBlueprint(bp)).toEqual([]);
    // Pieces added later get the sector's fields; the team stays while a lead points at it.
    const more = addModule(bp, 'presupuestos');
    expect(more.entities.find((e) => e.key === 'presupuesto')!.fields.some((f) => f.key === 'valido_hasta')).toBe(true);
    expect(removeModule(build('ventas'), 'operaciones').entities.some((e) => e.key === 'persona')).toBe(true);
  });

  it('ventas: el análisis compara comerciales, tamaños y sectores', () => {
    const bp = build('ventas');
    const names: Record<string, string> = { 'm-pe-1': 'Laura Martí', 'm-pe-2': 'Iván Soler' };
    const texts = analyse(bp, sampleRecordsFor(bp), sectionOf(bp, 'lead')!, undefined, new Date(), (id) => names[id]).patterns.map((p) => p.text);
    expect(texts).toContain('Comercial «Laura Martí»: ganas 4 de 4 (100 %), frente al 50 % de media.');
    expect(texts.some((t) => t.startsWith('Comercial «Iván Soler»: ganas 0 de 4'))).toBe(true);
  });

  it('inmobiliaria: los inmuebles vendidos cuentan como ganados y las visitas enlazan con interesados', () => {
    const bp = build('inmobiliaria');
    const a = analyse(bp, sampleRecordsFor(bp), sectionOf(bp, 'inmueble')!);
    expect(a.won).toHaveLength(1);
    expect(a.open).toHaveLength(3);
    const p = cardProposal(null, bp, (() => { let n = 0; return () => `id${++n}`; })());
    if (!('proposal' in p)) throw new Error(p.errors.join());
    const visit = p.proposal.samples!.find((r) => r.entity === 'visita')!;
    expect(p.proposal.samples!.some((r) => r.id === visit.data.lead && r.entity === 'lead')).toBe(true);
  });

  it('control de base de datos: avisa de los duplicados por email y teléfono', () => {
    const bp = build('contactos');
    const contacto = bp.entities.find((e) => e.key === 'contacto')!;
    expect(duplicatesOf(contacto, sampleRecordsFor(bp))).toBe(4);
  });
});
