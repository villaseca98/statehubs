import type { Blueprint, RecordData } from './types.ts';
import { ACTION_KINDS, ANALYSIS_LENSES, FIELD_TYPES, OPTION_COLORS, VIEW_TYPES } from './types.ts';
import { validateBlueprint } from './validate.ts';
import { diffBlueprints } from './diff.ts';
import type { Change } from './diff.ts';

// The builder agent. The model never touches the database: it can only call
// `proponer_cambios` with a whole new blueprint. We validate it, hand errors
// back for a retry, and return a proposal the person sees before applying.

export type ContentBlock = { type: string; [k: string]: unknown };
export interface ModelMessage { role: 'user' | 'assistant'; content: string | ContentBlock[] }
export interface ModelRequest { system: string; messages: ModelMessage[]; tools: unknown[] }
export interface ModelResponse { content: ContentBlock[]; stop_reason: string | null }
export type CallModel = (req: ModelRequest) => Promise<ModelResponse>;

// `id` is only set by card proposals, so sample rows can point at each other.
export interface SampleRecord { entity: string; data: RecordData; id?: string }
export interface Proposal {
  summary: string;
  blueprint: Blueprint;
  changes: Change[];
  samples: SampleRecord[];
}
export interface AgentResult {
  reply: string;
  proposal: Proposal | null;
}

export const MAX_ATTEMPTS = 3;
const MAX_TURNS = 8;
const TOOL = 'proponer_cambios';

export function buildSystemPrompt(current: Blueprint | null): string {
  return `Eres el constructor de StateHubs. Ayudas a pymes y autónomos de España a crear y cambiar su propio CRM o ERP hablando.

Cómo trabajas:
- Hablas en español de España, claro y sin tecnicismos. Respuestas cortas.
- Para crear o cambiar la aplicación llamas SIEMPRE a la herramienta ${TOOL} con el plano completo resultante. Nunca describas un cambio sin proponerlo.
- La persona verá la diferencia y decidirá si la aplica. No digas que ya está hecho: di que lo tiene listo para revisar.
- Un cambio, una intención: cambia solo lo que se pide. Si algo es ambiguo, pregunta antes de proponer.
- Si te piden algo que no es un CRM, un ERP o una herramienta de gestión, explícalo amablemente y no propongas nada.

Reglas del plano (versión 1):
- Las claves (key) son en minúsculas con números y _, en español (cliente, fecha_alta). NUNCA cambies la clave de algo que ya existe: los datos guardados dependen de ella. Para renombrar, cambia solo label.
- Tipos de campo: ${FIELD_TYPES.join(', ')}. Usa money para importes en euros, nif para NIF/CIF, phone para teléfonos, select con options (value, label, color) para estados y etapas, relation con relation=<clave de entidad> para enlazar.
- Colores de opción: ${OPTION_COLORS.join(', ')}.
- titleField es el campo de texto que da nombre a cada registro.
- Vistas: ${VIEW_TYPES.join(', ')}. table lleva columns; kanban lleva groupBy (un select) y opcional sumField (importe); calendar lleva dateField (date); dashboard lleva widgets (metric o bars con agg count/sum/avg; sum y avg necesitan field numérico; bars necesita groupBy select).
- worklist es una lista de trabajo (ideal para leads o pendientes): lleva columns, groupBy (el select de estado) y actions. Cada acción tiene kind (${ACTION_KINDS.join(', ')}), label y, según el kind, field (call y whatsapp: un phone; email: un email; schedule: un datetime), to (move: estado al que pasa; schedule: estado tras agendar) y when (en qué estados se ofrece; vacío = siempre). Así cada lead muestra solo las acciones que tocan según su estado. launch convierte cada línea de un campo longtext (field, por ejemplo los pasos de un proceso) en un registro de la entidad entity, que debe tener un relation de vuelta. webhook envía el registro a la URL de su campo url (field). Si hay acciones schedule, añade availability con days (1 = lunes … 7 = domingo), from y to (HH:MM), slotMinutes y, si hay pausa, breakFrom y breakTo: el panel lateral enseña los huecos libres y no deja agendar dos veces la misma hora.
- analysis es la pantalla de análisis de datos (sin entity): lleva analysis con lenses (${ANALYSIS_LENSES.join(', ')}: oportunidades = embudo, previsión y tasa de cierre; leads = cada registro abierto puntuado con su porqué y los que se enfrían; casuisticas = qué origen, cliente o motivo gana o pierde más que la media; datos = cuánto hay, qué falta por rellenar y descarga en CSV), staleDays (días sin moverse para darlo por frío, 1–90) y, opcional, entities (las secciones a analizar; vacío = todas las que tienen etapas o importes). Funciona mejor si las etapas incluyen opciones de ganado y perdido, un campo money y selects como origen o motivo de pérdida.
- ops es el centro de operaciones (sin entity): reúne solo lo que toca hoy (entradas y salidas de huéspedes, limpiezas, visitas, operaciones abiertas, incidencias y avisos). Va la primera.
- timeline es el calendario de reservas por alojamiento: lleva entity (las reservas), rowField (el relation al alojamiento, cada uno es una fila), startField y endField (date) y opcional groupBy (un select que colorea las barras, por ejemplo el canal). Marca solas las reservas que se solapan.
- cards es una galería de fichas (ideal para inmuebles): lleva entity, opcional imageField (un campo url con la foto), groupBy (select del estado) y columns (los datos que se ven en la ficha).
- StateHubs es para inmobiliarias y alquiler turístico: piensa en contactos con temperatura y próxima acción, operaciones por etapas, inmuebles, visitas, reservas de Airbnb y Booking, limpiezas e incidencias. No prometas conexiones con Airbnb o Booking que no existen: las reservas llegan por el calendario iCal de cada anuncio.
- No escribas logo: el logo lo pone la persona desde Piezas.
- Si el plano actual tiene kind, sector y modules (las piezas que la persona puso con tarjetas), no te preocupes por ellos: se conservan solos. Tú cambia entidades y vistas como siempre.
- Todas las aplicaciones tienen el mismo diseño de StateHubs; no hay estilos que elegir. La app abre en «Hoy», que reúne solo lo que toca: citas y llamadas de hoy, lo atrasado y lo de los próximos días, a partir de los campos date y datetime y de los select de estado. Por eso pon siempre fechas útiles (cita, vence, límite, entrega) y estados con un final claro.
- Usa datetime para citas, visitas y llamadas con hora; date para fechas sin hora.
- El orden de views es el orden del menú. Empieza por la pantalla más útil para el día a día.
- Piensa en España: NIF/CIF, IVA (21 %, 10 %, 4 %), IRPF en facturas de profesionales, provincias, WhatsApp como canal.
- Al crear una aplicación nueva incluye en ejemplos entre 3 y 6 registros realistas (nombres y empresas españolas inventadas) por cada entidad principal. Los campos relation de los ejemplos se dejan vacíos. En cambios posteriores no añadas ejemplos salvo que te los pidan.

${current ? `Plano actual de la aplicación:\n${JSON.stringify({ ...current, logo: undefined })}` : 'Todavía no hay aplicación: la primera propuesta la crea entera.'}`;
}

