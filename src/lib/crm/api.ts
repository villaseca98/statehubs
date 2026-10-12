import { server } from '@/lib/supabase';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import type { Change } from '@shared/blueprint/diff.ts';
import type { SyncSummary } from '@shared/blueprint/ical.ts';

// The generated Supabase types don't know the crm_* tables yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => server() as any;

export interface CrmApp { id: string; name: string; current_version: number | null; updated_at: string }
export interface CrmVersion { version: number; summary: string; created_at: string; blueprint: Blueprint }
export interface CrmMessage { id: string; role: 'user' | 'assistant'; content: string; proposal_id: string | null; created_at: string }
// What a calendar sync did; `mensaje` replaces the counts when there was nothing to do.
export type IcalSyncResult = SyncSummary & { mensaje?: string };
// The Instagram account behind the assistant (crm-instagram). The token never leaves the server.
export interface InstagramStatus { connected: boolean; username?: string | null; expires_at?: string | null; configured?: boolean; url?: string; mensaje?: string }
export type InstagramAction = 'status' | 'connect' | 'disconnect';
export interface CrmProposal {
  id: string; base_version: number | null; blueprint: Blueprint; summary: string; changes: Change[];
  samples: { entity: string; data: RecordData; id?: string }[]; status: 'pending' | 'applied' | 'discarded'; created_at: string;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export const crmApi = {
  listApps: () => must<CrmApp[]>(db().from('crm_apps').select('id, name, current_version, updated_at').order('updated_at', { ascending: false })),
  createApp: (ownerId: string) => must<CrmApp>(db().from('crm_apps').insert({ owner_id: ownerId }).select('id, name, current_version, updated_at').single()),
  deleteApp: (id: string) => must(db().from('crm_apps').delete().eq('id', id)),
  getApp: (id: string) => must<CrmApp | null>(db().from('crm_apps').select('id, name, current_version, updated_at').eq('id', id).maybeSingle()),
  versions: (appId: string) => must<CrmVersion[]>(db().from('crm_app_versions').select('version, summary, created_at, blueprint').eq('app_id', appId).order('version', { ascending: false })),
  messages: (appId: string) => must<CrmMessage[]>(db().from('crm_messages').select('id, role, content, proposal_id, created_at').eq('app_id', appId).order('created_at')),
  pendingProposal: async (appId: string) => {
    const rows = await must<CrmProposal[]>(db().from('crm_proposals').select('*').eq('app_id', appId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1));
    return (rows[0] ?? null) as CrmProposal | null;
  },
  records: (appId: string) => must<AppRecord[]>(db().from('crm_records').select('id, entity, data, is_sample, created_at, updated_at').eq('app_id', appId).order('created_at')),
  createRecord: (appId: string, entity: string, data: RecordData) =>
    must<AppRecord>(db().from('crm_records').insert({ app_id: appId, entity, data }).select('id, entity, data, is_sample, created_at, updated_at').single()),
  updateRecord: (id: string, data: RecordData) => must(db().from('crm_records').update({ data, updated_at: new Date().toISOString() }).eq('id', id)),
  deleteRecord: (id: string) => must(db().from('crm_records').delete().eq('id', id)),
  apply: (proposalId: string) => must<number>(db().rpc('crm_apply_proposal', { p_proposal: proposalId })),
  discard: (proposalId: string) => must(db().rpc('crm_discard_proposal', { p_proposal: proposalId })),
  restore: (appId: string, version: number) => must<number>(db().rpc('crm_restore_version', { p_app: appId, p_version: version })),
  clearSamples: (appId: string) => must<number>(db().rpc('crm_clear_samples', { p_app: appId })),
  ask: (appId: string, message: string) => invokeAgent({ app_id: appId, message }),
  // Functions picked by hand (cards): the server validates the blueprint and makes the proposal, no AI.
  propose: (appId: string, blueprint: Blueprint) => invokeAgent({ app_id: appId, blueprint }) as Promise<{ message: CrmMessage; proposal: CrmProposal }>,
  // Reads the Airbnb/Booking iCal link of each property on the server (crm-ical).
  syncIcal: (appId: string) => invokeFunction<IcalSyncResult>('crm-ical', { app_id: appId }),
  // Connects the Instagram account (OAuth on the server) or says how it is.
  instagram: (appId: string, action: InstagramAction) => invokeFunction<InstagramStatus>('crm-instagram', { app_id: appId, action, origin: window.location.origin }),
};

function invokeAgent(body: Record<string, unknown>): Promise<{ message: CrmMessage; proposal: CrmProposal | null }> {
  return invokeFunction('crm-agent', body);
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await server().functions.invoke(name, { body });
  if (error) {
    // supabase-js hides the JSON body of non-2xx answers in error.context.
    let text = error.message;
    try { text = (await (error as { context?: Response }).context?.json())?.error ?? text; } catch { /* keep generic */ }
    throw new Error(text);
  }
  return data;
}
