/** Pure investment portfolio arithmetic. All amounts are integer minor units; no implicit FX. */
export interface InvestmentAsset {
 id: string; organizationId: string; currency: string;
 acquisitionMinor: number; currentValueMinor: number;
 annualRentMinor: number; annualExpenseMinor: number;
}
export interface InvestmentSummary {
 currency: string; assetCount: number; acquisitionMinor: number;
 currentValueMinor: number; unrealizedGainMinor: number;
 annualNetIncomeMinor: number; grossYieldBasisPoints: number | null;
 netYieldBasisPoints: number | null;
}
const valid=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const safe=(n:bigint)=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('Amount exceeds safe integer range');return Number(n)};
export function summarizeInvestmentPortfolio(assets:readonly InvestmentAsset[],organizationId:string,currency:string):InvestmentSummary {
 if(!organizationId.trim()||!/^[A-Z]{3}$/.test(currency))throw new Error('Organization and ISO currency required');
 const own=assets.filter(a=>a.organizationId===organizationId);
 let acquisition=0n,value=0n,rent=0n,expense=0n;
 const ids=new Set<string>();
 for(const a of own){
  if(!a.id.trim()||ids.has(a.id))throw new Error('Duplicate or missing asset ID');
  ids.add(a.id);
  if(a.currency!==currency)throw new Error('Portfolio contains a different currency; FX conversion is not supported');
  if(![a.acquisitionMinor,a.currentValueMinor,a.annualRentMinor,a.annualExpenseMinor].every(valid))throw new Error('Invalid asset amount');
  acquisition+=BigInt(a.acquisitionMinor);value+=BigInt(a.currentValueMinor);
  rent+=BigInt(a.annualRentMinor);expense+=BigInt(a.annualExpenseMinor);
 }
 const grossYield=acquisition===0n?null:safe(rent*10000n/acquisition);
 const netYield=acquisition===0n?null:safe((rent-expense)*10000n/acquisition);
 return {currency,assetCount:own.length,acquisitionMinor:safe(acquisition),currentValueMinor:safe(value),
  unrealizedGainMinor:safe(value-acquisition),annualNetIncomeMinor:safe(rent-expense),
  grossYieldBasisPoints:grossYield,netYieldBasisPoints:netYield};
}
