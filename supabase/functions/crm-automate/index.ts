// Runs the automations of a StateHubs CRM/ERP app: sends a record to the
// webhooks (n8n, Make, Zapier…) the person set up in "Automatizaciones".
// POST { app_id, record_id, event: "alta" | "cambio" | "prueba", before? } with the user's JWT.
// "prueba" sends the automation record itself to its own URL, to test it.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { AUTOMATION_ENTITY, hookPayload, isAllowedHookUrl, isPrivateAddress, matchAutomations } from "../_shared/blueprint/automations.ts";
import type { AppRecord, Blueprint, RecordData } from "../_shared/blueprint/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIMEOUT_MS = 8000;
// Datetime fields hold local time ("YYYY-MM-DDTHH:MM"); the apps are Spanish.
const nowMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()).replace(" ", "T");

// [SECURITY] Resolve the host and refuse private, loopback or metadata addresses,
// so a webhook can't be pointed at our own network.
async function publicHost(url: string): Promise<boolean> {
  if (!isAllowedHookUrl(url)) return false;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return !isPrivateAddress(host);
  const addrs: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try { addrs.push(...await Deno.resolveDns(host, type)); } catch { /* no records of this type */ }
  }
  return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a));
}

async function send(url: string, payload: unknown): Promise<string> {
  if (!await publicHost(url)) return "URL no permitida: tiene que ser https y pública.";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "StateHubs-Automatizaciones/1" },
      body: JSON.stringify(payload),
      // [SECURITY] No redirects: a public URL could otherwise bounce to an internal one.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.ok ? `Enviado (${res.status})` : `El webhook respondió ${res.status}`;
  } catch (e) {
    return (e as Error).name === "TimeoutError" ? "El webhook no respondió a tiempo." : "No se pudo conectar con el webhook.";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // [SECURITY] Identify the caller from their JWT; only the app's owner can run its automations.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Inicia sesión." }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Sesión no válida." }, 401);

  let body: { app_id?: string; record_id?: string; event?: string; before?: RecordData | null };
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  const event = body.event;
  if (!body.app_id || !body.record_id || (event !== "alta" && event !== "cambio" && event !== "prueba")) return json({ error: "Faltan datos." }, 400);

  const { data: app } = await admin.from("crm_apps").select("id, owner_id, name, current_version").eq("id", body.app_id).maybeSingle();
  // [SECURITY] Same answer for "missing" and "not yours".
  if (!app || app.owner_id !== userData.user.id || app.current_version == null) return json({ error: "Aplicación no encontrada." }, 404);
  const { data: v } = await admin.from("crm_app_versions").select("blueprint").eq("app_id", app.id).eq("version", app.current_version).maybeSingle();
  const bp = v?.blueprint as Blueprint | undefined;
  if (!bp) return json({ results: [] });

  const { data: record } = await admin.from("crm_records").select("id, entity, data").eq("app_id", app.id).eq("id", body.record_id).maybeSingle();
  if (!record) return json({ error: "Registro no encontrado." }, 404);
  const { data: autos } = await admin.from("crm_records").select("id, entity, data").eq("app_id", app.id).eq("entity", AUTOMATION_ENTITY);

  const before = body.before && typeof body.before === "object" ? body.before : null;
  const targets: AppRecord[] = event === "prueba"
    ? (record.entity === AUTOMATION_ENTITY ? [record as AppRecord] : [])
    : matchAutomations(bp, (autos ?? []) as AppRecord[], record.entity, event, before, record.data as RecordData);

  const results = [];
  for (const a of targets) {
    const payload = hookPayload(bp, app.name, record.entity, event, record as AppRecord, before);
    const resultado = await send(String(a.data.url ?? ""), payload);
    await admin.from("crm_records").update({ data: { ...a.data, ultimo_envio: nowMadrid(), resultado }, updated_at: new Date().toISOString() }).eq("id", a.id);
    results.push({ id: a.id, resultado });
  }
  return json({ results });
});
