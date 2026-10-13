import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicText, isPublicHost } from './publicUrl.ts';

afterEach(() => vi.unstubAllGlobals());

describe('public outbound request boundary', () => {
  it.each(['https://[::ffff:127.0.0.1]/', 'https://[::ffff:a9fe:a9fe]/', 'https://[febf::1]/'])('never fetches a non-public literal: %s', async (url) => {
    const fetch = vi.fn();
    const resolveDns = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('Deno', { resolveDns });
    expect(await fetchPublicText(url, { timeoutMs: 100, maxBytes: 100, userAgent: 'test' })).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(resolveDns).not.toHaveBeenCalled();
  });

  it('rejects a hostname with a public A record but a mapped private AAAA record', async () => {
    vi.stubGlobal('Deno', { resolveDns: vi.fn(async (_host: string, type: string) =>
      type === 'A' ? ['8.8.8.8'] : ['0:0:0:0:0:ffff:7f00:1']) });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await fetchPublicText('https://calendar.example.com/feed', { timeoutMs: 100, maxBytes: 100, userAgent: 'test' })).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when DNS returns no addresses', async () => {
    vi.stubGlobal('Deno', { resolveDns: vi.fn().mockRejectedValue(new Error('DNS failure')) });
    expect(await isPublicHost('https://calendar.example.com/feed')).toBe(false);
  });

  it('keeps public hosts usable with redirects disabled and a bounded download', async () => {
    // jsdom 20 lacks AbortSignal.timeout; Deno provides it in production.
    const signal = new AbortController().signal;
    vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => signal) });
    vi.stubGlobal('Deno', { resolveDns: vi.fn(async (_host: string, type: string) =>
      type === 'A' ? ['8.8.8.8'] : ['2001:4860:4860::8888']) });
    const fetch = vi.fn().mockResolvedValue(new Response('BEGIN:VCALENDAR'));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchPublicText('https://calendar.example.com/feed', { timeoutMs: 1000, maxBytes: 100, userAgent: 'test' }))
      .toEqual({ ok: true, text: 'BEGIN:VCALENDAR' });
    expect(fetch).toHaveBeenCalledWith('https://calendar.example.com/feed', expect.objectContaining({ redirect: 'manual', signal }));
  });
});
