/** Read-only SLA status calculator; no notifications, assignments or authorization. */
export interface ManagementTask { id:string; organizationId:string; dueAt:string; completedAt?:string|null; priority:'routine'|'high'|'emergency' }
export type SlaState='open'|'overdue'|'completed_on_time'|'completed_late';
export function taskSlaState(task:ManagementTask,now:string):SlaState {
 const due=Date.parse(task.dueAt), current=Date.parse(now),completed=task.completedAt?Date.parse(task.completedAt):null;
 if(!Number.isFinite(due)||!Number.isFinite(current)||(completed!==null&&!Number.isFinite(completed))) throw new Error('Invalid timestamp');
 if(completed!==null)return completed<=due?'completed_on_time':'completed_late';
 return current>due?'overdue':'open';
}
export function summarizeManagementTasks(tasks:readonly ManagementTask[],organizationId:string,now:string){
 const own=tasks.filter(task=>task.organizationId===organizationId);
 const summary={open:0,overdue:0,completed_on_time:0,completed_late:0};
 for(const task of own) summary[taskSlaState(task,now)]++;
 return summary;
}
