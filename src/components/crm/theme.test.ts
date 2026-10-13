import { afterEach, expect, it, vi } from 'vitest';
import { initialMode } from './theme';
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
it('defaults to white/red even on a dark-mode device', () => {
 localStorage.clear();
 vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
 expect(initialMode()).toBe('light');
});
it('preserves an explicitly chosen dark mode', () => {
 localStorage.setItem('statehubs.tema', 'dark');
 expect(initialMode()).toBe('dark');
});
