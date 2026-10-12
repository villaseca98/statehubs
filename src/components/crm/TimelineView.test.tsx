import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { composePack } from '@shared/blueprint/modules.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { TimelineView } from './TimelineView';
import { makeTitleLookup } from './theme';

const bp = composePack('turistico', 'Pisos');
const view = bp.views.find((v) => v.type === 'timeline')!;
const now = new Date(2026, 9, 14); // miércoles 14 oct 2026
const records: AppRecord[] = [
  { id: 'p1', entity: 'inmueble', data: { direccion: 'Loft Carmen', operacion: 'turistico' } },
  { id: 'p2', entity: 'inmueble', data: { direccion: 'Ático Ruzafa', operacion: 'turistico' } },
  { id: 'p3', entity: 'inmueble', data: { direccion: 'Piso en venta', operacion: 'venta' } },
  { id: 'r1', entity: 'reserva', data: { huesped: 'Ana Pérez', alojamiento: 'p1', canal: 'booking', entrada: '2026-10-12', salida: '2026-10-15', estado: 'confirmada', importe: 300, comision: 45, gastos: 35 } },
  { id: 'r2', entity: 'reserva', data: { huesped: 'Sven Larsen', alojamiento: 'p1', canal: 'airbnb', entrada: '2026-10-14', salida: '2026-10-18', estado: 'confirmada', importe: 420, comision: 63, gastos: 35 } },
  { id: 'r3', entity: 'reserva', data: { huesped: 'Bloqueo propietario', alojamiento: 'p2', canal: 'otro', entrada: '2026-10-20', salida: '2026-10-23', estado: 'bloqueo' } },
  { id: 'r4', entity: 'reserva', data: { huesped: 'Marta Gil', alojamiento: 'p2', canal: 'booking', entrada: '2026-10-05', salida: '2026-10-08', estado: 'cancelada' } },
];

function setup(extra: Partial<Parameters<typeof TimelineView>[0]> = {}) {
  const onOpen = vi.fn();
  const onCreate = vi.fn();
  render(<TimelineView blueprint={bp} view={view} records={records} dark={false} titleOf={makeTitleLookup(bp.entities, records)} now={now}
    onOpen={onOpen} onCreate={onCreate} onUpdate={() => undefined} {...extra} />);
  return { onOpen, onCreate };
}

describe('TimelineView', () => {
  it('shows one row per holiday let, with bars per booking and overlaps flagged', () => {
    const { onOpen } = setup();
    expect(screen.getByText('octubre de 2026')).toBeTruthy();
    const cal = screen.getByRole('region', { name: 'Calendario de reservas' });
    expect(within(cal).getByText('Loft Carmen')).toBeTruthy();
    expect(within(cal).queryByText('Piso en venta')).toBeNull();
    expect(within(cal).getAllByText('Se solapan')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toMatch(/2 reservas se solapan/);
    const bar = screen.getByRole('button', { name: /Sven Larsen, 4 noches.*Se solapa/ });
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledWith(records[4]);
    expect(screen.getByRole('button', { name: /Bloqueo · Bloqueo propietario, 3 noches/ })).toBeTruthy();
    // Cancelled ones only on request.
    expect(screen.queryByRole('button', { name: /Marta Gil/ })).toBeNull();
    fireEvent.click(screen.getByLabelText('Ver canceladas'));
    expect(screen.getByRole('button', { name: /Marta Gil.*cancelada/ })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Ver todos'));
    expect(within(cal).getByText('Piso en venta')).toBeTruthy();
  });

  it('works out occupancy and net per row for the visible period', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Semana' }));
    expect(screen.getByText(/12 oct.*18 oct/)).toBeTruthy();
    // Loft Carmen: 3 + 4 nights of 7 (they overlap), net 220 + 322.
    expect(screen.getByText('100 % · 542 €')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/19 oct.*25 oct/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Día' }));
    expect(screen.getByText(/miércoles, 14 de octubre de 2026/)).toBeTruthy();
  });

  it('creates a booking on an empty day with the property and dates filled in', () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva en Ático Ruzafa el 26 oct/ }));
    expect(onCreate).toHaveBeenCalledWith('reserva', { alojamiento: 'p2', entrada: '2026-10-26', salida: '2026-10-27' });
  });

  it('offers the calendar sync only when there is one, and says what it did', async () => {
    setup();
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    document.body.innerHTML = '';
    setup({ onSync: async () => '2 nuevas, 0 actualizadas, 0 canceladas.' });
    expect(screen.getByText(/Precios y mensajes no se sincronizan/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar Airbnb y Booking/ }));
    expect((await screen.findByRole('status')).textContent).toBe('2 nuevas, 0 actualizadas, 0 canceladas.');
  });
});
