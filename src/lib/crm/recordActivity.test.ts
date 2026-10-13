import { beforeEach, expect, it } from 'vitest';
import { localCrmApi as api } from './localApi';
beforeEach(()=>localStorage.clear());
it('persists a deduplicated activity and records field changes without copying private values', async()=>{
 const app=await api.createApp('');const record=await api.createRecord(app.id,'contacto_inmo',{nombre:'Alex'});
 await api.patchRecord(record.id,{crm_lifecycle:'client',notas:'private text'});
 await api.patchRecord(record.id,{crm_lifecycle:'client'});
 const id=crypto.randomUUID();
 await api.addRecordActivity(record.id,'call','Spoke to owner',id);
 await api.addRecordActivity(record.id,'call','Spoke to owner',id);
 const events=await api.recordEvents(record.id);
 expect(events).toHaveLength(3);
 expect(events.find(e=>e.kind==='changed')).toMatchObject({fields:['crm_lifecycle','notas'],body:null});
 await expect(api.addRecordActivity(record.id,'note','Another payload',id)).rejects.toThrow();
 await expect(api.addRecordActivity(record.id,'note','  ',crypto.randomUUID())).rejects.toThrow();
 await api.deleteRecord(record.id);
 expect(await api.recordEvents(record.id)).toEqual([]);
});
