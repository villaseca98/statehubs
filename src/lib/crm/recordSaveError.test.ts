import { describe, expect, it } from 'vitest';
import { recordSaveError } from './recordSaveError';
describe('recordSaveError', () => {
 it('explains a concurrent booking conflict', () => {
  expect(recordSaveError({code:'23P01',message:'conflicting key value'})).toMatch(/already booked or blocked/);
  expect(recordSaveError(new Error('Property is unavailable for these dates'))).toMatch(/Choose another date range/);
 });
 it('explains invalid dates and missing properties', () => {
  expect(recordSaveError(new Error('Check-out must be later than check-in'))).toMatch(/later than check-in/);
  expect(recordSaveError(new Error('Booking requires a property'))).toMatch(/Select a property/);
 });
 it('retains non-booking errors', () => {
  expect(recordSaveError(new Error('Network unavailable'))).toBe('Network unavailable');
  expect(recordSaveError(null)).toMatch(/could not be saved/);
 });
});
