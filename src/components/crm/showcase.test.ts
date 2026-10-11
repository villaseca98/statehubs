import { describe, expect, it } from 'vitest';
import { composeApp, STARTER } from '@shared/blueprint/modules.ts';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import { seg, showcaseLayers, win } from './showcase';

describe('showcaseLayers: the 3D pieces of any app', () => {
  it('stacks the bar, the figures and the panels of a CRM in order', () => {
    const bp = composeApp('crm', 'Prueba', STARTER.crm);
    const layers = showcaseLayers(bp, 6);
    expect(layers.map((l) => l.key)).toEqual(['base', 'cifras', 'leads', 'embudo', 'agenda', 'clientes']);
  });

  it('works for every demo sector and never exceeds the limit', () => {
    for (const d of DEMO_APPS) {
      const layers = showcaseLayers(d.blueprint, 5);
      expect(layers[0].key).toBe('base');
      expect(layers.length).toBeLessThanOrEqual(5);
      for (const l of layers.slice(1)) expect(['cifras', ...d.blueprint.views.map((v) => v.key)]).toContain(l.key);
    }
  });

  it('skips the figures when the app has none', () => {
    const bp = composeApp('erp', 'Sin cifras', ['facturas']);
    expect(showcaseLayers(bp).map((l) => l.key)).toEqual(['base', 'facturas']);
  });
});

describe('timing helpers', () => {
  it('rises and falls inside its window', () => {
    expect(seg(5, 0, 10)).toBe(0.5);
    expect(win(-1, 0, 1, 2, 3)).toBe(0);
    expect(win(1.5, 0, 1, 2, 3)).toBe(1);
    expect(win(4, 0, 1, 2, 3)).toBe(0);
  });
});
