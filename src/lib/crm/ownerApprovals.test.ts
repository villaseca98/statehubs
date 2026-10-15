import {describe,it,expect} from 'vitest';
import {decideOwnerApproval} from './ownerApprovals';
const request={id:'a',organizationId:'org',assetId:'house',ownerContactId:'owner',requestedBy:'manager',status:'pending' as const};
describe('remote ownership approvals',()=>{
 it('creates a decided copy with attribution',()=>{
  const decided=decideOwnerApproval(request,{organizationId:'org',ownerContactId:'owner',status:'approved',decidedAt:'2027-01-02T12:00:00Z'});
  expect(decided.status).toBe('approved');expect(decided.decisionBy).toBe('owner');expect(request.status).toBe('pending');
 });
 it('blocks wrong owner and repeat decisions',()=>{
  const decision={organizationId:'org',ownerContactId:'owner',status:'rejected' as const,decidedAt:'2027-01-02T12:00:00Z'};
  expect(()=>decideOwnerApproval(request,{...decision,ownerContactId:'other'})).toThrow();
  expect(()=>decideOwnerApproval({...request,status:'approved'},decision)).toThrow();
 });
});
