import type { CommissionInput, CommissionLedger, CommissionReceipt } from './commissions';
import type { OfferInput, OfferRevision } from './offers';
import { server } from '@/lib/supabase';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import type { Change } from '@shared/blueprint/diff.ts';
import type { SyncSummary } from '@shared/blueprint/ical.ts';
import type { BusyInterval } from '@shared/blueprint/slots.ts';

// The generated Supabase types don't know the crm_* tables yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => server() as any;

export interface MatchDecision { app_id: string; contact_id: string; property_id: string; status: 'saved'|'dismissed'|'suggested'; actor_id: string|null; updated_at: string }
export interface RecordEvent { id: string; record_id: string; actor_id: string | null; kind: 'created' | 'changed' | 'note' | 'call' | 'meeting'; body: string | null; fields: string[]; created_at: string }
export interface CrmApp { id: string; org_id?: string | null; name: string; current_version: number | null; updated_at: string }
export type OrgRole = 'owner' | 'admin' | 'agent' | 'viewer';
export interface CrmOrganization { id: string; name: string; settings: Record<string, unknown>; owner_id: string; updated_at: string }
export interface CrmOrgMember { org_id: string; user_id: string; role: OrgRole; joined_at: string }
export interface WorkspaceAccess { role: OrgRole; can_edit: boolean; can_delete: boolean; can_manage: boolean }
export interface PlatformOrganization extends CrmOrganization { member_count: number; app_count: number }
export interface CrmVersion { version: number; summary: string; created_at: string; blueprint: Blueprint }
export interface CrmMessage { id: string; role: 'user' | 'assistant'; content: string; proposal_id: string | null; created_at: string }
// What a calendar sync did; `mensaje` replaces the counts when there was nothing to do.
export type IcalSyncResult = SyncSummary & { mensaje?: string };
// Google Calendar for the signed-in person. `configured` is false while the
// server lacks the Google secrets; `available` is false in guest mode.
export const GOOGLE_NOT_CONFIGURED = 'Falta configurar Google en el servidor';
export interface GoogleStatus { available: boolean; configured: boolean; connected: boolean; email?: string; mensaje?: string }
// What a push did to the event of a record.
export interface GooglePushResult { estado: 'creado' | 'actualizado' | 'quitado' | 'sin_fecha'; enlace?: string }
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
  reverseCommissionReceipt: (receiptId:string,reason:string,request:string) => must<CommissionReceipt>(db().rpc('crm_reverse_commission_receipt',{p_receipt:receiptId,p_reason:reason,p_request:request})),
  commissionLedger: async (dealId:string):Promise<CommissionLedger|null> => {
    const ledger=await must<Omit<CommissionLedger,'receipts'>|null>(db().from('crm_commission_ledgers').select('*').eq('deal_id',dealId).maybeSingle());
    if(!ledger)return null;
    const receipts:CommissionReceipt[]=[];
    for(let offset=0;;offset+=500){const page=await must<CommissionReceipt[]>(db().from('crm_commission_receipts').select('*').eq('deal_id',dealId).order('created_at').order('id').range(offset,offset+499));receipts.push(...page);if(page.length<500)break;}
    return {...ledger,receipts};
  },
  createCommission: (dealId:string,input:CommissionInput,request:string) => must<Omit<CommissionLedger,'receipts'>>(db().rpc('crm_create_commission',{p_deal:dealId,p_currency:input.currency,p_total:input.total_units,p_shares:input.shares,p_request:request})),
  recordCommissionReceipt: (dealId:string,index:number,units:number,reference:string,request:string) => must<CommissionReceipt>(db().rpc('crm_record_commission_receipt',{p_deal:dealId,p_share:index,p_units:units,p_reference:reference,p_request:request})),
  offerRevisions: (dealId: string) => must<OfferRevision[]>(db().from('crm_offer_revisions').select('*').eq('deal_id',dealId).order('revision',{ascending:false}).limit(100)),
  appendOffer: (dealId: string, input: OfferInput, expected: number, request: string) => must<OfferRevision>(db().rpc('crm_append_offer',{p_deal:dealId,p_amount:input.amount,p_currency:input.currency,p_status:input.status,p_note:input.note,p_expected:expected,p_request:request})),
  matchDecisions: async (appId: string) => {
    const rows: MatchDecision[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await must<MatchDecision[]>(db().from('crm_match_decisions').select('app_id,contact_id,property_id,status,actor_id,updated_at').eq('app_id',appId).order('contact_id').order('property_id').range(offset, offset + 499));
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  },
  setMatchDecision: (contactId: string, propertyId: string, status: MatchDecision['status']) => must<MatchDecision>(db().rpc('crm_set_match_decision',{p_contact:contactId,p_property:propertyId,p_status:status})),
  recordEvents: (recordId: string) => must<RecordEvent[]>(db().from('crm_record_events').select('id,record_id,actor_id,kind,body,fields,created_at').eq('record_id', recordId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)),
  addRecordActivity: (recordId: string, kind: 'note' | 'call' | 'meeting', body: string, requestId: string) => must<RecordEvent>(db().rpc('crm_add_record_activity', { p_record: recordId, p_kind: kind, p_body: body, p_request: requestId })),
  platformStatus: () => must<boolean>(db().rpc('crm_platform_status')),
  platformOrganizations: () => must<PlatformOrganization[]>(db().rpc('crm_platform_organizations')),
  workspaceAccess: (appId: string) => must<WorkspaceAccess | null>(db().rpc('crm_workspace_access', { p_app: appId })),
  listApps: () => must<CrmApp[]>(db().from('crm_apps').select('id, name, current_version, updated_at').order('updated_at', { ascending: false })),
  organizations: () => must<CrmOrganization[]>(db().from('crm_organizations').select('id, name, settings, owner_id, updated_at').order('updated_at', { ascending: false })),
  members: (orgId: string) => must<CrmOrgMember[]>(db().rpc('crm_organization_members', { p_org: orgId })),
  updateOrganization: (orgId: string, name: string, settings: Record<string, unknown>) => must<CrmOrganization>(db().from('crm_organizations').update({ name, settings }).eq('id', orgId).select('id, name, settings, owner_id, updated_at').single()),
  setOrganizationMember: (orgId: string, userId: string, role: Exclude<OrgRole, 'owner'>) => must(db().rpc('crm_set_org_member', { p_org: orgId, p_user: userId, p_role: role })),
  removeOrganizationMember: (orgId: string, userId: string) => must(db().rpc('crm_remove_org_member', { p_org: orgId, p_user: userId })),
  createApp: (ownerId: string) => must<CrmApp>(db().from('crm_apps').insert({ owner_id: ownerId }).select('id, name, current_version, updated_at').single()),
  deleteApp: (id: string) => must(db().from('crm_apps').delete().eq('id', id).select('id').single()),
  getApp: (id: string) => must<CrmApp | null>(db().from('crm_apps').select('id, name, current_version, updated_at').eq('id', id).maybeSingle()),
  versions: (appId: string) => must<CrmVersion[]>(db().rpc('crm_visible_versions', { p_app: appId })),
  messages: (appId: string) => must<CrmMessage[]>(db().from('crm_messages').select('id, role, content, proposal_id, created_at').eq('app_id', appId).order('created_at')),
  pendingProposal: async (appId: string) => {
    const rows = await must<CrmProposal[]>(db().from('crm_proposals').select('*').eq('app_id', appId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1));
    return (rows[0] ?? null) as CrmProposal | null;
  },
  records: (appId: string) => must<AppRecord[]>(db().from('crm_records').select('id, entity, data, is_sample, created_at, updated_at').eq('app_id', appId).order('created_at')),
  createRecord: (appId: string, entity: string, data: RecordData) =>
    must<AppRecord>(db().from('crm_records').insert({ app_id: appId, entity, data }).select('id, entity, data, is_sample, created_at, updated_at').single()),
  updateRecord: (id: string, data: RecordData) => must(db().from('crm_records').update({ data, updated_at: new Date().toISOString() }).eq('id', id).select('id').single()),
  patchRecord: (id: string, patch: RecordData, expectedUpdatedAt?: string) => must<AppRecord>(db().rpc('crm_patch_record', { p_id: id, p_patch: patch, p_expected_updated_at: expectedUpdatedAt ?? null })),
  deleteRecord: (id: string) => must(db().from('crm_records').delete().eq('id', id).select('id').single()),
  apply: (proposalId: string) => must<number>(db().rpc('crm_apply_proposal', { p_proposal: proposalId })),
  discard: (proposalId: string) => must(db().rpc('crm_discard_proposal', { p_proposal: proposalId })),
  restore: (appId: string, version: number) => must<number>(db().rpc('crm_restore_version', { p_app: appId, p_version: version })),
  clearSamples: (appId: string) => must<number>(db().rpc('crm_clear_samples', { p_app: appId })),
  ask: (appId: string, message: string) => invokeAgent({ app_id: appId, message }),
  // Functions picked by hand (cards): the server validates the blueprint and makes the proposal, no AI.
  propose: (appId: string, blueprint: Blueprint) => invokeAgent({ app_id: appId, blueprint }) as Promise<{ message: CrmMessage; proposal: CrmProposal }>,
  // Reads the Airbnb/Booking iCal link of each property on the server (crm-ical).
  syncIcal: (appId: string) => invokeFunction<IcalSyncResult>('crm-ical', { app_id: appId }),
  // Google Calendar (crm-google): connect with OAuth, create or move the event
  // of a record, and read the busy hours so booking avoids them.
  googleStatus: () => invokeFunction<GoogleStatus>('crm-google', { action: 'status' }),
  googleConnect: (returnTo: string) => invokeFunction<{ url: string }>('crm-google', { action: 'start', return_to: returnTo }),
  googleFinish: (code: string, state: string) => invokeFunction<GoogleStatus>('crm-google', { action: 'finish', code, state }),
  googleDisconnect: () => invokeFunction<GoogleStatus>('crm-google', { action: 'disconnect' }),
  googleBusy: async (from: string, to: string) => (await invokeFunction<{ busy: BusyInterval[] }>('crm-google', { action: 'busy', from, to })).busy,
  googlePush: (appId: string, recordId: string) => invokeFunction<GooglePushResult>('crm-google', { action: 'push', app_id: appId, record_id: recordId }),
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
