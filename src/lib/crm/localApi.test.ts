import { beforeEach, describe, expect, it } from 'vitest';
import { localCrmApi as api, isLocalApp } from './localApi';
import { pickTemplate, findModule } from './localAgent';
import { addModule, composeApp, removeModule } from '@shared/blueprint/modules.ts';

describe('guest mode', () => {
  beforeEach(() => localStorage.clear());

  it('picks a template by sector and a piece by name', () => {
    expect(pickTemplate('Tengo una clínica dental').key).toBe('clinica');
    expect(pickTemplate('control de pedidos y almacén').key).toBe('distribucion');
    expect(pickTemplate('algo raro').key).toBe('inmobiliaria');
    expect(findModule('añade facturas')?.key).toBe('facturas');
    expect(findModule('quita el soporte')?.key).toBe('soporte');
    expect(findModule('hola')).toBeUndefined();
  });

  it('creates, applies, adds a piece and undoes, all in the browser', async () => {
    const app = await api.createApp('');
    expect(isLocalApp(app.id)).toBe(true);

    const first = await api.ask(app.id, 'Un CRM para mi inmobiliaria');
    expect(first.proposal?.changes[0].text).toMatch(/Crear la aplicación/);
    expect(await api.apply(first.proposal!.id)).toBe(1);
    const records = await api.records(app.id);
    expect(records.length).toBeGreaterThan(10);
    // Template ids are kept so relations between sample records still work.
    expect(records.some((r) => r.id === 'c1')).toBe(true);

    const piece = await api.ask(app.id, 'añade facturas');
    expect(piece.proposal?.blueprint.modules).toContain('facturas');
    await api.apply(piece.proposal!.id);
    expect((await api.getApp(app.id))?.current_version).toBe(2);

    expect(await api.restore(app.id, 1)).toBe(3);
    const versions = await api.versions(app.id);
    expect(versions[0]).toMatchObject({ version: 3, summary: 'Vuelta a la versión 1' });
    expect(versions[0].blueprint.entities.some((e) => e.key === 'factura')).toBe(false);

    const other = await api.ask(app.id, 'añade un campo de provincia');
    expect(other.proposal).toBeNull();
    expect(other.message.content).toMatch(/modo prueba/);
  });

  it('refuses a stale proposal and edits records', async () => {
    const app = await api.createApp('');
    const p = (await api.ask(app.id, 'clínica')).proposal!;
    await api.apply(p.id);
    const stale = (await api.ask(app.id, 'añade facturas')).proposal!;
    const newer = (await api.ask(app.id, 'añade pedidos')).proposal!;
    await expect(api.apply(stale.id)).rejects.toThrow(/ya no está pendiente/);
    await api.apply(newer.id);

    const r = await api.createRecord(app.id, 'paciente', { nombre: 'Prueba' });
    await api.updateRecord(r.id, { nombre: 'Cambiado' });
    expect((await api.records(app.id)).find((x) => x.id === r.id)?.data).toEqual({ nombre: 'Cambiado' });
    expect(await api.clearSamples(app.id)).toBeGreaterThan(0);
    expect(await api.records(app.id)).toHaveLength(1);
    await api.deleteApp(app.id);
    expect(await api.getApp(app.id)).toBeNull();
  });
});

describe('guest mode: functions as cards', () => {
  beforeEach(() => localStorage.clear());

  it('builds from cards, adds and removes a piece as proposals, and undoes', async () => {
    const app = await api.createApp('');
    const first = await api.propose(app.id, composeApp('erp', 'Taller Ruiz', ['clientes', 'pedidos']));
    expect(first.proposal.summary).toBe('Añadir Clientes, Pedidos');
    expect(await api.apply(first.proposal.id)).toBe(1);
    expect((await api.getApp(app.id))?.name).toBe('Taller Ruiz');
    const records = await api.records(app.id);
    const ids = new Set(records.map((r) => r.id));
    // Sample orders point at sample clients that exist.
    expect(records.filter((r) => r.entity === 'pedido').every((r) => ids.has(String(r.data.cliente)))).toBe(true);

    const current = (await api.versions(app.id))[0].blueprint;
    const more = await api.propose(app.id, addModule(current, 'facturas'));
    expect(more.message.proposal_id).toBe(more.proposal.id);
    expect(more.proposal.changes.some((c) => /Factura/.test(c.text))).toBe(true);
    await api.apply(more.proposal.id);
    expect((await api.records(app.id)).some((r) => r.entity === 'factura')).toBe(true);

    const less = await api.propose(app.id, removeModule((await api.versions(app.id))[0].blueprint, 'pedidos'));
    expect(less.proposal.summary).toBe('Quitar Pedidos');
    await api.apply(less.proposal.id);
    // Taking a piece off hides it; the orders are still there for when it comes back.
    expect((await api.records(app.id)).some((r) => r.entity === 'pedido')).toBe(true);
    expect(await api.restore(app.id, 2)).toBe(4);
    expect((await api.versions(app.id))[0].blueprint.modules).toContain('pedidos');
  });

  it('refuses an invalid blueprint', async () => {
    const app = await api.createApp('');
    await expect(api.propose(app.id, composeApp('crm', 'X', ['panel']))).rejects.toThrow(/no es válida/);
  });

  it('says that syncing Airbnb and Booking needs an account, without inventing bookings', async () => {
    const app = await api.createApp('');
    const res = await api.syncIcal(app.id);
    expect(res).toMatchObject({ nuevas: 0, actualizadas: 0, canceladas: 0, errores: [] });
    expect(res.mensaje).toMatch(/necesita una cuenta/);
    expect(await api.records(app.id)).toEqual([]);
  });
});
