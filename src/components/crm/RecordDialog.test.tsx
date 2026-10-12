import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecordDialog } from './RecordDialog';

afterEach(cleanup);
describe('RecordDialog accessibility', () => {
  it('exposes an accessible modal and focuses close action', () => {
    render(<RecordDialog title="Detalle de inmueble" onClose={() => {}}><button aria-label="Cerrar">Cerrar</button><input aria-label="Precio" /></RecordDialog>);
    const modal = screen.getByRole('dialog', { name: 'Detalle de inmueble' });
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });
  it('closes on Escape and returns focus to the opener', () => {
    const close = vi.fn();
    render(<><button>Ver inmueble</button><RecordDialog title="Detalle" onClose={close}><button aria-label="Cerrar">Cerrar</button></RecordDialog></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('closes on backdrop, not when interacting inside', () => {
    const close = vi.fn();
    render(<RecordDialog title="Detalle" onClose={close}><button>Editar</button></RecordDialog>);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Editar' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(close).toHaveBeenCalledOnce();
  });
});
