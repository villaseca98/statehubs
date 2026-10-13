import { CURRENCY_DECIMALS } from './currencyDecimals';
export interface CommissionShare { recipient: string; units: number }
export interface CommissionInput { currency: string; total_units: number; shares: CommissionShare[] }
export interface CommissionReceipt { reverses?: string | null; id: string; deal_id: string; share_index: number; units: number; reference: string; actor_id: string|null; created_at: string }
export interface CommissionLedger extends CommissionInput { deal_id: string; app_id: string; request_id: string; actor_id: string|null; created_at: string; receipts: CommissionReceipt[] }
export const MAX_COMMISSION_UNITS = 9_000_000_000_000;
export function currencyDecimals(currency: string) {
 if(!Object.prototype.hasOwnProperty.call(CURRENCY_DECIMALS,currency))throw new Error('Choose a supported currency');
 return CURRENCY_DECIMALS[currency];
}
export function moneyUnits(value:string,currency:string):number {
 const decimals=currencyDecimals(currency);
 if(!/^\d+(\.\d+)?$/.test(value))throw new Error('Enter a positive amount without separators');
 const [whole,fraction='']=value.split('.');
 if(fraction.length>decimals)throw new Error(`This currency allows ${decimals} decimal places`);
 const units=Number(whole+fraction.padEnd(decimals,'0'));
 if(!Number.isSafeInteger(units)||units<=0||units>MAX_COMMISSION_UNITS)throw new Error('Amount is outside the supported range');
 return units;
}
export function formatUnits(units:number,currency:string) {return new Intl.NumberFormat('en',{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:currencyDecimals(currency),maximumFractionDigits:currencyDecimals(currency)}).format(units/10**currencyDecimals(currency));}
export function validateCommission(input:CommissionInput) {
 currencyDecimals(input.currency);
 if(!Number.isSafeInteger(input.total_units)||input.total_units<=0||input.total_units>MAX_COMMISSION_UNITS||input.shares.length<1||input.shares.length>50)throw new Error('Invalid commission plan');
 const seen=new Set<string>();let sum=0;
 for(const share of input.shares){const name=share.recipient.trim().toLowerCase();if(!name||share.recipient.length>200||seen.has(name)||!Number.isSafeInteger(share.units)||share.units<=0||share.units>input.total_units)throw new Error('Use distinct recipients and positive allocation amounts');seen.add(name);sum+=share.units;}
 if(sum!==input.total_units)throw new Error('Allocations must equal the total commission exactly');
}
export function shareBalance(ledger:CommissionLedger,index:number){return ledger.shares[index].units-ledger.receipts.filter(r=>r.share_index===index).reduce((sum,r)=>sum+r.units,0);}
