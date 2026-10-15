import {beforeEach,describe,expect,it} from 'vitest';
import {localCrmApi} from './localApi';

describe('Autopilot approval lifecycle in local demo',()=>{
 beforeEach(()=>localStorage.clear());
 it('persists proposals, prevents duplicates and enforces review transitions',async()=>{
  const app=await localCrmApi.createApp('local');
  const record=await localCrmApi.createRecord(app.id,'lead',{nombre:'Test buyer'});
  const proposal=await localCrmApi.proposeAutomation(app.id,'local',record.id,'follow_up','Call buyer','Due today');
  expect((await localCrmApi.automationApprovals(app.id))[0].status).toBe('pending');
  await expect(localCrmApi.proposeAutomation(app.id,'local',record.id,'follow_up','Call buyer','Due today')).rejects.toThrow('pending proposal');
  const approved=await localCrmApi.decideAutomation(proposal.id,'approved');
  expect(approved.status).toBe('approved');
  await expect(localCrmApi.decideAutomation(proposal.id,'dismissed')).rejects.toThrow('Invalid approval transition');
  await expect(localCrmApi.decideAutomation(proposal.id,'completed')).rejects.toThrow('Missing CRM activity evidence');
  await localCrmApi.addRecordActivity(record.id,'note','Autopilot approved action: Call buyer. Due today',proposal.id);
  expect((await localCrmApi.decideAutomation(proposal.id,'completed')).status).toBe('completed');
  expect((await localCrmApi.automationApprovalEvents(app.id)).map(e=>e.new_status)).toEqual(['completed','approved']);
 });
 it('logs a completed action only once when retried',async()=>{
  const app=await localCrmApi.createApp('local');
  const record=await localCrmApi.createRecord(app.id,'lead',{nombre:'Buyer'});
  const proposal=await localCrmApi.proposeAutomation(app.id,'local',record.id,'follow_up','Call buyer','Next action');
  await localCrmApi.decideAutomation(proposal.id,'approved');
  const first=await localCrmApi.addRecordActivity(record.id,'note','Autopilot approved action: Call buyer. Next action',proposal.id);
  const retry=await localCrmApi.addRecordActivity(record.id,'note','Autopilot approved action: Call buyer. Next action',proposal.id);
  expect(retry.id).toBe(first.id);
  expect((await localCrmApi.recordEvents(record.id)).filter(event=>event.id===proposal.id)).toHaveLength(1);
  await localCrmApi.decideAutomation(proposal.id,'completed');
  expect((await localCrmApi.automationApprovalEvents(app.id)).map(event=>event.new_status)).toEqual(['completed','approved']);
 });
 it('rejects proposals for records outside the workspace',async()=>{
  const app=await localCrmApi.createApp('local');
  await expect(localCrmApi.proposeAutomation(app.id,'local','missing','follow_up','Call','Reason')).rejects.toThrow('Record not found');
 });
});
