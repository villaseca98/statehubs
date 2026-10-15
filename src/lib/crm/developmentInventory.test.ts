import { describe, it, expect } from 'vitest';
import { reserveDevelopmentUnit, releaseExpiredUnit } from './developmentInventory';
const unit = { id:'u1', developmentId:'d1', organizationId:'org1', status:'available' as const, currency:'EUR', askingPriceMinor:20000000 };
describe('development unit planning', () => {
 it('reserves and releases expired units without mutating input', () => {
  const reserved=reserveDevelopmentUnit(unit,{organizationId:'org1',buyerId:'buyer1',reservedUntil:'2027-03-10',today:'2027-03-01'});
  expect(reserved.status).toBe('reserved'); expect(unit.status).toBe('available');
  expect(releaseExpiredUnit(reserved,'2027-03-11').status).toBe('available');
  expect(releaseExpiredUnit(reserved,'2027-03-10').status).toBe('reserved');
 });
 it('rejects tenant mismatch and concurrent-looking reservations', () => {
  const request={organizationId:'org1',buyerId:'buyer1',reservedUntil:'2027-03-10',today:'2027-03-01'};
  expect(()=>reserveDevelopmentUnit(unit,{...request,organizationId:'org2'})).toThrow();
  expect(()=>reserveDevelopmentUnit({...unit,status:'reserved'},request)).toThrow();
  expect(()=>reserveDevelopmentUnit(unit,{...request,reservedUntil:'2027-03-01'})).toThrow();
 });
});
