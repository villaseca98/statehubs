/** Remote-owner approval transitions. Caller must enforce server-side membership/RLS. */
export type ApprovalStatus='pending'|'approved'|'rejected';
export interface OwnerApproval { id:string; organizationId:string; assetId:string; ownerContactId:string; requestedBy:string; status:ApprovalStatus; decisionAt?:string; decisionBy?:string; note?:string }
export interface OwnerDecision { organizationId:string; ownerContactId:string; status:'approved'|'rejected'; decidedAt:string; note?:string }
export function decideOwnerApproval(request:OwnerApproval,decision:OwnerDecision):OwnerApproval {
 if(request.organizationId!==decision.organizationId || request.ownerContactId!==decision.ownerContactId) throw new Error('Owner or organization mismatch');
 if(request.status!=='pending') throw new Error('Approval already decided');
 const at=Date.parse(decision.decidedAt);
 if(!Number.isFinite(at)||!/^\d{4}-\d{2}-\d{2}T/.test(decision.decidedAt)) throw new Error('Invalid decision timestamp');
 return {...request,status:decision.status,decisionAt:new Date(at).toISOString(),decisionBy:decision.ownerContactId,note:decision.note?.trim()};
}
