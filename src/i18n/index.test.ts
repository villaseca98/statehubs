import { describe, expect, it } from 'vitest';
import { formatCurrency, formatLocalDate } from './index';
describe('global locale formatting',()=>{
 it('formats EUR and USD without rewriting stored amounts',()=>{
  expect(formatCurrency(1234.5,'USD','en-US')).toContain('1,234.50');
  expect(formatCurrency(1234.5,'EUR','es-ES')).toContain('1.234,50');
 });
 it('uses IANA timezone',()=>{
  expect(formatLocalDate('2026-01-01T01:00:00Z','en-US','America/Los_Angeles')).toContain('Dec');
 });
});
