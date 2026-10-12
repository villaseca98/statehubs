import { describe, expect, it } from 'vitest';
import { qualifyRealEstateLead } from './instagram-leads';

describe('Instagram lead qualification', () => {
  it('prioritises a complete buyer lead without assuming consent', () => {
    const result = qualifyRealEstateLead({
      operacion_busca: 'comprar',
      presupuesto_max: 350000,
      zona: 'Jerez centro',
      plazo: 'mes',
      financiacion: 'preaprobada',
      telefono: '600000000',
      contacto_autorizado: 'pendiente',
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe('alta');
    expect(result.contactAllowed).toBe(false);
    expect(result.nextAction).toMatch(/Confirmar el permiso/);
  });

  it('lists missing qualification fields and suggests completing them', () => {
    const result = qualifyRealEstateLead({ operacion_busca: 'comprar', contacto_autorizado: 'confirmado' });
    expect(result.missing).toContain('presupuesto');
    expect(result.missing).toContain('zona de interés');
    expect(result.level).toBe('baja');
    expect(result.nextAction).toMatch(/completar/i);
  });

  it('does not recommend commercial contact when the person opted out', () => {
    const result = qualifyRealEstateLead({
      operacion_busca: 'vender',
      presupuesto_max: 200000,
      zona: 'Centro',
      plazo: 'mes',
      financiacion: 'no_necesita',
      email: 'persona@example.com',
      contacto_autorizado: 'no',
    });
    expect(result.score).toBe(100);
    expect(result.contactAllowed).toBe(false);
    expect(result.nextAction).toMatch(/No iniciar contacto comercial/);
  });

  it('never awards budget points for zero or non-numeric values', () => {
    const result = qualifyRealEstateLead({ presupuesto_max: 'no sé' });
    expect(result.score).toBe(0);
    expect(result.missing).toContain('presupuesto');
  });
});
