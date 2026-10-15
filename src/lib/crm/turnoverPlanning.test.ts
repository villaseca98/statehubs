import { describe, expect, it } from 'vitest';
import { planTurnover } from './turnoverPlanning';
const input={organizationId:'org1',assetId:'villa1',bookingId:'booking1',requestedBy:'manager1',checkOutAt:'2026-11-01T11:00:00+08:00',nextCheckInAt:'2026-11-01T15:00:00+08:00',cleaningMinutes:120};
describe('planTurnover',()=>{
 it('creates four unassigned draft work orders in chronological order',()=>{
  const result=planTurnover(input);
  expect(result.warnings).toEqual([]);
  expect(result.orders.map(o=>o.service)).toEqual(['check_out','cleaning','inspection','check_in']);
  expect(result.orders.every(o=>o.status==='draft'&&!o.providerId)).toBe(true);
  expect(result.orders[1].dueAt).toBe('2026-11-01T05:00:00.000Z');
 });
 it('flags an impossible cleaning window without claiming providers were booked',()=>{
  const result=planTurnover({...input,cleaningMinutes:300});
  expect(result.warnings).toHaveLength(1);
  expect(result.orders.every(o=>o.status==='draft')).toBe(true);
 });
 it('rejects invalid date ordering and missing identifiers',()=>{
  expect(planTurnover({...input,nextCheckInAt:input.checkOutAt}).orders).toEqual([]);
  expect(planTurnover({...input,assetId:''}).orders).toEqual([]);
 });
});
