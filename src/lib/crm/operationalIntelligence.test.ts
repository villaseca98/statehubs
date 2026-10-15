import {describe,expect,it} from 'vitest';
import {prioritizeWork,suggestWorkflows} from './operationalIntelligence';
import type {TodayItem} from './today';
const record={id:'lead-1',entity:'lead',data:{nombre:'Jane'}};
const entity={key:'lead',label:'Lead'};
const item=(id:string,bucket:'atrasado'|'hoy'|'proximo',reason:string,recordId='lead-1')=>({id,bucket,reason,title:'Jane',record:{...record,id:recordId},entity} as TodayItem);
describe('operational intelligence',()=>{
 it('prioritizes overdue work and avoids duplicate actions for the same record',()=>{
  const result=prioritizeWork([item('a','proximo','Call next week'),item('b','atrasado','Follow-up missed'),item('c','hoy','Viewing today','visit-1')]);
  expect(result.map(x=>x.record.id)).toEqual(['lead-1','visit-1']);
  expect(result[0].priority).toBe('critical');
 });
 it('offers supervised next steps rather than sending messages',()=>{
  const suggestions=suggestWorkflows(prioritizeWork([item('a','atrasado','Follow-up missed')]));
  expect(suggestions[0].requiresConfirmation).toBe(true);
  expect(suggestions[0].recordId).toBe('lead-1');
 });
 it('returns an empty queue when there is no work',()=>{
  expect(prioritizeWork([])).toEqual([]);
  expect(suggestWorkflows([])).toEqual([]);
 });
});
