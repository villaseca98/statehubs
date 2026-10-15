import type { ServiceWorkOrder, ServiceKind } from './realEstateOS';

export interface TurnoverInput {
 organizationId:string; assetId:string; bookingId:string;
 checkOutAt:string; nextCheckInAt:string; cleaningMinutes:number;
 requestedBy:string;
}
export interface PlannedWorkOrder extends ServiceWorkOrder {
 sourceBookingId:string; suggestedStartAt:string; notes:string;
}
/**
 * Pure planning only: no dispatch, availability claims, or automatic charges.
 * Real assignments must verify provider capacity, property access and permissions.
 */
export function planTurnover(input:TurnoverInput):{orders:PlannedWorkOrder[];warnings:string[]} {
 const checkout=new Date(input.checkOutAt).getTime();
 const checkin=new Date(input.nextCheckInAt).getTime();
 const warnings:string[]=[];
 if(!Number.isFinite(checkout)||!Number.isFinite(checkin)||checkin<=checkout)
  return {orders:[],warnings:['Check-out and check-in must be valid, increasing timestamps.']};
 if(!Number.isFinite(input.cleaningMinutes)||input.cleaningMinutes<=0)
  return {orders:[],warnings:['Cleaning duration must be greater than zero.']};
 if(!input.organizationId||!input.assetId||!input.bookingId||!input.requestedBy)
  return {orders:[],warnings:['Organization, asset, booking and requester are required.']};
 const gap=(checkin-checkout)/60000;
 if(gap<input.cleaningMinutes)warnings.push('Turnover window is shorter than the required cleaning time.');
 const steps:{kind:ServiceKind;offset:number;duration:number;notes:string}[]=[
  {kind:'check_out',offset:0,duration:0,notes:'Confirm departure and access return.'},
  {kind:'cleaning',offset:0,duration:input.cleaningMinutes,notes:'Clean property and provide completion evidence.'},
  {kind:'inspection',offset:input.cleaningMinutes,duration:0,notes:'Inspect condition and flag unresolved issues.'},
  {kind:'check_in',offset:gap,duration:0,notes:'Coordinate guest access after property readiness is verified.'},
 ];
 return {orders:steps.map((step,index)=>{
  const due=new Date(checkout+(step.offset+step.duration)*60000).toISOString();
  const start=new Date(checkout+step.offset*60000).toISOString();
  return {id:`turnover:${input.bookingId}:${index}`,organizationId:input.organizationId,
   assetId:input.assetId,service:step.kind,requestedBy:input.requestedBy,
   priority:'routine',status:'draft',dueAt:due,sourceBookingId:input.bookingId,
   suggestedStartAt:start,notes:step.notes};
 }),warnings};
}
