import { describe, expect, it } from 'vitest';
import { authorizeUrl, messageBody, parseWebhook, safeEqual, signState, verifySignature, verifyState, withinWindow } from './instagram.ts';

const hex = async (secret: string, body: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, '0')).join('');
};

describe('crm-instagram: seguridad', () => {
  it('accepts only webhooks signed with the app secret', async () => {
    const body = '{"object":"instagram","entry":[]}';
    const good = `sha256=${await hex('secreto', body)}`;
    expect(await verifySignature('secreto', body, good)).toBe(true);
    expect(await verifySignature('otro', body, good)).toBe(false);
    expect(await verifySignature('secreto', `${body} `, good)).toBe(false);
    expect(await verifySignature('secreto', body, null)).toBe(false);
    expect(await verifySignature('secreto', body, good.replace('sha256=', 'sha1='))).toBe(false);
    expect(await verifySignature('', body, good)).toBe(false);
  });

  it('the OAuth state is signed, carries who and where, and expires', async () => {
    const now = 1_800_000_000_000;
    const s = await signState('k', { app: 'a1', user: 'u1', origin: 'https://statehubs.es' }, now);
    expect(await verifyState('k', s, now + 60_000)).toMatchObject({ app: 'a1', user: 'u1', origin: 'https://statehubs.es' });
    expect(await verifyState('k', s, now + 11 * 60_000)).toBeNull();
    expect(await verifyState('otra', s, now)).toBeNull();
    const [body, sig] = s.split('.');
    const forged = btoa(JSON.stringify({ app: 'a2', user: 'u1', origin: 'https://statehubs.es', exp: now + 1e6, nonce: 'x' })).replace(/=+$/, '');
    expect(await verifyState('k', `${forged}.${sig}`, now)).toBeNull();
    expect(await verifyState('k', `${body}.`, now)).toBeNull();
    const evil = await signState('k', { app: 'a1', user: 'u1', origin: 'javascript:alert(1)' }, now);
    expect(await verifyState('k', evil, now)).toBeNull();
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('asks Instagram only for the three permissions it needs', () => {
    const u = new URL(authorizeUrl('123', 'https://x.supabase.co/functions/v1/crm-instagram', 'st'));
    expect(u.origin).toBe('https://www.instagram.com');
    expect(u.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');
    expect(u.searchParams.get('state')).toBe('st');
  });
});

describe('crm-instagram: lectura del webhook', () => {
  it('reads comments, DMs, quick replies, story replies and ads; skips echoes and our own comments', () => {
    const events = parseWebhook({
      object: 'instagram',
      entry: [{
        id: 'BIZ', time: 1_800_000_000,
        changes: [
          { field: 'comments', value: { id: 'c1', text: 'PISO', from: { id: 'u1', username: 'marta' }, media: { id: 'm1' } } },
          { field: 'comments', value: { id: 'c2', text: '¡Gracias!', from: { id: 'BIZ', username: 'agencia' } } },
          { field: 'mentions', value: { id: 'x' } },
        ],
        messaging: [
          { sender: { id: 'u2' }, recipient: { id: 'BIZ' }, timestamp: 1_800_000_001_000, message: { mid: 'mid1', text: 'hola' } },
          { sender: { id: 'u2' }, recipient: { id: 'BIZ' }, timestamp: 1_800_000_002_000, message: { mid: 'mid2', text: 'Comprar', quick_reply: { payload: 'Comprar' } } },
          { sender: { id: 'u3' }, recipient: { id: 'BIZ' }, timestamp: 1, message: { mid: 'mid3', text: '😍', reply_to: { story: { id: 's1', url: 'https://x' } } } },
          { sender: { id: 'u4' }, recipient: { id: 'BIZ' }, timestamp: 1, message: { mid: 'mid4', text: 'Vengo del anuncio' }, referral: { source: 'ADS' } },
          { sender: { id: 'BIZ' }, recipient: { id: 'u2' }, timestamp: 1, message: { mid: 'mid5', text: 'eco', is_echo: true } },
          { sender: { id: 'u5' }, recipient: { id: 'BIZ' }, timestamp: 1, read: { mid: 'mid1' } },
        ],
      }],
    });
    expect(events.map((e) => [e.id, e.kind, e.from, e.text])).toEqual([
      ['c:c1', 'comment', 'u1', 'PISO'],
      ['m:mid1', 'dm', 'u2', 'hola'],
      ['m:mid2', 'dm', 'u2', 'Comprar'],
      ['m:mid3', 'story', 'u3', '😍'],
      ['m:mid4', 'ad', 'u4', 'Vengo del anuncio'],
    ]);
    expect(events[0]).toMatchObject({ username: 'marta', commentId: 'c1', time: 1_800_000_000_000, account: 'BIZ' });
    expect(parseWebhook({ object: 'page', entry: [] })).toEqual([]);
    expect(parseWebhook('basura')).toEqual([]);
  });

  it('only answers inside Meta’s windows: 24 h for messages, 7 days for a comment', () => {
    const now = 2_000_000_000_000;
    expect(withinWindow({ kind: 'dm', time: now - 23 * 3600e3 }, now)).toBe(true);
    expect(withinWindow({ kind: 'dm', time: now - 25 * 3600e3 }, now)).toBe(false);
    expect(withinWindow({ kind: 'comment', time: now - 6 * 86400e3 }, now)).toBe(true);
    expect(withinWindow({ kind: 'comment', time: now - 8 * 86400e3 }, now)).toBe(false);
  });

  it('builds messages with quick replies (20 characters) and private replies without them', () => {
    expect(messageBody({ id: 'u1' }, 'Hola', ['Comprar', 'Una opción larguísima de verdad'])).toEqual({
      recipient: { id: 'u1' },
      message: { text: 'Hola', quick_replies: [{ content_type: 'text', title: 'Comprar', payload: 'Comprar' }, { content_type: 'text', title: 'Una opción larguísim', payload: 'Una opción larguísima de verdad' }] },
    });
    expect(messageBody({ comment_id: 'c1' }, 'Hola', ['A'])).toEqual({ recipient: { comment_id: 'c1' }, message: { text: 'Hola' } });
  });
});
