import { describe, expect, it } from 'vitest';
import { analyse, analysedSections, outcomeOf, sectionOf, toCsv, withAnalysis } from './analysis.ts';
import { addModule, composeApp, removeModule, sampleRecordsFor } from './modules.ts';
import { validateBlueprint } from './validate.ts';
import { diffBlueprints } from './diff.ts';

const crm = () => composeApp('crm', 'Mi CRM', ['panel', 'analisis', 'leads', 'embudo', 'clientes']);

describe('análisis de datos', () => {
  it('reconoce ganados y perdidos por el nombre de la etapa', () => {
    expect(outcomeOf({ value: 'ganado', label: 'Ganado' })).toBe('won');
    expect(outcomeOf({ value: 'cobrada', label: 'Cobrada' })).toBe('won');
    expect(outcomeOf({ value: 'rechazado', label: 'Rechazado' })).toBe('lost');
    expect(outcomeOf({ value: 'x', label: 'Perdida' })).toBe('lost');
    expect(outcomeOf({ value: 'cita', label: 'Cita agendada' })).toBe('open');
  });

  it('la pieza llega con su configuración y el plano es válido', () => {
    const bp = crm();
    const view = bp.views.find((v) => v.type === 'analysis')!;
    expect(view.analysis).toEqual({ lenses: ['oportunidades', 'leads', 'casuisticas', 'datos'], staleDays: 7 });
    expect(validateBlueprint(bp)).toEqual([]);
    expect(analysedSections(bp, view.analysis).map((s) => s.entity.key)).toEqual(['lead', 'oportunidad']);
  });

  it('puntúa los leads abiertos con su porqué y avisa de los que se enfrían', () => {
    const bp = crm();
    const a = analyse(bp, sampleRecordsFor(bp), sectionOf(bp, 'lead')!);
    expect(a.winRate).toBe(0.5);
    expect(a.open).toHaveLength(4);
    const top = a.ranking[0];
    expect(top.record.data.nombre).toBe('Pablo Ruiz');
    expect(top.reasons.join(' ')).toContain('Origen Recomendación: ganas 2 de 2');
    expect(a.ranking.every((x) => x.score >= 0 && x.score <= 100)).toBe(true);
    const cold = a.cooling.map((c) => `${c.record.data.nombre}: ${c.reason}`);
    expect(cold).toContain('Hugo Ferrer: Entró hace 11 días y sigue en «Contactado»');
    expect(cold.some((c) => c.startsWith('Pablo Ruiz: Cita: hace 1 día'))).toBe(true);
  });

  it('saca las casuísticas: qué gana, qué pierde y por qué se pierde', () => {
    const bp = crm();
    const texts = analyse(bp, sampleRecordsFor(bp), sectionOf(bp, 'lead')!).patterns.map((p) => `${p.tone}: ${p.text}`);
    expect(texts).toContain('good: Origen «Recomendación»: ganas 2 de 2 (100 %), frente al 50 % de media.');
    expect(texts).toContain('bad: Origen «Instagram»: ganas 0 de 2; la media es 50 %.');
    expect(texts).toContain('bad: De 4 en Perdido, 2 tienen Motivo de pérdida «Precio».');
  });

  it('prevé el cierre con la probabilidad de cada oportunidad', () => {
    const bp = crm();
    const a = analyse(bp, sampleRecordsFor(bp), sectionOf(bp, 'oportunidad')!, undefined, new Date(), (id) => (id === 'm-cl2' ? 'Jorge Sanz' : undefined));
    expect(a.forecast).toBe(14500 * 0.7 + 3200 * 0.5 + 900 * 0.2);
    expect(a.winRate).toBe(0.5);
    expect(a.funnel.find((f) => f.option.value === 'nueva')!.reached).toBe(7);
    expect(a.funnel.find((f) => f.option.value === 'negociacion')!.reached).toBe(3);
    expect(a.patterns.map((p) => p.text)).toContain('Cliente «Jorge Sanz» reúne el 63 % del importe (22.100 € de 34.900 €).');
  });

  it('se configura al elegir y se mantiene válido al quitar piezas', () => {
    let bp = withAnalysis(crm(), { lenses: ['leads', 'datos'], staleDays: 14, entities: ['lead'] });
    expect(validateBlueprint(bp)).toEqual([]);
    expect(diffBlueprints(crm(), bp).map((c) => c.text)).toContain('Cambiar qué analiza «Análisis».');
    bp = removeModule(bp, 'leads');
    expect(bp.views.find((v) => v.type === 'analysis')!.analysis).toEqual({ lenses: ['leads', 'datos'], staleDays: 14 });
    expect(validateBlueprint(bp)).toEqual([]);
    expect(addModule(bp, 'leads').views.some((v) => v.key === 'leads')).toBe(true);
  });

  it('rechaza configuraciones que no existen', () => {
    const bp = withAnalysis(crm(), { lenses: ['adivinar' as never], staleDays: 0, entities: ['fantasma'] });
    const errors = validateBlueprint(bp).join('\n');
    expect(errors).toContain('analysis.lenses');
    expect(errors).toContain('analysis.staleDays');
    expect(errors).toContain('"fantasma", que no existe');
  });

  it('exporta a CSV legible y sin fórmulas', () => {
    const bp = crm();
    const lead = bp.entities.find((e) => e.key === 'lead')!;
    const csv = toCsv(lead, [{ id: '1', entity: 'lead', data: { nombre: '=HYPERLINK("x")', origen: 'web', valor: 1200.5, notas: 'uno; dos' } }]);
    const [head, row] = csv.replace('\uFEFF', '').split('\r\n');
    expect(head.split(';').slice(0, 3)).toEqual(['Nombre', 'Teléfono', 'Email']);
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
    expect(row).toContain(';Web;');
    expect(row).toContain('1200,5');
    expect(row).toContain('"uno; dos"');
  });
});
