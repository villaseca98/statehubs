import { beforeEach, expect, it } from 'vitest';
import { localCrmApi as api } from './localApi';
beforeEach(()=>localStorage.clear());
it('persists a unique saved/dismissed pair with audit and preserves preferences',async()=>{
 const app=await api.createApp('');const c=await api.createRecord(app.id,'contacto_inmo',{nombre:'Buyer',tipo_deseado:'piso'});const p=await api.createRecord(app.id,'inmueble',{direccion:'Home'});
 await api.setMatchDecision(c.id,p.id,'saved');await api.setMatchDecision(c.id,p.id,'saved');
 expect(await api.matchDecisions(app.id)).toHaveLength(1);
 expect((await api.recordEvents(c.id)).filter(e=>e.body?.startsWith('Match saved'))).toHaveLength(1);
 await api.setMatchDecision(c.id,p.id,'dismissed');expect((await api.matchDecisions(app.id))[0].status).toBe('dismissed');
 expect((await api.records(app.id)).find(r=>r.id===c.id)?.data.tipo_deseado).toBe('piso');
 await api.deleteRecord(p.id);expect(await api.matchDecisions(app.id)).toEqual([]);
});
it('rejects other workspaces and reversed entity types',async()=>{
 const a=await api.createApp(''),b=await api.createApp('');const c=await api.createRecord(a.id,'contacto_inmo',{});const p=await api.createRecord(b.id,'inmueble',{});
 await expect(api.setMatchDecision(c.id,p.id,'saved')).rejects.toThrow('Match unavailable');
 await expect(api.setMatchDecision(p.id,c.id,'saved')).rejects.toThrow('Match unavailable');
});
