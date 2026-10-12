import { MODULES, PACKS, addModule, cardProposal, composePack, removeModule } from '@shared/blueprint/modules.ts';
import type { PackKey } from '@shared/blueprint/modules.ts';
import type { Blueprint } from '@shared/blueprint/types.ts';
import type { Proposal } from '@shared/blueprint/agent.ts';

// Stand-in for the AI in guest mode (no account, no server). It starts from
// the agency pack that fits what the person tells it and can put pieces on
// or take them off by name («añade documentación», «quita equipo»); anything
// else needs the real assistant, and it says so plainly instead of pretending.

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const TOURIST = /turistic|airbnb|booking|vacacional|apartamento|huesped|reserva|limpieza/;
const SALES = /vend|compr|capta|venta|traspaso|inversor|hipoteca|alquiler de larga|larga estancia/;

export function pickPack(message: string): PackKey {
  const m = norm(message);
  const tourist = TOURIST.test(m);
  const sales = SALES.test(m);
  return tourist && !sales ? 'turistico' : sales && !tourist ? 'compraventa' : 'ambos';
}

export function findModule(message: string) {
  const m = norm(message);
  return MODULES.find((x) => m.includes(norm(x.name)) || m.includes(norm(x.key)) || norm(x.name).split(' ').some((w) => w.length > 4 && m.includes(w)));
}

export function localAgent(message: string, current: Blueprint | null): { reply: string; proposal: Proposal | null } {
  if (!current) {
    const pack = PACKS.find((p) => p.key === pickPack(message))!;
    const made = cardProposal(null, composePack(pack.key, 'Mi inmobiliaria'), () => `local-r-${Math.random().toString(36).slice(2)}`);
    if ('errors' in made) return { reply: `No he podido prepararlo: ${made.errors[0]}`, proposal: null };
    return {
      reply: `Modo prueba: te preparo StateHubs para ${pack.name.toLowerCase()} como punto de partida, con datos de ejemplo. ${pack.pitch}`,
      proposal: { ...made.proposal, summary: `StateHubs para ${pack.name.toLowerCase()}` },
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
