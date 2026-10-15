import {describe,it,expect} from 'vitest';
import {taskSlaState,summarizeManagementTasks} from './propertyManagementSla';
describe('property management SLA',()=>{
 it('separates overdue, late completion and other organizations',()=>{
  const tasks=[
   {id:'1',organizationId:'a',priority:'high' as const,dueAt:'2027-01-01T10:00:00Z'},
   {id:'2',organizationId:'a',priority:'routine' as const,dueAt:'2027-01-01T10:00:00Z',completedAt:'2027-01-01T11:00:00Z'},
   {id:'3',organizationId:'b',priority:'emergency' as const,dueAt:'2027-01-01T10:00:00Z'}
  ];
  expect(summarizeManagementTasks(tasks,'a','2027-01-01T12:00:00Z')).toEqual({open:0,overdue:1,completed_on_time:0,completed_late:1});
  expect(taskSlaState({...tasks[0],completedAt:'2027-01-01T09:00:00Z'},'2027-01-01T12:00:00Z')).toBe('completed_on_time');
 });
});
