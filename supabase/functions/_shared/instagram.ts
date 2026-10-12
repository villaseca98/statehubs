// Instagram (API with Instagram Login) helpers for crm-instagram: signatures,
// the signed OAuth state, reading webhook payloads and building messages.
// Pure and runtime-agnostic (Web Crypto), so they are tested with vitest.

export const GRAPH = 'https://graph.instagram.com/v23.0';
export const SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'];
// Meta only lets a business answer a DM within 24 h of the person's last message,
// and a comment with one private reply within 7 days.
export const DM_WINDOW_MS = 24 * 3600 * 1000;
export const COMMENT_WINDOW_MS = 7 * 24 * 3600 * 1000;

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}

// [SECURITY] Compare secrets in constant time, so the answer time doesn't leak how much matched.
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// [SECURITY] Meta signs every webhook with the app secret: X-Hub-Signature-256 = sha256=<hex HMAC of the raw body>.
export async function verifySignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!appSecret || !header?.startsWith('sha256=')) return false;
  return safeEqual(`sha256=${toHex(await hmac(appSecret, rawBody))}`, header.trim());
}

export interface OAuthState { app: string; user: string; origin: string; exp: number; nonce: string }

// [SECURITY] The OAuth state says which app and which person started the connection,
// signed with INSTAGRAM_STATE_SECRET and valid for 10 minutes, so nobody can attach
// their Instagram to someone else's app (or send them anywhere else) with a forged callback.
export async function signState(secret: string, s: Omit<OAuthState, 'exp' | 'nonce'>, now = Date.now()): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const body = b64url(enc.encode(JSON.stringify({ ...s, exp: now + 10 * 60 * 1000, nonce })));
  return `${body}.${b64url(new Uint8Array(await hmac(secret, body)))}`;
}

export async function verifyState(secret: string, state: string, now = Date.now()): Promise<OAuthState | null> {
  const [body, sig] = String(state ?? '').split('.');
  if (!secret || !body || !sig) return null;
  if (!safeEqual(b64url(new Uint8Array(await hmac(secret, body))), sig)) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as OAuthState;
    if (typeof s.exp !== 'number' || s.exp < now || !s.app || !s.user || !/^https?:\/\/[^/\s]+$/.test(s.origin)) return null;
    return s;
  } catch {
    return null;
  }
}

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ enable_fb_login: '0', force_authentication: '1', client_id: appId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(','), state });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** One thing that happened on the connected account that the assistant may answer. */
export interface IgEvent {
  account: string;          // the business account (entry.id)
  id: string;               // comment id or message id: used to never handle it twice
  kind: 'comment' | 'story' | 'dm' | 'ad';
  from: string;             // the person's id (IGSID)
  username?: string;
  text: string;
  time: number;             // ms
  commentId?: string;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? v as Json : {});

/** Reads a webhook body into events. Echoes of our own messages and our own comments are left out. */
export function parseWebhook(body: unknown): IgEvent[] {
  const out: IgEvent[] = [];
  const root = obj(body);
  if (root.object !== 'instagram' || !Array.isArray(root.entry)) return out;
  for (const e of root.entry.slice(0, 50)) {
    const entry = obj(e);
    const account = String(entry.id ?? '');
    const entryTime = Number(entry.time) > 1e12 ? Number(entry.time) : Number(entry.time) * 1000 || Date.now();
    for (const c of Array.isArray(entry.changes) ? entry.changes : []) {
      const change = obj(c);
      const v = obj(change.value);
      const from = obj(v.from);
      if (change.field !== 'comments' || !v.id || !from.id || String(from.id) === account) continue;
      out.push({ account, id: `c:${v.id}`, kind: 'comment', from: String(from.id), username: from.username ? String(from.username) : undefined, text: String(v.text ?? ''), time: entryTime, commentId: String(v.id) });
    }
    for (const m of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const ev = obj(m);
      const msg = obj(ev.message);
      const sender = String(obj(ev.sender).id ?? '');
      if (!msg.mid || msg.is_echo || msg.is_deleted || !sender || sender === account) continue;
      const quick = obj(msg.quick_reply).payload;
      const replyTo = obj(msg.reply_to);
      const text = String(quick ?? msg.text ?? '');
      if (!text.trim()) continue;
      const kind = obj(replyTo.story).id || obj(replyTo.story).url ? 'story' : obj(ev.referral).source === 'ADS' || obj(msg.referral).source === 'ADS' ? 'ad' : 'dm';
      out.push({ account, id: `m:${msg.mid}`, kind, from: sender, text, time: Number(ev.timestamp) || entryTime });
    }
  }
  return out;
}

export const withinWindow = (ev: Pick<IgEvent, 'kind' | 'time'>, now = Date.now()) => now - ev.time < (ev.kind === 'comment' ? COMMENT_WINDOW_MS : DM_WINDOW_MS);

/** A Send API body: to a person (IGSID) or, once, as the private reply to a comment. */
export function messageBody(to: { id: string } | { comment_id: string }, text: string, quick?: string[]) {
  const message: Json = { text: text.slice(0, 1000) };
  if (quick?.length && 'id' in to) message.quick_replies = quick.slice(0, 13).map((t) => ({ content_type: 'text', title: t.slice(0, 20), payload: t.slice(0, 1000) }));
  return { recipient: to, message };
}
