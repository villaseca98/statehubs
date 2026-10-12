import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { composePack } from '@shared/blueprint/modules.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { buildSlots } from '@shared/blueprint/slots.ts';
import { localCrmApi, GOOGLE_NEEDS_ACCOUNT } from '@/lib/crm/localApi';
import { RecordCalendar } from './RecordCalendar';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';
import { GoogleCalendarContext } from './googleCalendarContext';

const bp = composePack('ambos', 'Inmobiliaria (prueba)');
const visita: AppRecord = { id: 'v1', entity: 'cita_inmo', data: { titulo: 'Visita ático', cuando: '2026-10-15T17:00' } };

describe('RecordCalendar', () => {
  it('without an account: the Google link and the .ics download, nothing else', () => {
    render(<RecordCalendar blueprint={bp} record={visita} records={[]} />);
    const link = screen.getByRole('link', { name: /Añadir a Google Calendar/ });
    expect(link.getAttribute('href')).toContain('calendar.google.com/calendar/render?action=TEMPLATE');
    expect(screen.getByRole('button', { name: /Descargar .ics/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Guardar en mi Google Calendar/ })).toBeNull();
  });

  it('shows nothing for a record without a date', () => {
    const { container } = render(<RecordCalendar blueprint={bp} record={{ id: 'x', entity: 'cita_inmo', data: { titulo: 'Sin fecha' } }} records={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('downloads the .ics', () => {
    const create = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<RecordCalendar blueprint={bp} record={visita} records={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar .ics/ }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('with Google connected, saves it and links to the event', async () => {
    const push = vi.fn(async () => ({ estado: 'creado' as const, enlace: 'https://www.google.com/calendar/event?eid=abc' }));
    render(<GoogleCalendarContext.Provider value={{ connected: true, busy: [], push }}><RecordCalendar blueprint={bp} record={visita} records={[]} /></GoogleCalendarContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: /Guardar en mi Google Calendar/ }));
    await screen.findByText(/Guardada en tu Google Calendar/);
    expect(push).toHaveBeenCalledWith(visita);
    expect(screen.getByRole('link', { name: /Abrir/ }).getAttribute('href')).toBe('https://www.google.com/calendar/event?eid=abc');
  });

  it('says what went wrong when Google refuses', async () => {
    const push = vi.fn(async () => { throw new Error('Google ha retirado el permiso. Vuelve a conectar tu calendario.'); });
    render(<GoogleCalendarContext.Provider value={{ connected: true, busy: [], push }}><RecordCalendar blueprint={bp} record={visita} records={[]} /></GoogleCalendarContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: /Guardar en mi Google Calendar/ }));
    await screen.findByText(/retirado el permiso/);
  });
});

describe('GoogleCalendarPanel', () => {
  const noop = () => undefined;
  it('in guest mode explains it needs an account', () => {
    render(<GoogleCalendarPanel status={{ available: false, configured: false, connected: false, mensaje: GOOGLE_NEEDS_ACCOUNT }} working={false} busyCount={0} onConnect={noop} onDisconnect={noop} />);
    expect(screen.getByText(/necesita una cuenta/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Conectar/ })).toBeNull();
  });

  it('says plainly when the server has no Google secrets, and offers no fake button', () => {
    render(<GoogleCalendarPanel status={{ available: true, configured: false, connected: false, mensaje: 'Faltan: GOOGLE_CLIENT_ID.' }} working={false} busyCount={0} onConnect={noop} onDisconnect={noop} />);
    expect(screen.getByRole('alert').textContent).toContain('Falta configurar Google en el servidor');
    expect(screen.queryByRole('button', { name: /Conectar/ })).toBeNull();
  });

  it('connects and disconnects', () => {
    const onConnect = vi.fn();
    const { rerender } = render(<GoogleCalendarPanel status={{ available: true, configured: true, connected: false }} working={false} busyCount={0} onConnect={onConnect} onDisconnect={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Conectar Google Calendar/ }));
    expect(onConnect).toHaveBeenCalledOnce();
    const onDisconnect = vi.fn();
    rerender(<GoogleCalendarPanel status={{ available: true, configured: true, connected: true, email: 'ana@example.com' }} working={false} busyCount={3} onConnect={noop} onDisconnect={onDisconnect} />);
    expect(screen.getByText(/Conectado como ana@example.com/)).toBeTruthy();
    expect(screen.getByText(/3 ratos ocupados/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});

describe('guest mode and Google', () => {
  it('localApi answers that it needs an account, and has no busy hours', async () => {
    expect(await localCrmApi.googleStatus()).toMatchObject({ available: false, connected: false });
    await expect(localCrmApi.googleConnect('x')).rejects.toThrow(/necesita una cuenta/);
    await expect(localCrmApi.googlePush('a', 'b')).rejects.toThrow(/necesita una cuenta/);
    expect(await localCrmApi.googleBusy('a', 'b')).toEqual([]);
  });

  it('busy hours from Google are not offered when booking', () => {
    const days = buildSlots({ days: [1, 2, 3, 4, 5], from: '09:00', to: '12:00', slotMinutes: 60 }, [], new Date(2026, 9, 12, 8), 1, [{ from: '2026-10-12T10:00', to: '2026-10-12T11:00' }]);
    expect(days[0].slots.filter((s) => s.google).map((s) => s.time)).toEqual(['10:00']);
  });
});
