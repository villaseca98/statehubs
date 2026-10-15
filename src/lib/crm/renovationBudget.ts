/** Cost allocation for acquisition/renovation/resale feasibility; excludes taxes and jurisdictional advice. */
export interface RenovationCost { category: string; amountMinor: number; currency: string }
export interface RenovationFeasibilityInput { acquisitionMinor: number; resaleMinor: number; currency: string; costs: readonly RenovationCost[] }
export interface RenovationFeasibility { currency: string; totalCostMinor: number; grossMarginMinor: number; grossMarginBasisPoints: number | null }
export function renovationFeasibility(input: RenovationFeasibilityInput): RenovationFeasibility {
 const valid=(n:number)=>Number.isSafeInteger(n)&&n>=0;
 if(!/^[A-Z]{3}$/.test(input.currency)||!valid(input.acquisitionMinor)||!valid(input.resaleMinor)) throw new Error('Invalid amount or currency');
 let cost=BigInt(input.acquisitionMinor);
 for(const item of input.costs){
  if(!item.category.trim()||item.currency!==input.currency||!valid(item.amountMinor)) throw new Error('Invalid or mixed-currency renovation cost');
  cost+=BigInt(item.amountMinor);
 }
 if(cost>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Total exceeds safe integer range');
 const margin=BigInt(input.resaleMinor)-cost;
 const bps=cost===0n?null:Number((margin*10000n)/cost);
 return {currency:input.currency,totalCostMinor:Number(cost),grossMarginMinor:Number(margin),grossMarginBasisPoints:bps};
}
