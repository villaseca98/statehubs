import { describe, expect, it } from 'vitest';
import type { View } from '@shared/blueprint/types.ts';
import { hubOf, hubsFor } from './hubs';

const view = (key: string, type = 'table') => ({ key, type, label: key }) as View;

describe('English-first CRM hub metadata', () => {
  it('keeps stable stored view identifiers and presents English labels', () => {
    const hubs = hubsFor([
      view('contactos_inmo'), view('cartera'), view('calendario'),
      view('custom_reports'), view('centro', 'ops'),
    ]);
    expect(hubs.map(h => [h.key, h.label])).toEqual([
      ['hoy', 'Home'], ['clientes', 'Clients'], ['inmuebles', 'Properties'],
      ['turistico', 'Rentals'], ['empresa', 'Business'],
    ]);
    expect(hubs.find(h => h.key === 'clientes')?.sections).toEqual(['contactos_inmo']);
    expect(hubOf(view('custom_reports'))).toBe('empresa');
  });

  it('provides a built-in Home hub when no operations view exists', () => {
    expect(hubsFor([view('cartera')]).map(h => [h.key, h.sections])).toEqual([
      ['hoy', ['hoy']], ['inmuebles', ['cartera']],
    ]);
  });
});
