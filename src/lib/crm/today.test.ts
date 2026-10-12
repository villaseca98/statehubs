import { describe, expect, it } from 'vitest';
import { composeApp, modulesFor, sampleRecordsFor } from '@shared/blueprint/modules.ts';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { computeToday, dayOf, dueFields } from './today';

const now = new Date('2026-10-12T09:00:00');
const at = (days: number, time?: string) => { const d = new Date(now); d.setDate(d.getDate() + days); return time ? `${dayOf(d)}T${time}` : dayOf(d); };

describe('Hoy: what needs doing', () => {
  const bp = composeApp('crm', 'Mi CRM', ['leads', 'agenda', 'operaciones', 'documentos']);
  const rec = (id: string, entity: string, data: AppRecord['data']): AppRecord => ({ id, entity, data });

  it('puts today, overdue and the next days in their place, and skips closed ones', () => {
    const records = [
      rec('a', 'lead', { nombre: 'Lucía', estado: 'cita', cita: at(0, '12:30'), telefono: '611 222 333' }),
      rec('b', 'lead', { nombre: 'Hugo', estado: 'cita', cita: at(-2, '10:00') }),
      rec('c', 'lead', { nombre: 'Marta', estado: 'ganado', cita: at(0, '09:00') }),
      rec('d', 'lead', { nombre: 'Pedro', estado: 'nuevo' }),
      rec('e', 'tarea', { titulo: 'Enviar contrato', estado: 'pendiente', limite: at(1) }),
      rec('f', 'documento', { titulo: 'Seguro', caduca: at(20) }),
      rec('g', 'tarea', { titulo: 'Muy lejos', estado: 'pendiente', limite: at(40) }),
    ];
    const t = computeToday(bp, records, now);
    expect(t.hoy).toHaveLength(2);
    expect(t.hoy.find((i) => i.record.id === 'a')?.reason).toBe('Cita a las 12:30');
    expect(t.hoy.find((i) => i.record.id === 'a')?.phone).toBe('611 222 333');
    expect(t.hoy.find((i) => i.record.id === 'd')?.reason).toBe('Nuevo: sin contactar todavía');
    expect(t.atrasado.map((i) => i.record.id)).toEqual(['b']);
    expect(t.atrasado[0].reason).toMatch(/hace 2 días · ¿se hizo\?/);
    expect(t.proximo.map((i) => i.record.id).sort()).toEqual(['e', 'f']);
    expect([...t.hoy, ...t.atrasado, ...t.proximo].some((i) => i.record.id === 'c' || i.record.id === 'g')).toBe(false);
  });

  it('flags overdue invoices and stock under minimum in an ERP', () => {
    const erp = composeApp('erp', 'Mi ERP', ['facturas', 'inventario']);
    const t = computeToday(erp, [
      { id: 'f1', entity: 'factura', data: { numero: 'F-1', cobro: 'pendiente', fecha: at(-40), vence: at(-10) } },
      { id: 'f2', entity: 'factura', data: { numero: 'F-2', cobro: 'cobrada', vence: at(-10) } },
      { id: 'p1', entity: 'producto', data: { nombre: 'Cinta', stock: 3, minimo: 10 } },
    ], now);
    expect(t.atrasado.map((i) => i.reason)).toEqual(['Venció hace 10 días']);
    expect(t.hoy.map((i) => i.reason)).toEqual(['Quedan 3; el mínimo es 10']);
  });

  it('treats a plain «fecha» as a due date only in appointments', () => {
    const erp = composeApp('erp', 'X', ['facturas', 'gastos']);
    for (const e of erp.entities) expect(dueFields(e).map((f) => f.key)).not.toContain('fecha');
    const clinica = DEMO_APPS.find((d) => d.key === 'clinica')!.blueprint;
    expect(dueFields(clinica.entities.find((e) => e.key === 'cita')!).map((f) => f.key)).toEqual(['fecha']);
  });

  it('works on every sample app without crashing', () => {
    for (const kind of ['crm', 'erp'] as const) {
      const b = composeApp(kind, 'X', modulesFor(kind).map((m) => m.key));
      expect(computeToday(b, sampleRecordsFor(b)).total).toBeGreaterThan(0);
    }
    for (const d of DEMO_APPS) expect(() => computeToday(d.blueprint, d.records)).not.toThrow();
  });

  it('adds follow-up fields and realistic next steps to the real-estate template', () => {
    const inmobiliaria = composeApp('crm', 'Inmobiliaria Sol', ['panel', 'analisis', 'leads', 'inmuebles', 'visitas', 'embudo', 'clientes', 'documentos'], 'inmobiliaria');
    const lead = inmobiliaria.entities.find((e) => e.key === 'lead')!;
    expect(lead.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['siguiente_paso', 'proximo_contacto', 'prioridad_comercial', 'fuente_lead', 'instagram_usuario', 'campana_instagram', 'estado_cualificacion', 'puntuacion_lead', 'contacto_autorizado']));

    const records = sampleRecordsFor(inmobiliaria);
    const overdueFollowUp = records.find((r) => r.id === 'm-l1');
    expect(overdueFollowUp?.data.siguiente_paso).toBe('Confirmar disponibilidad y proponer segunda visita');
    expect(overdueFollowUp?.data.proximo_contacto).toBeDefined();
    expect(overdueFollowUp?.data.prioridad_comercial).toBe('alta');
  });
});
