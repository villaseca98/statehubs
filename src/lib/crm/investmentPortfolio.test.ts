import {describe,it,expect} from 'vitest';
import {summarizeInvestmentPortfolio} from './investmentPortfolio';
const a={id:'one',organizationId:'org',currency:'EUR',acquisitionMinor:100000,currentValueMinor:120000,annualRentMinor:9000,annualExpenseMinor:3000};
describe('investment portfolio summary',()=>{
 it('calculates currency-safe gross/net yields and ignores other tenants',()=>{
  expect(summarizeInvestmentPortfolio([a,{...a,id:'other',organizationId:'other'}],'org','EUR')).toEqual({
   currency:'EUR',assetCount:1,acquisitionMinor:100000,currentValueMinor:120000,
   unrealizedGainMinor:20000,annualNetIncomeMinor:6000,grossYieldBasisPoints:900,netYieldBasisPoints:600});
 });
 it('rejects mixed currencies and duplicates',()=>{
  expect(()=>summarizeInvestmentPortfolio([{...a,currency:'USD'}],'org','EUR')).toThrow();
  expect(()=>summarizeInvestmentPortfolio([a,a],'org','EUR')).toThrow();
 });
 it('handles empty portfolios without fabricated yields',()=>{
  expect(summarizeInvestmentPortfolio([],'org','EUR').netYieldBasisPoints).toBeNull();
 });
});
