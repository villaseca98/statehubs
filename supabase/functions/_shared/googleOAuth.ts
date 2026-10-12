// Pieces of the Google sign-in for crm-google that don't touch the network,
// kept apart so they can be tested: the signed `state`, where the person may
// be sent back to, and the consent URL.

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];
export const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthState { u: string; r: string; n: string; e: number }

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// [SECURITY] Constant-time comparison, so the signature can't be guessed byte by byte.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// [SECURITY] The state says who started the connection and where to return,
// signed with HMAC-SHA256 and valid for 10 minutes.
export async function signState(secret: string, userId: string, returnTo: string, now = Date.now()): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const body = b64url(enc.encode(JSON.stringify({ u: userId, r: returnTo, n: nonce, e: now + STATE_TTL_MS } satisfies OAuthState)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

// [SECURITY] Null unless the signature matches and it hasn't expired.
export async function verifyState(secret: string, state: string, now = Date.now()): Promise<OAuthState | null> {
  if (typeof state !== 'string' || state.length > 2048) return null;
  const [body, sig, extra] = state.split('.');
  if (!body || !sig || extra !== undefined) return null;
  let given: Uint8Array;
  try { given = fromB64url(sig); } catch { return null; }
  if (!sameBytes(given, await hmac(secret, body))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as OAuthState;
    if (typeof s.u !== 'string' || typeof s.r !== 'string' || typeof s.e !== 'number' || s.e < now) return null;
    return s;
  } catch { return null; }
}

// The origins StateHubs runs on (APP_URL, comma-separated).
export function allowedOrigins(appUrl: string | undefined): string[] {
  return (appUrl ?? '').split(',').map((s) => s.trim()).filter(Boolean).flatMap((s) => {
    try { return [new URL(s).origin]; } catch { return []; }
  });
}

// [SECURITY] Only back to StateHubs itself (an origin in APP_URL), to an app
// page. Otherwise Google's one-time code could be handed to another site.
export function safeReturnTo(returnTo: unknown, origins: string[]): string | null {
  if (typeof returnTo !== 'string' || returnTo.length > 500) return null;
  let u: URL;
  try { u = new URL(returnTo); } catch { return null; }
  if (!origins.includes(u.origin) || u.username || u.password) return null;
  if (!/^\/app\/[\w-]{1,80}$/.test(u.pathname)) return null;
  return `${u.origin}${u.pathname}`;
}

export function consentUrl(clientId: string, redirectUri: string, state: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    // offline + consent: Google gives a refresh token, so syncing keeps working.
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  if (loginHint) q.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

// Where the person lands after Google: the app page, with the code to finish.
export function backToApp(returnTo: string, params: Record<string, string>): string {
  const u = new URL(returnTo);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// The email inside Google's id_token. It comes straight from Google's token
// endpoint over TLS, so it's only decoded, to show which account is connected.
export function emailFromIdToken(idToken: unknown): string | undefined {
  if (typeof idToken !== 'string') return undefined;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(idToken.split('.')[1] ?? ''))) as { email?: unknown };
    return typeof p.email === 'string' ? p.email.slice(0, 200) : undefined;
  } catch { return undefined; }
}
