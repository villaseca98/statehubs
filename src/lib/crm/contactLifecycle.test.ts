import { beforeEach, expect, it } from 'vitest';
import { localCrmApi as api } from './localApi';
import { contactStagePatch } from './contactLifecycle';
beforeEach(() => localStorage.clear());
it('persists conversion twice, preserving contact IDs, relations, roles and sample markers', async () => {
 const app = await api.createApp('');
 const person = await api.createRecord(app.id, 'contacto_inmo', { nombre: 'Alex', tipo: 'propietario', notas: 'History' });
 const deal = await api.createRecord(app.id, 'operacion', { contacto: person.id, inmueble: 'property-1' });
 await api.patchRecord(person.id, contactStagePatch('client'));
 await api.patchRecord(person.id, contactStagePatch('client'));
 await api.patchRecord(person.id, { crm_role_comprador: true });
 await api.patchRecord(person.id, contactStagePatch('archived'));
 await api.patchRecord(person.id, { crm_archived: false });
 const records = await api.records(app.id);
 expect(records).toHaveLength(2);
 expect(records.find(r => r.id === person.id)?.data).toMatchObject({ notas: 'History', tipo: 'propietario', crm_lifecycle: 'client', crm_role_comprador: true });
 expect(records.find(r => r.id === deal.id)?.data).toEqual({ contacto: person.id, inmueble: 'property-1' });
});
