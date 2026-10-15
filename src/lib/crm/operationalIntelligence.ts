import type { TodayItem } from './today';
import type { AppRecord } from '@shared/blueprint/types.ts';

/** Transparent, read-only prioritization of work already present in the CRM.
 * No synthetic conversion probabilities, automatic messages or hidden writes.
 */
export type NextAction = 'follow_up'|'confirm_appointment'|'review_deadline';
export interface IntelligenceAction {
 id:string; record:AppRecord; title:string; reason:string;
 priority:'critical'|'high'|'normal'; score:number;
 action:NextAction; explanation:string;
}
export function prioritizeWork(items:readonly TodayItem[]):IntelligenceAction[] {
 const byRecord=new Map<string,IntelligenceAction>();
 for(const item of items){
  const isOverdue=item.bucket==='atrasado';
  const isAppointment=/visita|viewing|cita|appointment|reuni[oó]n/i.test(item.reason+' '+item.entity.key);
  const score=(isOverdue?90:item.bucket==='hoy'?65:35)+(isAppointment?5:0);
  const action:NextAction=isAppointment?'confirm_appointment':isOverdue?'follow_up':'review_deadline';
  const priority=score>=90?'critical':score>=65?'high':'normal';
  const explanation=isOverdue?'The scheduled date has passed and the record remains open.':item.bucket==='hoy'?'This action is due today.':'This action is coming up soon.';
  const next={id:item.id,record:item.record,title:item.title,reason:item.reason,score,priority,action,explanation};
  const current=byRecord.get(item.record.id);
  if(!current||current.score<score)byRecord.set(item.record.id,next);
 }
 return [...byRecord.values()].sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export interface WorkflowSuggestion {id:string;title:string;why:string;trigger:string;nextStep:string;recordId:string;requiresConfirmation:true}
export function suggestWorkflows(actions:readonly IntelligenceAction[]):WorkflowSuggestion[]{
 return actions.slice(0,8).map(a=>({
  id:'review:'+a.record.id,title:a.action==='confirm_appointment'?'Confirm the appointment':a.action==='follow_up'?'Follow up with the contact':'Review the upcoming deadline',
  why:a.explanation,trigger:a.reason,nextStep:'Open the linked record and review the next action before contacting anyone.',
  recordId:a.record.id,requiresConfirmation:true as const
 }));
}
