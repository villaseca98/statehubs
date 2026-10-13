import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/lib/toast';
import { localCrmApi } from '@/lib/crm/localApi';
import { composeApp, STARTER } from '@shared/blueprint/modules.ts';
import AppPage from './AppPage';

vi.mock('@/lib/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));

async function guestApp() {
  const app = await localCrmApi.createApp('');
  const { proposal } = await localCrmApi.propose(app.id, composeApp('crm', 'Mi CRM', STARTER.crm));
  await localCrmApi.apply(proposal.id);
  return app.id;
}

describe('AppPage: change the app with pieces, preview first, undo later', () => {
  beforeEach(() => localStorage.clear());

  it('adds a piece as a proposal, applies it and can go back', async () => {
    const id = await guestApp();
    render(<Toaster><MemoryRouter initialEntries={[`/app/${id}`]}><Routes><Route path="/app/:appId" element={<AppPage />} /></Routes></MemoryRouter></Toaster>);
    await screen.findByRole('heading', { level: 1, name: 'Home' });

    fireEvent.click(screen.getAllByRole('button', { name: /^Piezas/ })[0]);
    const panel = screen.getByRole('dialog', { name: 'Piezas' });
    fireEvent.click(within(panel).getByRole('button', { name: /^Presupuestos/ }));
    await screen.findByText(/Vista previa/);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(within(screen.getAllByRole('navigation', { name: 'Hubs' })[0]).getByRole('button', { name: /Clients/ }));
    expect(within(screen.getAllByRole('navigation', { name: 'Sections' })[0]).getByRole('button', { name: /Presupuestos/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Aplicar/ }));
    await waitFor(async () => expect((await localCrmApi.getApp(id))?.current_version).toBe(2));

    fireEvent.click(screen.getAllByRole('button', { name: /^Historial/ })[0]);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Historial' })).getByRole('button', { name: 'Volver a esta' }));
    await waitFor(async () => expect((await localCrmApi.getApp(id))?.current_version).toBe(3));
    const v = await localCrmApi.versions(id);
    expect(v[0].blueprint.modules).not.toContain('presupuestos');
  }, 60000);

  it('sets up the analysis from the pieces panel, as a proposal', async () => {
    const id = await guestApp();
    render(<Toaster><MemoryRouter initialEntries={[`/app/${id}`]}><Routes><Route path="/app/:appId" element={<AppPage />} /></Routes></MemoryRouter></Toaster>);
    await screen.findByRole('heading', { level: 1, name: 'Home' });
    fireEvent.click(screen.getAllByRole('button', { name: /^Piezas/ })[0]);
    const setup = within(screen.getByRole('dialog', { name: 'Piezas' })).getByRole('region', { name: 'Configurar el análisis' });
    fireEvent.change(within(setup).getByRole('combobox'), { target: { value: '14' } });
    await screen.findByText(/Vista previa/);
    fireEvent.click(screen.getByRole('button', { name: /^Aplicar/ }));
    await waitFor(async () => expect((await localCrmApi.getApp(id))?.current_version).toBe(2));
    const [v] = await localCrmApi.versions(id);
    expect(v.blueprint.views.find((x) => x.type === 'analysis')?.analysis?.staleDays).toBe(14);
  }, 60000);

  it('has a Google Calendar panel that, in guest mode, says it needs an account', async () => {
    const id = await guestApp();
    render(<Toaster><MemoryRouter initialEntries={[`/app/${id}`]}><Routes><Route path="/app/:appId" element={<AppPage />} /></Routes></MemoryRouter></Toaster>);
    await screen.findByRole('heading', { level: 1, name: 'Home' });
    fireEvent.click(screen.getAllByRole('button', { name: /^Google Calendar/ })[0]);
    const panel = screen.getByRole('dialog', { name: 'Google Calendar' });
    await within(panel).findByText(/necesita una cuenta/);
    expect(within(panel).getByText('Sin conectar nada')).toBeTruthy();
  }, 60000);
});
