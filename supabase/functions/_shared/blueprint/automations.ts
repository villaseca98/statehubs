import type { AppRecord, Blueprint, Entity, RecordData } from './types.ts';

// Automations are ordinary records of the `automatizacion` entity (from the
// "Automatizaciones" piece): "when something happens in a section, send it to
// this URL" (an n8n, Make or Zapier webhook). The same matching runs in the
// browser (guest mode) and in the crm-automate function (accounts).

export const AUTOMATION_ENTITY = 'automatizacion';
export type HookEvent = 'alta' | 'cambio' | 'prueba';

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Which entity a section name points at: key, singular or plural label.
export function sectionEntity(bp: Blueprint, section: unknown): Entity | undefined {
  const s = norm(section);
  if (!s) return undefined;
  return bp.entities.find((e) => [e.key, e.label, e.labelPlural].some((x) => norm(x) === s))
    ?? bp.views.map((v) => (norm(v.label) === s ? bp.entities.find((e) => e.key === v.entity) : undefined)).find(Boolean);
}

// Select fields whose value changed, with the new value and its label.
function changedStages(e: Entity, before: RecordData | null, after: RecordData) {
  return e.fields.filter((f) => f.type === 'select' && before && before[f.key] !== after[f.key])
    .map((f) => ({ value: String(after[f.key] ?? ''), label: f.options?.find((o) => o.value === after[f.key])?.label ?? '' }));
}

export function matchAutomations(bp: Blueprint, records: AppRecord[], entity: string, event: 'alta' | 'cambio', before: RecordData | null, after: RecordData): AppRecord[] {
  if (entity === AUTOMATION_ENTITY) return [];
  const e = bp.entities.find((x) => x.key === entity);
  if (!e || !bp.entities.some((x) => x.key === AUTOMATION_ENTITY)) return [];
  const stages = event === 'cambio' ? changedStages(e, before, after) : [];
  return records.filter((a) => {
    if (a.entity !== AUTOMATION_ENTITY || a.data.estado !== 'activa' || !a.data.url) return false;
    if (sectionEntity(bp, a.data.seccion)?.key !== entity) return false;
    const on = a.data.evento ?? 'cualquiera';
    if (event === 'alta') return on === 'alta' || on === 'cualquiera';
    if (on === 'alta') return false;
    if (on === 'cambio' && stages.length === 0) return false;
    const to = norm(a.data.estado_destino);
    return !to || stages.some((s) => norm(s.value) === to || norm(s.label) === to);
  }).slice(0, 10);
}

// What the webhook receives: raw data plus readable values, so a flow can use either.
export function hookPayload(bp: Blueprint, appName: string, entity: string, event: HookEvent, record: AppRecord, before: RecordData | null, titleOf: (id: string) => string | undefined = () => undefined) {
  const e = bp.entities.find((x) => x.key === entity);
  const legible: Record<string, unknown> = {};
  for (const f of e?.fields ?? []) {
    const v = record.data[f.key];
    if (v === undefined || v === null || v === '') continue;
    legible[f.label] = f.type === 'select' ? f.options?.find((o) => o.value === v)?.label ?? v
      : f.type === 'relation' ? titleOf(String(v)) ?? v : v;
  }
  return {
    evento: event,
    aplicacion: appName,
    seccion: e?.labelPlural ?? entity,
    registro: { id: record.id, titulo: e ? String(record.data[e.titleField] ?? '') : '', datos: record.data, legible },
    antes: before,
    enviado: new Date().toISOString(),
  };
}

// [SECURITY] Webhooks only go to public https hosts: no localhost, private
// networks or cloud metadata. The server also checks resolved addresses.
export function isAllowedHookUrl(raw: unknown): boolean {
  let u: URL;
  try { u = new URL(String(raw)); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return false;
  return !isPrivateAddress(h);
}

export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (ip.includes(':')) {
    const x = ip.toLowerCase();
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('ff');
  }
  return false;
}
