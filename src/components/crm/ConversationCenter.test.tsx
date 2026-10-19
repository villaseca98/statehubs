import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { composePack } from '@shared/blueprint/modules';
import type { AppRecord } from '@shared/blueprint/types';
import { ConversationCenter } from './ConversationCenter';
const bp = composePack('ambos', 'Agency');
const home: AppRecord = { id: 'p', entity: 'inmueble', data: { direccion: 'Ocean House' } };
const alex: AppRecord = { id: 'c', entity: 'contacto_inmo', data: { nombre: 'Alex', email: 'alex@example.com' } };
const a: AppRecord = { id: 'a', entity: 'conversacion', data: { usuario: '@alex', nombre: 'Alex', estado: 'cualificado', contacto: 'c', inmueble: 'p', presupuesto: 300000, ultima_actividad: '2026-10-19T22:00',
 transcripcion: '[22:00] @alex: (comentario) INFO\n[22:00] Asistente: Hi! What are you looking for?\n[22:01] @alex: To buy', enlace: 'https://ig.me/m/alex' } };
const b: AppRecord = { id: 'b', entity: 'conversacion', data: { usuario: '@sam', estado: 'agendado', ultima_actividad: '2026-10-18T10:00', transcripcion: '[10:00] Asistente: Booked!' } };
it('lists conversations like a messaging inbox and opens the thread with context', () => {
 const onOpenProperty = vi.fn(), onMatcher = vi.fn();
 render(<ConversationCenter blueprint={bp} records={[home, alex, a, b]} readOnly={false} titleOf={id => ({ p: 'Ocean House', c: 'Alex' } as Record<string, string>)[id]} onOpenRecord={vi.fn()} onOpenProperty={onOpenProperty} onMatcher={onMatcher} />);
 expect(screen.getByLabelText('Needs reply')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: /^Needs reply$/ }));
 expect(screen.queryByText('@sam')).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: /^All$/ }));
 fireEvent.click(screen.getByRole('button', { name: /Alex.*To buy/ }));
 const thread = screen.getByRole('region', { name: 'Alex' });
 expect(within(thread).getByText('Hi! What are you looking for?')).toBeTruthy();
 expect(within(thread).getByText('Automated reply')).toBeTruthy();
 expect(within(thread).getByRole('link', { name: 'Open chat in Instagram' })).toHaveAttribute('href', 'https://ig.me/m/alex');
 expect(within(thread).getByText(/needs the official channel connection/)).toBeTruthy();
 fireEvent.click(screen.getAllByRole('button', { name: /Property of interest: Ocean House/ })[0]);
 expect(onOpenProperty).toHaveBeenCalledWith('p');
 fireEvent.click(screen.getAllByRole('button', { name: 'Find matching properties' })[0]);
 expect(onMatcher).toHaveBeenCalledWith('c');
});
it('says which channels are not connected instead of simulating them', () => {
 render(<ConversationCenter blueprint={bp} records={[a]} readOnly titleOf={() => undefined} onOpenRecord={vi.fn()} onOpenProperty={vi.fn()} onMatcher={vi.fn()} />);
 fireEvent.click(screen.getByText('Channels'));
 expect(screen.getAllByText('Not connected')).toHaveLength(4);
});
