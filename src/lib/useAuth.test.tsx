import { expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
it('stops loading and exposes rejected session requests', async () => {
 const unsubscribe = vi.fn();
 auth.getSession.mockRejectedValue(new Error('Session unavailable'));
 auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
 const hook = renderHook(() => useAuth());
 await waitFor(() => expect(hook.result.current.loading).toBe(false));
 expect(hook.result.current.error).toBe('Session unavailable');
 hook.unmount(); expect(unsubscribe).toHaveBeenCalledOnce();
});
