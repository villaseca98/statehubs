/** Explicit, permission-aware CRM reactivation candidates; never sends communications. */
export interface ReactivationLead {
 id:string; organizationId:string; consentToContact:boolean; archived?:boolean;
 lastMeaningfulContactAt?:string|null; createdAt:string; qualification:'qualified'|'unqualified'|'unknown';
}
export interface ReactivationCandidate { leadId:string; dormantDays:number; reason:string }
export function dormantReactivationCandidates(leads:readonly ReactivationLead[],organizationId:string,now:string,minDays=30):ReactivationCandidate[] {
 const current=Date.parse(now);
 if(!Number.isFinite(current)||!Number.isSafeInteger(minDays)||minDays<1)throw new Error('Invalid reactivation window');
 const output:ReactivationCandidate[]=[];
 const seen=new Set<string>();
 for(const lead of leads){
  if(lead.organizationId!==organizationId||!lead.consentToContact||lead.archived||lead.qualification!=='qualified')continue;
  if(!lead.id.trim()||seen.has(lead.id))continue;
  seen.add(lead.id);
  const at=Date.parse(lead.lastMeaningfulContactAt||lead.createdAt);
  if(!Number.isFinite(at)||at>current)continue;
  const days=Math.floor((current-at)/86400000);
  if(days>=minDays)output.push({leadId:lead.id,dormantDays:days,reason:'Qualified contact with permission and no meaningful contact within the review window'});
 }
 return output.sort((a,b)=>b.dormantDays-a.dormantDays||a.leadId.localeCompare(b.leadId));
}
