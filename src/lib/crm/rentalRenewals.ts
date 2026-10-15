/** Pure renewal review; no jurisdiction-specific automatic legal extension. */
export interface LeaseReview { id:string; organizationId:string; startsOn:string; endsOn:string; renewalNoticeDays:number; status:'active'|'ended'|'terminated' }
export type RenewalState='not_due'|'review_due'|'expired'|'inactive';
const date=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error('Invalid ISO date');const t=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw new Error('Invalid calendar date');return t};
export function leaseRenewalState(lease:LeaseReview,today:string):RenewalState {
 if(!Number.isSafeInteger(lease.renewalNoticeDays)||lease.renewalNoticeDays<0||lease.renewalNoticeDays>366)throw new Error('Invalid notice period');
 const start=date(lease.startsOn),end=date(lease.endsOn),now=date(today);
 if(end<start)throw new Error('Lease dates out of order');
 if(lease.status!=='active')return 'inactive';
 if(now>end)return 'expired';
 return now>=end-lease.renewalNoticeDays*86400000?'review_due':'not_due';
}
export function leasesRequiringReview(leases:readonly LeaseReview[],organizationId:string,today:string):LeaseReview[] {
 return leases.filter(lease=>lease.organizationId===organizationId&&leaseRenewalState(lease,today)==='review_due');
}
