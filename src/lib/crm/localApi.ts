import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import { cardProposal } from '@shared/blueprint/modules.ts';
import type { MatchDecision, RecordEvent, CrmApp, CrmMessage, CrmProposal, CrmVersion, GoogleStatus, IcalSyncResult, InstagramStatus, crmApi } from './api';
import { localAgent } from './localAgent';

// Guest mode: the same API as crmApi, kept in this browser (localStorage).
// Same rules as the server: proposals first, every apply is a version,
// undo restores as a new version, a stale proposal is refused.

interface LocalApp { matches?: MatchDecision[]; events?: RecordEvent[]; app: CrmApp; versions: CrmVersion[]; messages: CrmMessage[]; proposals: CrmProposal[]; records: AppRecord[] }
type Store = Record<string, LocalApp>;

const KEY = 'statehubs_local_v1';
let memory: Store = {};

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store; } catch { return memory; }
}
function save(s: Store) {
  memory = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: keep in memory */ }
}
function update<T>(appId: string, fn: (a: LocalApp) => T): T {
  const s = load();
  const a = s[appId];
  if (!a) throw new Error('Aplicación no encontrada');
  const out = fn(a);
  a.app.updated_at = new Date().toISOString();
  save(s);
  return out;
}

// Connecting a Google Calendar needs the OAuth dance on our server and
// somewhere safe to keep the permission; a browser-only app has neither.
export const GOOGLE_NEEDS_ACCOUNT = 'Conectar tu Google Calendar necesita una cuenta. En modo prueba, cada cita tiene «Añadir a Google Calendar» y la descarga .ics.';
const needsAccount = async (): Promise<never> => { throw new Error(GOOGLE_NEEDS_ACCOUNT); };

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
export const isLocalApp = (id: string) => id.startsWith('local-');

