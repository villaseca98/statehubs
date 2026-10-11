import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import type { DemoApp } from '@shared/blueprint/samples.ts';
import { MODULES, addModule, cardProposal, removeModule } from '@shared/blueprint/modules.ts';
import { diffBlueprints } from '@shared/blueprint/diff.ts';
import type { Blueprint } from '@shared/blueprint/types.ts';
import type { Proposal } from '@shared/blueprint/agent.ts';

// Stand-in for the AI in guest mode (no account, no server). It starts from
// the closest ready-made app and can put pieces on or take them off by name
// («añade facturas», «quita soporte»); anything else needs the real
// assistant, and it says so plainly instead of pretending.

const SECTORS: [string, RegExp][] = [
  ['inmobiliaria', /inmobil|piso|vivienda|alquiler|inmueble|comprador/i],
  ['clinica', /cl[ií]nica|paciente|dental|fisio|m[eé]dic|cita|consulta|est[eé]tica|veterin/i],
  ['distribucion', /pedido|almac[eé]n|stock|factur|distribu|erp|inventario|proveedor|producto/i],
  ['agencia', /agencia|proyecto|marketing|dise[nñ]o|consultor|horas|cliente/i],
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function pickTemplate(message: string): DemoApp {
  const hit = SECTORS.find(([, re]) => re.test(message));
  return DEMO_APPS.find((a) => a.key === hit?.[0]) ?? DEMO_APPS[0];
}

export function findModule(message: string) {
  const m = norm(message);
  return MODULES.find((x) => m.includes(norm(x.name)) || m.includes(norm(x.key)) || norm(x.name).split(' ').some((w) => w.length > 4 && m.includes(w)));
}

export function localAgent(message: string, current: Blueprint | null): { reply: string; proposal: Proposal | null } {
  if (!current) {
    const t = pickTemplate(message);
    const blueprint: Blueprint = JSON.parse(JSON.stringify(t.blueprint));
    return {
      reply: `Modo prueba: te preparo la plantilla de ${t.sector.toLowerCase()} como punto de partida. ${t.pitch}`,
      proposal: {
        summary: `Plantilla de ${t.sector.toLowerCase()}`,
        blueprint,
        changes: diffBlueprints(null, blueprint),
        samples: t.records.map((r) => ({ entity: r.entity, data: r.data, id: r.id })) as Proposal['samples'],
      },
    };
  }
  const mod = findModule(message);
  if (mod) {
    const removing = /\b(quita|quitar|elimina|eliminar|borra|fuera|sin)\b/i.test(message);
    const has = current.modules?.includes(mod.key);
    if (removing === !!has) {
      const blueprint = removing ? removeModule(current, mod.key) : addModule(current, mod.key);
      const made = cardProposal(current, blueprint, () => `local-r-${Math.random().toString(36).slice(2)}`);
      if ('errors' in made) return { reply: `No he podido prepararlo: ${made.errors[0]}`, proposal: null };
      return {
        reply: removing ? `Te quito «${mod.name}». Lo que tenías apuntado no se borra: si vuelves a ponerla, aparece.` : `Te pongo «${mod.name}». ${mod.pitch}`,
        proposal: made.proposal,
      };
    }
    return { reply: has ? `«${mod.name}» ya está puesta.` : `«${mod.name}» no está puesta.`, proposal: null };
  }
  return {
    reply: 'En modo prueba puedo poner o quitar piezas por su nombre (por ejemplo «añade facturas» o «quita soporte»). Para inventar campos, pantallas o acciones nuevas hablando hace falta entrar con tu cuenta. Mientras tanto puedes crear, editar y mover registros.',
    proposal: null,
  };
}
