import { describe, expect, it } from 'vitest';
import { allowedOrigins, backToApp, consentUrl, emailFromIdToken, safeReturnTo, signState, STATE_TTL_MS, verifyState } from './googleOAuth.ts';

const SECRET = 'x'.repeat(40);

describe('Google sign-in for crm-google', () => {
  it('signs the state and only accepts it untouched and in time', async () => {
    const now = Date.UTC(2026, 9, 12, 10);
    const state = await signState(SECRET, 'user-1', 'https://statehubs.app/app/abc', now);
    expect(await verifyState(SECRET, state, now + 1000)).toMatchObject({ u: 'user-1', r: 'https://statehubs.app/app/abc' });
    expect(await verifyState(SECRET, state, now + STATE_TTL_MS + 1)).toBeNull();
    expect(await verifyState('y'.repeat(40), state, now)).toBeNull();
    const [body, sig] = state.split('.');
    const forged = btoa(JSON.stringify({ u: 'attacker', r: 'https://evil.example/app/x', n: 'n', e: now + 60_000 })).replace(/=+$/, '');
    expect(await verifyState(SECRET, `${forged}.${sig}`, now)).toBeNull();
    expect(await verifyState(SECRET, `${body}.${sig}.x`, now)).toBeNull();
    expect(await verifyState(SECRET, 'nada', now)).toBeNull();
    expect(await signState(SECRET, 'user-1', 'https://statehubs.app/app/abc', now)).not.toBe(state);
  });

  it('only returns to StateHubs app pages on the allowed origins', () => {
    const origins = allowedOrigins('https://statehubs.app, http://localhost:8080/ , no es url');
    expect(origins).toEqual(['https://statehubs.app', 'http://localhost:8080']);
    expect(safeReturnTo('https://statehubs.app/app/3f1c-22?x=1#y', origins)).toBe('https://statehubs.app/app/3f1c-22');
    expect(safeReturnTo('http://localhost:8080/app/abc', origins)).toBe('http://localhost:8080/app/abc');
    expect(safeReturnTo('https://evil.example/app/abc', origins)).toBeNull();
    expect(safeReturnTo('https://statehubs.app.evil.example/app/abc', origins)).toBeNull();
    expect(safeReturnTo('https://user:pw@statehubs.app/app/abc', origins)).toBeNull();
    expect(safeReturnTo('https://statehubs.app/otra', origins)).toBeNull();
    expect(safeReturnTo('https://statehubs.app/app/../x', origins)).toBeNull();
    expect(safeReturnTo(42, origins)).toBeNull();
    expect(safeReturnTo('https://statehubs.app/app/abc', [])).toBeNull();
  });

  it('asks Google for offline access to events and free/busy only', () => {
    const u = new URL(consentUrl('cid', 'https://x.supabase.co/functions/v1/crm-google', 'st', 'ana@example.com'));
    expect(u.origin).toBe('https://accounts.google.com');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.supabase.co/functions/v1/crm-google');
    expect(u.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(u.searchParams.get('scope')).not.toContain('auth/calendar ');
    expect(u.searchParams.get('login_hint')).toBe('ana@example.com');
    expect(backToApp('https://statehubs.app/app/abc', { google_code: 'c/1', google_state: 's' })).toBe('https://statehubs.app/app/abc?google_code=c%2F1&google_state=s');
  });

  it('reads the email of the id_token', () => {
    const payload = btoa(JSON.stringify({ email: 'ana@example.com' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(emailFromIdToken(`h.${payload}.s`)).toBe('ana@example.com');
    expect(emailFromIdToken('basura')).toBeUndefined();
    expect(emailFromIdToken(undefined)).toBeUndefined();
  });
});
