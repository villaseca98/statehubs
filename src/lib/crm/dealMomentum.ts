import type {AppRecord} from '@shared/blueprint/types.ts';
export interface DealMomentum {
 record:AppRecord;stage:string;health:'needs_attention'|'on_track'|'insufficient_data';
 reason:string;nextAction:string;
}
const truth=(v:unknown)=>typeof v==='string'?v.trim():v;
export function analyzeDealMomentum(records:readonly AppRecord[],now:Date):DealMomentum[]{
 const today=now.getTime();
 return records.filter(r=>/^(operacion|oportunidad|deal|deals|opportunity|opportunities|transaction|transactions)$/i.test(r.entity)).map(record=>{
  const d=record.data;
  const stage=String(d.etapa||d.estado||d.fase||d.stage||d.status||d.pipeline_stage||'Unspecified');
  const normalized=stage.toLowerCase();
  if(/cerrad|ganad|perdid|cancel|complet|sold|won|lost/.test(normalized))return null;
  const next=truth(d.proxima_accion||d.siguiente_accion||d.next_action||d.next_step||d.follow_up_action);
  const date=truth(d.fecha_proxima_accion||d.fecha_seguimiento||d.proximo_contacto||d.next_action_date||d.follow_up_date||d.due_date);
  if(typeof date==='string'&&date.length>=10){
   const parsed=Date.parse(date);
   if(Number.isFinite(parsed)&&parsed<new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime())return {record,stage,health:'needs_attention' as const,reason:'The next action date has passed.',nextAction:'Review the overdue next action'};
   if(Number.isFinite(parsed))return {record,stage,health:'on_track' as const,reason:'A dated next action is recorded.',nextAction:typeof next==='string'?next:'Review scheduled follow-up'};
  }
  if(typeof next==='string'&&next)return {record,stage,health:'on_track' as const,reason:'A next action is recorded, but no deadline is available.',nextAction:next};
  return {record,stage,health:'insufficient_data' as const,reason:'No next action or follow-up date is recorded.',nextAction:'Set a clear next action and due date'};
 }).filter((x):x is DealMomentum=>x!==null);
}
