import type { RecordData } from '@shared/blueprint/types';

export const CONTACT_ROLES = ['comprador', 'vendedor', 'propietario', 'arrendatario', 'inversor', 'huesped', 'colaborador'] as const;
export type ContactRole = typeof CONTACT_ROLES[number];
export type ContactStage = 'unclassified' | 'lead' | 'client' | 'archived';
// Existing contacts stay unclassified: a closed opportunity is not proof of a customer.
export function contactStage(data: RecordData): ContactStage {
  if (data.crm_archived === true) return 'archived';
  return data.crm_lifecycle === 'lead' || data.crm_lifecycle === 'client' ? data.crm_lifecycle : 'unclassified';
}
export function contactRoles(data: RecordData): ContactRole[] {
  return CONTACT_ROLES.filter(role => data.tipo === role || data[`crm_role_${role}`] === true);
}
// Conversion updates the original record; references and notes retain their IDs.
export function contactStagePatch(stage: Exclude<ContactStage, 'unclassified'>): RecordData {
  return stage === 'archived' ? { crm_archived: true } : { crm_lifecycle: stage, crm_archived: false };
}