function eventFor(a: LocalApp, record: AppRecord, before?: RecordData) {
  const fields = before ? [...new Set([...Object.keys(before), ...Object.keys(record.data)])].filter(k => JSON.stringify(before[k]) !== JSON.stringify(record.data[k])).sort() : [];
  if (before && !fields.length) return;
  (a.events ??= []).push({ id: uid(), record_id: record.id, actor_id: null, kind: before ? 'changed' : 'created', fields, body: null, created_at: now() });
}
export const localCrmApi: typeof crmApi = {
  matchDecisions: async appId => load()[appId]?.matches ?? [],
  setMatchDecision: async (contactId,propertyId,status) => {
    if (!['saved','dismissed','suggested'].includes(status)) throw new Error('Invalid match decision');
    const store=load();const app=Object.values(store).find(a=>a.records.some(r=>r.id===contactId));
    const contact=app?.records.find(r=>r.id===contactId), property=app?.records.find(r=>r.id===propertyId);
    if (!app||!contact||!property||!['contacto_inmo','lead','cliente'].includes(contact.entity)||property.entity!=='inmueble'||Boolean(contact.is_sample)!==Boolean(property.is_sample)) throw new Error('Match unavailable');
    const previous=app.matches?.find(m=>m.contact_id===contactId&&m.property_id===propertyId);
    const decision: MatchDecision={app_id:app.app.id,contact_id:contactId,property_id:propertyId,status,actor_id:null,updated_at:now()};
    app.matches=[...(app.matches??[]).filter(m=>m.contact_id!==contactId||m.property_id!==propertyId),decision];
    if(previous?.status!==status)(app.events??=[]).push({id:uid(),record_id:contactId,actor_id:null,kind:'note',body:`Match ${status}: property ${propertyId}`,fields:[],created_at:now()});
    save(store);return decision;
  },
  recordEvents: async (recordId: string) => Object.values(load()).flatMap(a => a.events ?? []).filter(e => e.record_id === recordId).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0,50),
  addRecordActivity: async (recordId, kind, body, requestId) => {
    if (!['note','call','meeting'].includes(kind) || !body.trim() || body.trim().length > 4000 || !requestId) throw new Error('Invalid activity');
    const s = load();
    const app = Object.values(s).find(a => a.records.some(r => r.id === recordId));
    if (!app) throw new Error('Record unavailable');
    const existing = Object.values(s).flatMap(a => a.events ?? []).find(e => e.id === requestId);
    if (existing) {
      if (existing.record_id !== recordId || existing.kind !== kind || existing.body !== body.trim()) throw new Error('Activity request already used');
      return existing;
    }
    const event: RecordEvent = { id: requestId, record_id: recordId, actor_id: null, kind, body: body.trim(), fields: [], created_at: now() };
    (app.events ??= []).push(event); save(s); return event;
  },
  platformStatus: async () => false,
  platformOrganizations: async () => [],
  workspaceAccess: async () => ({ role: 'owner', can_edit: true, can_delete: true, can_manage: true }),
  organizations: async () => [],
  members: async () => [],
  updateOrganization: needsAccount,
  setOrganizationMember: needsAccount,
  removeOrganizationMember: needsAccount,
  listApps: async () => Object.values(load()).map((a) => a.app).sort((x, y) => y.updated_at.localeCompare(x.updated_at)),
  createApp: async () => {
    const app: CrmApp = { id: `local-${uid()}`, name: 'Nueva aplicación', current_version: null, updated_at: now() };
    const s = load();
    s[app.id] = { app, versions: [], messages: [], proposals: [], records: [] };
    save(s);
    return app;
  },
  deleteApp: async (id: string) => { const s = load(); delete s[id]; save(s); return null; },
  getApp: async (id: string) => load()[id]?.app ?? null,
  versions: async (appId: string) => [...(load()[appId]?.versions ?? [])].sort((a, b) => b.version - a.version),
  messages: async (appId: string) => load()[appId]?.messages ?? [],
  pendingProposal: async (appId: string) => [...(load()[appId]?.proposals ?? [])].reverse().find((p) => p.status === 'pending') ?? null,
  records: async (appId: string) => load()[appId]?.records ?? [],
  createRecord: async (appId: string, entity: string, data: RecordData) =>
    update(appId, (a) => { const r: AppRecord = { id: uid(), entity, data, created_at: now() }; a.records.push(r); eventFor(a, r); return r; }),
  updateRecord: async (id: string, data: RecordData) => {
    const s = load();
    for (const a of Object.values(s)) {
      const r = a.records.find((x) => x.id === id);
      if (r) { const before = r.data; r.data = data; eventFor(a, r, before); r.updated_at = now(); save(s); return null; }
    }
    throw new Error('Registro no encontrado');
  },
  patchRecord: async (id: string, patch: RecordData, expectedUpdatedAt?: string) => {
    const s = load();
    for (const a of Object.values(s)) {
      const r = a.records.find((x) => x.id === id);
      if (!r) continue;
      if (expectedUpdatedAt && r.updated_at !== expectedUpdatedAt) throw new Error('Record changed; reload before saving');
      const before = r.data;
      r.data = { ...r.data, ...patch };
      eventFor(a, r, before);
      r.updated_at = now();
      save(s);
      return r;
    }
    throw new Error('Registro no encontrado');
  },
  deleteRecord: async (id: string) => {
    const s = load();
    for (const a of Object.values(s)) { a.records = a.records.filter((r) => r.id !== id); a.events = a.events?.filter(e => e.record_id !== id); a.matches = a.matches?.filter(m=>m.contact_id!==id&&m.property_id!==id); }
    save(s);
    return null;
  },
  apply: async (proposalId: string) => {
    const s = load();
    const a = Object.values(s).find((x) => x.proposals.some((p) => p.id === proposalId));
    const p = a?.proposals.find((x) => x.id === proposalId);
    if (!a || !p) throw new Error('Propuesta no encontrada');
    if (p.status !== 'pending') throw new Error('Esta propuesta ya no está pendiente');
    if (a.app.current_version !== p.base_version) throw new Error('La aplicación ha cambiado desde esta propuesta; pide el cambio otra vez');
    const version = Math.max(0, ...a.versions.map((v) => v.version)) + 1;
    a.versions.push({ version, summary: p.summary, created_at: now(), blueprint: p.blueprint });
    a.app.current_version = version;
    a.app.name = p.blueprint.name || a.app.name;
    a.app.updated_at = now();
    for (const smp of p.samples as (CrmProposal['samples'][number] & { id?: string })[]) {
      // Keep sample ids so links between them work, unless one is already taken.
      const id = smp.id && !a.records.some((r) => r.id === smp.id) ? smp.id : uid();
      a.records.push({ id, entity: smp.entity, data: smp.data, is_sample: true, created_at: now() });
    }
    p.status = 'applied';
    for (const o of a.proposals) if (o.status === 'pending') o.status = 'discarded';
    save(s);
    return version;
  },
  discard: async (proposalId: string) => {
    const s = load();
    for (const a of Object.values(s)) for (const p of a.proposals) if (p.id === proposalId && p.status === 'pending') p.status = 'discarded';
    save(s);
    return null;
  },
  restore: async (appId: string, version: number) => update(appId, (a) => {
    const v = a.versions.find((x) => x.version === version);
    if (!v) throw new Error('Esa versión no existe');
    if (a.app.current_version === version) throw new Error('Esa ya es la versión actual');
    const next = Math.max(...a.versions.map((x) => x.version)) + 1;
    a.versions.push({ version: next, summary: `Vuelta a la versión ${version}`, created_at: now(), blueprint: v.blueprint });
    a.app.current_version = next;
    for (const p of a.proposals) if (p.status === 'pending') p.status = 'discarded';
    return next;
  }),
  clearSamples: async (appId: string) => update(appId, (a) => {
    const before = a.records.length;
    a.records = a.records.filter((r) => !r.is_sample);
    return before - a.records.length;
  }),
  ask: async (appId: string, message: string) => update(appId, (a) => {
    a.messages.push({ id: uid(), role: 'user', content: message, proposal_id: null, created_at: now() });
    const current = a.versions.find((v) => v.version === a.app.current_version)?.blueprint ?? null;
    const res = localAgent(message, current);
    let proposal: CrmProposal | null = null;
    if (res.proposal) {
      for (const o of a.proposals) if (o.status === 'pending') o.status = 'discarded';
      proposal = { id: uid(), base_version: a.app.current_version, status: 'pending', created_at: now(), ...res.proposal };
      a.proposals.push(proposal);
    }
    const reply: CrmMessage = { id: uid(), role: 'assistant', content: res.reply, proposal_id: proposal?.id ?? null, created_at: now() };
    a.messages.push(reply);
    return { message: reply, proposal };
  }),
  propose: async (appId: string, blueprint: Blueprint) => update(appId, (a) => {
    const current = a.versions.find((v) => v.version === a.app.current_version)?.blueprint ?? null;
    const made = cardProposal(current, blueprint, () => `local-r-${uid()}`);
    if ('errors' in made) throw new Error(`La propuesta no es válida: ${made.errors.slice(0, 3).join('; ')}`);
    for (const o of a.proposals) if (o.status === 'pending') o.status = 'discarded';
    const proposal: CrmProposal = { id: uid(), base_version: a.app.current_version, status: 'pending', created_at: now(), ...made.proposal };
    a.proposals.push(proposal);
    const message: CrmMessage = { id: uid(), role: 'assistant', content: `${made.proposal.summary}. Así quedaría; aplícalo si te convence.`, proposal_id: proposal.id, created_at: now() };
    a.messages.push(message);
    return { message, proposal };
  }),
  // The browser can't read Airbnb or Booking calendars (they don't allow it),
  // and inventing bookings would be lying: say what it needs instead.
  syncIcal: async (): Promise<IcalSyncResult> => ({
    nuevas: 0, actualizadas: 0, canceladas: 0, errores: [],
    mensaje: 'Sincronizar con Airbnb y Booking necesita una cuenta: los calendarios se leen desde nuestro servidor. En modo prueba puedes apuntar las reservas a mano.',
  }),
  googleStatus: async (): Promise<GoogleStatus> => ({ available: false, configured: false, connected: false, mensaje: GOOGLE_NEEDS_ACCOUNT }),
  googleConnect: needsAccount,
  googleFinish: needsAccount,
  googleDisconnect: needsAccount,
  googleBusy: async () => [],
  googlePush: needsAccount,
  // Instagram talks to our server, never to a browser: in guest mode only the simulator works.
  instagram: async (): Promise<InstagramStatus> => ({
    connected: false,
    mensaje: 'Conectar tu Instagram necesita una cuenta de StateHubs: los mensajes llegan a nuestro servidor. En modo prueba puedes probar el asistente en el simulador.',
  }),
};
