import {describe,it,expect} from 'vitest';
import {dormantReactivationCandidates} from './leadReactivation';
const lead={id:'a',organizationId:'org',consentToContact:true,qualification:'qualified' as const,createdAt:'2027-01-01T00:00:00Z'};
describe('dormant lead reactivation',()=>{
 it('includes only consented qualified dormant leads in current organization',()=>{
  const result=dormantReactivationCandidates([lead,{...lead,id:'b',consentToContact:false},{...lead,id:'c',organizationId:'other'},{...lead,id:'d',qualification:'unknown'}],'org','2027-02-01T00:00:00Z');
  expect(result.map(x=>x.leadId)).toEqual(['a']);
  expect(result[0].dormantDays).toBe(31);
 });
 it('does not classify future or recently contacted leads as dormant',()=>{
  expect(dormantReactivationCandidates([{...lead,lastMeaningfulContactAt:'2027-01-30T00:00:00Z'}],'org','2027-02-01T00:00:00Z')).toEqual([]);
 });
});