const option = { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' }, color: { type: 'string', enum: OPTION_COLORS } }, required: ['value', 'label'] };
const field = {
  type: 'object',
  properties: {
    key: { type: 'string' }, label: { type: 'string' }, type: { type: 'string', enum: FIELD_TYPES },
    required: { type: 'boolean' }, options: { type: 'array', items: option }, relation: { type: 'string' }, help: { type: 'string' },
  },
  required: ['key', 'label', 'type'],
};
const action = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ACTION_KINDS }, label: { type: 'string' }, field: { type: 'string' }, to: { type: 'string' },
    when: { type: 'array', items: { type: 'string' } }, entity: { type: 'string' },
  },
  required: ['kind', 'label'],
};
const availability = {
  type: 'object',
  properties: {
    days: { type: 'array', items: { type: 'integer' } }, from: { type: 'string' }, to: { type: 'string' },
    slotMinutes: { type: 'integer' }, breakFrom: { type: 'string' }, breakTo: { type: 'string' },
  },
  required: ['days', 'from', 'to', 'slotMinutes'],
};
const widget = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['metric', 'bars'] }, label: { type: 'string' }, entity: { type: 'string' },
    agg: { type: 'string', enum: ['count', 'sum', 'avg'] }, field: { type: 'string' }, groupBy: { type: 'string' },
  },
  required: ['kind', 'label', 'entity', 'agg'],
};

