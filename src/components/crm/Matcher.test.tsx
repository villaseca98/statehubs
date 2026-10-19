import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { composePack } from '@shared/blueprint/modules';
import { localCrmApi } from '@/lib/crm/localApi';
import { Matcher } from './Matcher';
const bp = composePack('ambos', 'Agency');
beforeEach(() => localStorage.clear());
async function setup() {
 const app = await localCrmApi.createApp('');
 const home = await localCrmApi.createRecord(app.id, 'inmueble', { direccion: 'Ocean House', operacion: 'venta', estado: 'disponible', precio: 250000, moneda: 'EUR', zona: 'Ruzafa' });
 const ana = await localCrmApi.createRecord(app.id, 'contacto_inmo', { nombre: 'Ana', tipo: 'comprador', presupuesto: 300000, moneda: 'EUR', zonas: 'Ruzafa' });
 const ben = await localCrmApi.createRecord(app.id, 'contacto_inmo', { nombre: 'Ben', tipo: 'comprador', presupuesto: 260000, moneda: 'EUR' });
 const far = await localCrmApi.createRecord(app.id, 'contacto_inmo', { nombre: 'Too low', tipo: 'comprador', presupuesto: 100000, moneda: 'EUR' });
 return { app, home, records: [home, ana, ben, far] };
}
it('reviews compatible candidates one by one and persists decisions', async () => {
 const { app, home, records } = await setup();
 render(<Matcher source={home} records={records} blueprint={bp} appId={app.id} readOnly={false} onOpen={vi.fn()} onClose={vi.fn()} />);
 const first = (await screen.findByRole('article')).getAttribute('aria-label')!;
 expect(['Ana', 'Ben']).toContain(first);
 expect(screen.queryByRole('heading', { name: 'Too low' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Compatible' }));
 await waitFor(() => expect(screen.queryByRole('heading', { name: first })).toBeNull());
 const second = first === 'Ana' ? 'Ben' : 'Ana';
 expect(await screen.findByRole('heading', { name: second })).toBeTruthy();
 fireEvent.keyDown(window, { key: 'ArrowLeft' });
 await screen.findByText('No candidates left to review.');
 const byName = (n: string) => records.find(r => r.data.nombre === n)!.id;
 const decisions = await localCrmApi.matchDecisions(app.id);
 expect(Object.fromEntries(decisions.map(d => [d.contact_id, d.status]))).toEqual({ [byName(first)]: 'saved', [byName(second)]: 'dismissed' });
 fireEvent.click(screen.getByRole('button', { name: /^Compatible 1/ }));
 expect(screen.getByRole('heading', { name: first })).toBeTruthy();
});
it('works the other way round from a contact with the same engine', async () => {
 const { app, records } = await setup();
 render(<Matcher source={records[1]} records={records} blueprint={bp} appId={app.id} readOnly={false} onOpen={vi.fn()} onClose={vi.fn()} />);
 expect(await screen.findByRole('heading', { name: 'Ocean House' })).toBeTruthy();
 expect(screen.getByText('Properties for this contact')).toBeTruthy();
});
it('lets viewers review but not decide', async () => {
 const { app, home, records } = await setup();
 render(<Matcher source={home} records={records} blueprint={bp} appId={app.id} readOnly onOpen={vi.fn()} onClose={vi.fn()} />);
 await screen.findByRole('article');
 expect(screen.getByRole('button', { name: 'Compatible' })).toBeDisabled();
 expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
});
