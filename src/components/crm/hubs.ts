import type { View } from '@shared/blueprint/types.ts';

// The sections of an app, grouped in a few hubs so the navigation reads like
// the business (today, clients, properties, holiday lets, the company) instead
// of a long list. Sections the hubs don't know go to «Empresa».

export type HubKey = 'hoy' | 'clientes' | 'inmuebles' | 'turistico' | 'empresa';

export interface Hub { key: HubKey; label: string; sections: string[] }

export const HOY = 'hoy';

const KNOWN: Record<string, HubKey> = {
  centro: 'hoy',
  contactos_inmo: 'clientes', pipeline: 'clientes', agenda_inmo: 'clientes',
  leads: 'clientes', embudo: 'clientes', agenda: 'clientes', clientes: 'clientes', contactos: 'clientes', presupuestos: 'clientes', soporte: 'clientes',
  cartera: 'inmuebles', inmuebles: 'inmuebles', visitas: 'inmuebles',
  calendario: 'turistico', reservas: 'turistico', limpiezas: 'turistico', incidencias: 'turistico',
};

const ORDER: [HubKey, string][] = [['hoy', 'Hoy'], ['clientes', 'Clientes'], ['inmuebles', 'Inmuebles'], ['turistico', 'Turístico'], ['empresa', 'Empresa']];

export function hubOf(view: View): HubKey {
  return KNOWN[view.key] ?? (view.type === 'ops' ? 'hoy' : 'empresa');
}

// Hubs with something in them, in a fixed order. Without an operations
// centre, «Hoy» holds the built-in today screen (HOY).
export function hubsFor(sections: View[]): Hub[] {
  const hubs: Hub[] = ORDER.map(([key, label]) => ({ key, label, sections: [] }));
  for (const v of sections) hubs.find((h) => h.key === hubOf(v))!.sections.push(v.key);
  const today = hubs[0];
  if (today.sections.length === 0) today.sections.push(HOY);
  return hubs.filter((h) => h.sections.length > 0);
}
