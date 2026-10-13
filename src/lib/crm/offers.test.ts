import {beforeEach,expect,it} from 'vitest';
import {localCrmApi as api} from './localApi';
import {validateOffer,type OfferInput} from './offers';
const input:OfferInput={amount:250000,currency:'USD',status:'submitted',note:'Initial terms'};
beforeEach(()=>localStorage.clear());
async function fixture(){const app=await api.createApp('');const c=await api.createRecord(app.id,'contacto_inmo',{nombre:'Buyer'});const p=await api.createRecord(app.id,'inmueble',{direccion:'Home'});const d=await api.createRecord(app.id,'operacion',{titulo:'Negotiation',contacto:c.id,inmueble:p.id});return {app,c,p,d};}
it('persists submitted/countered/accepted history without changing deal stage and deduplicates retries',async()=>{
 const {d}=await fixture();const a=await api.appendOffer(d.id,input,0,'first');expect(await api.appendOffer(d.id,input,0,'first')).toEqual(a);
 await api.appendOffer(d.id,{...input,amount:260000,status:'countered'},1,'second');
 await api.appendOffer(d.id,{...input,amount:260000,status:'accepted'},2,'third');
 const history=await api.offerRevisions(d.id);expect(history.map(r=>r.status)).toEqual(['accepted','countered','submitted']);expect(history[2].amount).toBe(250000);
 expect((await api.recordEvents(d.id)).filter(e=>e.body?.startsWith('Offer revision'))).toHaveLength(3);
 await expect(api.appendOffer(d.id,{...input,status:'countered'},3,'fourth')).rejects.toThrow('transition');
});
it('rejects stale writes and altered retries',async()=>{const {d}=await fixture();await api.appendOffer(d.id,input,0,'first');await expect(api.appendOffer(d.id,{...input,amount:1},0,'first')).rejects.toThrow('Request already used');await expect(api.appendOffer(d.id,{...input,status:'countered'},0,'stale')).rejects.toThrow('Reload');});
it('requires a counteroffer before accepting different terms',async()=>{const {d}=await fixture();await api.appendOffer(d.id,input,0,'first');await expect(api.appendOffer(d.id,{...input,amount:1,status:'accepted'},1,'next')).rejects.toThrow('Counter');});
it('rejects missing, cross-workspace and replaced relationships',async()=>{
 const {d,c}=await fixture();const other=await fixture();await api.patchRecord(d.id,{inmueble:other.p.id});await expect(api.appendOffer(d.id,input,0,'bad')).rejects.toThrow('Link');
 await api.patchRecord(d.id,{inmueble:c.id});await expect(api.appendOffer(d.id,input,0,'bad')).rejects.toThrow('Link');
 const f=await fixture();await api.appendOffer(f.d.id,input,0,'ok');const c2=await api.createRecord(f.app.id,'contacto_inmo',{});await api.patchRecord(f.d.id,{contacto:c2.id});await expect(api.appendOffer(f.d.id,{...input,status:'countered'},1,'changed')).rejects.toThrow('relationships changed');
});
it.each([{amount:0},{amount:Infinity},{currency:'ABC'},{note:'x'.repeat(4001)},{status:'accepted'}])('rejects invalid initial terms %j',patch=>{expect(()=>validateOffer({...input,...patch} as OfferInput)).toThrow();});
