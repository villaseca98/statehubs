import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SHButton, SHStatus, SHSurface, tokens } from './index';
describe('StateHubs design system', () => {
 it('defines the red and white brand tokens', () => { expect(tokens.color.forest).toBe('#b41636'); expect(tokens.color.ivory).toBe('#f8f8fa'); });
 it('renders accessible buttons and handles click', () => { const click=vi.fn(); render(<SHButton onClick={click}>Guardar</SHButton>); fireEvent.click(screen.getByRole('button',{name:'Guardar'})); expect(click).toHaveBeenCalledOnce(); expect(screen.getByRole('button')).toHaveAttribute('type','button'); });
 it('disables loading actions', () => { render(<SHButton loading>Crear</SHButton>); expect(screen.getByRole('button',{name:'Crear'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Crear'})).toHaveAttribute('aria-busy','true'); });
 it('renders semantic surfaces and statuses', () => { render(<SHSurface as="section" aria-label="Panel"><SHStatus tone="success">Activo</SHStatus></SHSurface>); expect(screen.getByRole('region',{name:'Panel'})).toBeInTheDocument(); expect(screen.getByText('Activo')).toBeInTheDocument(); });
});
