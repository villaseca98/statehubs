import {describe,it,expect} from 'vitest';
import {renovationFeasibility} from './renovationBudget';
describe('renovation feasibility',()=>{
 it('accounts for acquisition and renovation without implicit FX',()=>{
  expect(renovationFeasibility({acquisitionMinor:10000,resaleMinor:15000,currency:'EUR',costs:[{category:'works',amountMinor:2000,currency:'EUR'}]}))
   .toEqual({currency:'EUR',totalCostMinor:12000,grossMarginMinor:3000,grossMarginBasisPoints:2500});
 });
 it('rejects currency mixing and unsafe totals',()=>{
  expect(()=>renovationFeasibility({acquisitionMinor:100,resaleMinor:200,currency:'EUR',costs:[{category:'works',amountMinor:50,currency:'USD'}]})).toThrow();
  expect(()=>renovationFeasibility({acquisitionMinor:Number.MAX_SAFE_INTEGER,resaleMinor:200,currency:'EUR',costs:[{category:'works',amountMinor:50,currency:'EUR'}]})).toThrow();
 });
});
