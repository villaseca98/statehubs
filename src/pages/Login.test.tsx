import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ hasServer: true, supabase: { auth } }));
vi.mock('@/lib/useAuth', () => ({ useAuth: () => ({ user: null, loading: false, error: null }) }));
function show(path: string) { render(<MemoryRouter initialEntries={[path]}><Login /></MemoryRouter>); }
function submit() {
 fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'owner@example.com' } });
 fireEvent.submit(screen.getByLabelText('Work email').closest('form')!);
}
describe('account access', () => {
 beforeEach(() => { vi.clearAllMocks(); auth.signInWithOtp.mockResolvedValue({ error: null }); });
 it('creates users only through the registration flow', async () => {
  show('/register'); submit();
  await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalled());
  expect(auth.signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(true);
  expect(await screen.findByRole('status')).toHaveTextContent('owner@example.com');
 });
 it('signs in without creating users and prevents external return URLs', async () => {
  show('/login?next=//example.com'); submit();
  await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalled());
  expect(auth.signInWithOtp.mock.calls[0][0].options).toEqual({ shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/workspace` });
 });
 it('shows transport errors and permits retry', async () => {
  auth.signInWithOtp.mockRejectedValueOnce(new Error('Connection unavailable'));
  show('/login'); submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  submit();
  expect(await screen.findByRole('status')).toHaveTextContent('owner@example.com');
 });
});
