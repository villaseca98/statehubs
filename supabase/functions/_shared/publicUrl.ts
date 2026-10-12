// Outbound requests to URLs that people type in (webhooks, iCal links) from
// the edge functions. Deno only: the pure checks live in blueprint/automations.ts.
import { isAllowedHookUrl, isPrivateAddress } from "./blueprint/automations.ts";

// [SECURITY] Resolve the host and refuse private, loopback or metadata addresses,
// so a URL can't be pointed at our own network.
export async function isPublicHost(url: string): Promise<boolean> {
  if (!isAllowedHookUrl(url)) return false;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return !isPrivateAddress(host);
  const addrs: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try { addrs.push(...await Deno.resolveDns(host, type)); } catch { /* no records of this type */ }
  }
  return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a));
}

// [SECURITY] GET a public https URL as text: no redirects, a timeout and a size cap.
export async function fetchPublicText(url: string, opts: { timeoutMs: number; maxBytes: number; userAgent: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!await isPublicHost(url)) return { ok: false, error: "el enlace tiene que ser https y público" };
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": opts.userAgent, Accept: "text/calendar, text/plain, */*" },
      // [SECURITY] No redirects: a public URL could otherwise bounce to an internal one.
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).name === "TimeoutError" ? "no respondió a tiempo" : "no se pudo conectar" };
  }
  if (res.status >= 300 && res.status < 400) { await res.body?.cancel(); return { ok: false, error: "el enlace redirige a otro sitio; copia el enlace final" }; }
  if (!res.ok) { await res.body?.cancel(); return { ok: false, error: `respondió ${res.status}` }; }
  // [SECURITY] Refuse big answers up front and stop reading past the cap.
  if (Number(res.headers.get("content-length") ?? 0) > opts.maxBytes) { await res.body?.cancel(); return { ok: false, error: "el calendario es demasiado grande" }; }
  const reader = res.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > opts.maxBytes) { await reader.cancel(); return { ok: false, error: "el calendario es demasiado grande" }; }
      chunks.push(value);
    }
  } catch (e) {
    return { ok: false, error: (e as Error).name === "TimeoutError" ? "no respondió a tiempo" : "se cortó la descarga" };
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return { ok: true, text: new TextDecoder().decode(all) };
}