export const PROPOSE_TOOL = {
  name: TOOL,
  description: 'Propone el plano completo de la aplicación tras el cambio. La persona lo revisa antes de aplicarlo.',
  input_schema: {
    type: 'object',
    properties: {
      resumen: { type: 'string', description: 'Una o dos frases para la persona: qué cambia y por qué.' },
      plano: {
        type: 'object',
        properties: {
          version: { type: 'integer', enum: [1] },
          name: { type: 'string' },
          description: { type: 'string' },
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: { key: { type: 'string' }, label: { type: 'string' }, labelPlural: { type: 'string' }, titleField: { type: 'string' }, fields: { type: 'array', items: field } },
              required: ['key', 'label', 'labelPlural', 'titleField', 'fields'],
            },
          },
          views: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' }, label: { type: 'string' }, type: { type: 'string', enum: VIEW_TYPES }, entity: { type: 'string' },
                columns: { type: 'array', items: { type: 'string' } }, groupBy: { type: 'string' }, dateField: { type: 'string' },
                sumField: { type: 'string' }, widgets: { type: 'array', items: widget },
                startField: { type: 'string' }, endField: { type: 'string' }, rowField: { type: 'string' }, imageField: { type: 'string' },
                actions: { type: 'array', items: action }, availability,
                analysis: {
                  type: 'object',
                  properties: { lenses: { type: 'array', items: { type: 'string', enum: ANALYSIS_LENSES } }, staleDays: { type: 'integer' }, entities: { type: 'array', items: { type: 'string' } } },
                  required: ['lenses', 'staleDays'],
                },
              },
              required: ['key', 'label', 'type'],
            },
          },
        },
        required: ['version', 'name', 'entities', 'views'],
      },
      ejemplos: {
        type: 'array',
        description: 'Registros de ejemplo, solo al crear la aplicación.',
        items: { type: 'object', properties: { entity: { type: 'string' }, data: { type: 'object' } }, required: ['entity', 'data'] },
      },
    },
    required: ['resumen', 'plano'],
  },
};

// Sample records must point at real entities and fields; anything else is dropped.
export function cleanSamples(bp: Blueprint, raw: unknown): SampleRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SampleRecord[] = [];
  for (const r of raw.slice(0, 60)) {
    const e = bp.entities.find((x) => x.key === r?.entity);
    if (!e || !r.data || typeof r.data !== 'object') continue;
    const data: RecordData = {};
    for (const f of e.fields) {
      const v = (r.data as RecordData)[f.key];
      if (v === undefined || v === null || f.type === 'relation') continue;
      if (f.type === 'select' && !f.options?.some((o) => o.value === v)) continue;
      data[f.key] = v;
    }
    out.push({ entity: e.key, data });
  }
  return out;
}

const textOf = (content: ContentBlock[]) =>
  content.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n').trim();

export async function runAgent(opts: {
  callModel: CallModel;
  current: Blueprint | null;
  history: ModelMessage[];
  message: string;
}): Promise<AgentResult> {
  const system = buildSystemPrompt(opts.current);
  const messages: ModelMessage[] = [...opts.history, { role: 'user', content: opts.message }];
  let failures = 0;
  let reply = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await opts.callModel({ system, messages, tools: [PROPOSE_TOOL] });
    const said = textOf(res.content);
    if (said) reply = said;
    messages.push({ role: 'assistant', content: res.content });

    // Long server-side turns can pause; sending the content back resumes them.
    if (res.stop_reason === 'pause_turn') continue;

    const calls = res.content.filter((b) => b.type === 'tool_use');
    if (calls.length === 0) return { reply, proposal: null };

    const results: ContentBlock[] = [];
    let proposal: Proposal | null = null;
    for (const call of calls) {
      if (call.name !== TOOL) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `La herramienta ${call.name} no existe.` });
        continue;
      }
      const input = (call.input ?? {}) as { resumen?: string; plano?: unknown; ejemplos?: unknown };
      const errors = validateBlueprint(input.plano);
      if (errors.length) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `El plano tiene errores. Corrígelos y vuelve a proponer:\n- ${errors.join('\n- ')}` });
        continue;
      }
      // kind and modules record which cards the app was built from; the app keeps them, not the model.
      const bp = { ...(input.plano as Blueprint) };
      if (opts.current?.kind) bp.kind = opts.current.kind;
      if (opts.current?.modules) bp.modules = opts.current.modules;
      if (opts.current?.sector) bp.sector = opts.current.sector;
      if (opts.current?.logo) bp.logo = opts.current.logo; else delete bp.logo;
      proposal = {
        summary: String(input.resumen ?? '').trim() || reply,
        blueprint: bp,
        changes: diffBlueprints(opts.current, bp),
        samples: opts.current ? [] : cleanSamples(bp, input.ejemplos),
      };
    }
    if (proposal) {
      if (proposal.changes.length === 0) return { reply: 'Lo que pides ya está así en tu aplicación; no hay nada que cambiar.', proposal: null };
      return { reply: proposal.summary, proposal };
    }
    failures++;
    if (failures >= MAX_ATTEMPTS) {
      return { reply: 'No he conseguido preparar un cambio válido. ¿Puedes decírmelo de otra forma o con algo más de detalle?', proposal: null };
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: reply || 'No he podido terminar. Prueba otra vez.', proposal: null };
}
