import {describe,it,expect} from 'vitest';
import {leaseRenewalState,leasesRequiringReview} from './rentalRenewals';
const lease={id:'l1',organizationId:'a',startsOn:'2027-01-01',endsOn:'2027-12-31',renewalNoticeDays:30,status:'active' as const};
describe('lease renewal review',()=>{
 it('marks review window and expiry without renewing automatically',()=>{
  expect(leaseRenewalState(lease,'2027-12-01')).toBe('review_due');
  expect(leaseRenewalState(lease,'2027-11-01')).toBe('not_due');
  expect(leaseRenewalState(lease,'2028-01-01')).toBe('expired');
 });
 it('filters review queue by organization',()=>{
  expect(leasesRequiringReview([lease,{...lease,id:'l2',organizationId:'b'}],'a','2027-12-15').map(x=>x.id)).toEqual(['l1']);
 });
 it('rejects invalid dates and notice periods',()=>{
  expect(()=>leaseRenewalState({...lease,endsOn:'2027-02-30'},'2027-01-01')).toThrow();
  expect(()=>leaseRenewalState({...lease,renewalNoticeDays:-1},'2027-01-01')).toThrow();
 });
});
