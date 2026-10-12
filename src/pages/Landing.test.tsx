import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { localCrmApi } from '@/lib/crm/localApi';
import Landing from './Landing';

vi.mock('@/lib/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/components/crm/ScrollHero', () => ({ ScrollHero: () => null }));

function Opened() {
  const { appId } = useParams();
  return <p>Abierta {appId}</p>;
}

describe('Landing: one question, one unified agency app', () => {
  beforeEach(() => localStorage.clear());

  it('offers sales, tourist rentals or both and opens a working app with example data', async () => {
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing />} /><Route path="/app/:appId" element={<Opened />} /></Routes></MemoryRouter>);
    const group = screen.getByRole('group', { name: 'Tipo de agencia' });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/ERP/)).toBeNull();
    // The rest of the web: the Instagram leads, the honest Airbnb/Booking part, the
    // discreet free description and the way to the demo. No "made with AI" pitch.
    expect(screen.getByRole('heading', { name: /mientras duermes/ })).toBeTruthy();
    expect(screen.getByLabelText('Descríbenos tu agencia')).toBeTruthy();
    expect(screen.queryByText(/\bIA\b/)).toBeNull();
    expect(screen.getByRole('heading', { name: /sin humo/ })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /demo/i }).some((a) => a.getAttribute('href') === '/demo')).toBe(true);
    fireEvent.click(within(group).getByRole('button', { name: /^Alquiler turístico/ }));
    await waitFor(() => expect(screen.getByText(/Abierta local-/)).toBeTruthy());
    const [app] = await localCrmApi.listApps();
    const bp = (await localCrmApi.versions(app.id))[0].blueprint;
    expect(bp.views[0].type).toBe('ops');
    expect(bp.views.some((v: { type: string }) => v.type === 'timeline')).toBe(true);
    const records = await localCrmApi.records(app.id);
    expect(records.filter((r) => r.entity === 'reserva').length).toBeGreaterThan(5);
    expect(records.every((r) => r.is_sample)).toBe(true);
  });
});
