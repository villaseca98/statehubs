// Connects a person's Google Calendar to StateHubs (OAuth 2.0, web server flow).
//
// GET  ?code&state            Google sends the person back here. The state is
//                             checked and they go on to the app page with the
//                             code; nothing is saved yet.
// POST { action, ... } with the user's JWT:
//   status                    { available, configured, connected, email? }
//   start { return_to }       { url } of Google's consent screen
//   finish { code, state }    swaps the code for tokens, only for the same
//                             person who started (the state is theirs)
//   disconnect                revokes the permission at Google and forgets it
//   busy { from, to }         { busy: [{ from, to }] } busy hours of the primary
//                             calendar, as local Spanish time
//   push { app_id, record_id } creates, moves or removes the record's event in
//                             the primary calendar ({ estado, enlace? })
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_STATE_SECRET (32+
// characters) and APP_URL (where StateHubs runs; comma-separated if several).
// Deploy with --no-verify-jwt: Google's redirect carries no Supabase session,
// so every POST checks the JWT itself. Tokens live in crm_google_accounts,
// which only this function (service role) can read.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { eventFor, googleEventBody, googleEventId, utcToLocal } from "../_shared/blueprint/calendar.ts";
import { allowedOrigins, backToApp, consentUrl, emailFromIdToken, safeReturnTo, signState, verifyState } from "../_shared/googleOAuth.ts";
import type { AppRecord, Blueprint } from "../_shared/blueprint/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 10_000;
const NOT_CONFIGURED = "Falta configurar Google en el servidor.";
const RECONNECT = "Google ha retirado el permiso. Vuelve a conectar tu calendario.";

// Which secrets are missing; with any missing, nothing pretends to work.
function missingSecrets(): string[] {
  const out = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL"].filter((k) => !env(k));
  // [SECURITY] A short HMAC key could be guessed; demand at least 32 characters.
  if (env("GOOGLE_STATE_SECRET").length < 32) out.push("GOOGLE_STATE_SECRET");
  if (env("APP_URL") && allowedOrigins(env("APP_URL")).length === 0) out.push("APP_URL");
  return out;
}

// The URL registered in Google Cloud as «URI de redireccionamiento autorizado».
const redirectUri = () => env("GOOGLE_REDIRECT_URI") || `${env("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/crm-google`;

const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
type Admin = ReturnType<typeof admin>;

class Problem extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function google(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new Problem((e as Error).name === "TimeoutError" ? "Google no respondió a tiempo. Prueba otra vez." : "No se pudo hablar con Google.", 502);
  }
}

async function tokenRequest(params: Record<string, string>) {
  const res = await google(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...params }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, body };
}

interface Account { user_id: string; email: string | null; refresh_token: string; access_token: string | null; expires_at: string | null; scope: string | null }

async function account(db: Admin, userId: string): Promise<Account | null> {
  const { data } = await db.from("crm_google_accounts").select("user_id, email, refresh_token, access_token, expires_at, scope").eq("user_id", userId).maybeSingle();
  return (data as Account | null) ?? null;
}

// A valid access token, refreshed when it is about to expire.
async function accessToken(db: Admin, userId: string): Promise<string> {
  const acc = await account(db, userId);
  if (!acc) throw new Problem("Tu Google Calendar no está conectado.", 409);
  if (acc.access_token && acc.expires_at && Date.parse(acc.expires_at) > Date.now() + 60_000) return acc.access_token;
  const { ok, body } = await tokenRequest({ grant_type: "refresh_token", refresh_token: acc.refresh_token });
  if (!ok || typeof body.access_token !== "string") {
    if (body.error === "invalid_grant") {
      // The person removed the permission in their Google account: forget it.
      await db.from("crm_google_accounts").delete().eq("user_id", userId);
      throw new Problem(RECONNECT, 409);
    }
    throw new Problem("Google no ha renovado el permiso. Prueba otra vez en un momento.", 502);
  }
  const expires = new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000).toISOString();
  await db.from("crm_google_accounts").update({ access_token: body.access_token, expires_at: expires, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return body.access_token;
}

async function calendarError(res: Response): Promise<Problem> {
  await res.body?.cancel();
  if (res.status === 401 || res.status === 403) return new Problem("Falta permiso para tu calendario. Desconecta y vuelve a conectar Google Calendar.", 409);
  if (res.status === 429) return new Problem("Google pide esperar un poco. Prueba otra vez en un minuto.", 429);
  return new Problem(`Google Calendar respondió ${res.status}.`, 502);
}

async function status(db: Admin, userId: string) {
  const missing = missingSecrets();
  if (missing.length) return { available: true, configured: false, connected: false, mensaje: `${NOT_CONFIGURED} Faltan: ${missing.join(", ")}.` };
  const acc = await account(db, userId);
  return { available: true, configured: true, connected: !!acc, ...(acc?.email ? { email: acc.email } : {}) };
}

// Google's redirect back: check the state, then hand the code to the app page.
async function callback(url: URL): Promise<Response> {
  const page = (text: string, code = 400) => new Response(`<!doctype html><meta charset="utf-8"><title>StateHubs</title><p style="font:16px system-ui;margin:2rem">${text}</p>`, {
    status: code, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  if (missingSecrets().length) return page(NOT_CONFIGURED, 503);
  const state = await verifyState(env("GOOGLE_STATE_SECRET"), url.searchParams.get("state") ?? "");
  // [SECURITY] Without a valid, unexpired state we don't redirect anywhere.
  if (!state) return page("El enlace ha caducado. Vuelve a StateHubs y conecta Google Calendar otra vez.");
  // [SECURITY] Checked again: only back to an allowed StateHubs page.
  const back = safeReturnTo(state.r, allowedOrigins(env("APP_URL")));
  if (!back) return page("Dirección de vuelta no permitida.");
  const code = url.searchParams.get("code");
  const params: Record<string, string> = code && code.length <= 2048
    ? { google_code: code, google_state: url.searchParams.get("state") ?? "" }
    : { google_error: url.searchParams.get("error") === "access_denied" ? "cancelado" : "error" };
  return new Response(null, { status: 302, headers: { Location: backToApp(back, params), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

async function finish(db: Admin, userId: string, code: unknown, rawState: unknown) {
  if (missingSecrets().length) throw new Problem(NOT_CONFIGURED, 503);
  const state = await verifyState(env("GOOGLE_STATE_SECRET"), String(rawState ?? ""));
  if (!state) throw new Problem("El enlace ha caducado. Conecta Google Calendar otra vez.");
  // [SECURITY] Only the person who started the connection can finish it, so a
  // link started by someone else can't attach your calendar to their account.
  if (state.u !== userId) throw new Problem("Esta conexión la empezó otra cuenta. Conecta Google Calendar otra vez desde aquí.", 403);
  if (typeof code !== "string" || !code || code.length > 2048) throw new Problem("Falta el código de Google.");
  const { ok, body } = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  if (!ok || typeof body.access_token !== "string") throw new Problem("Google no ha aceptado la conexión. Prueba otra vez.", 502);
  const scope = String(body.scope ?? "");
  if (!scope.includes("calendar.events")) throw new Problem("Hace falta que marques el permiso para ver y editar los eventos de tu calendario.");
  const prev = await account(db, userId);
  const refresh = typeof body.refresh_token === "string" ? body.refresh_token : prev?.refresh_token;
  if (!refresh) throw new Problem("Google no ha dado permiso duradero. Quita StateHubs en tu cuenta de Google y conecta otra vez.", 502);
  const now = new Date().toISOString();
  const { error } = await db.from("crm_google_accounts").upsert({
    user_id: userId, email: emailFromIdToken(body.id_token) ?? prev?.email ?? null, refresh_token: refresh,
    access_token: body.access_token, expires_at: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000).toISOString(),
    scope, updated_at: now,
  });
  if (error) throw new Problem("No se pudo guardar la conexión.", 500);
  return status(db, userId);
}

async function disconnect(db: Admin, userId: string) {
  const acc = await account(db, userId);
  if (acc) {
    // Best effort: the permission is forgotten here even if Google doesn't answer.
    try { await google(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(acc.refresh_token)}`, { method: "POST" }).then((r) => r.body?.cancel()); } catch { /* forget it anyway */ }
    await db.from("crm_google_accounts").delete().eq("user_id", userId);
  }
  return status(db, userId);
}

async function busy(db: Admin, userId: string, from: unknown, to: unknown) {
  const a = Date.parse(String(from ?? "")), b = Date.parse(String(to ?? ""));
  // [SECURITY] A bounded window: at most 62 days per question.
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a || b - a > 62 * 86_400_000) throw new Problem("Fechas no válidas.");
  const token = await accessToken(db, userId);
  const res = await google(`${CAL}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), items: [{ id: "primary" }] }),
  });
  if (!res.ok) throw await calendarError(res);
  const body = await res.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  const list = (body.calendars?.primary?.busy ?? []).slice(0, 500);
  return { busy: list.map((x) => ({ from: utcToLocal(x.start), to: utcToLocal(x.end) })) };
}

async function push(db: Admin, userId: string, appId: unknown, recordId: unknown) {
  if (typeof appId !== "string" || typeof recordId !== "string") throw new Problem("Faltan datos.");
  const { data: app } = await db.from("crm_apps").select("id, owner_id, current_version").eq("id", appId).maybeSingle();
  // [SECURITY] Same answer for "missing" and "not yours", so ids can't be probed.
  if (!app || app.owner_id !== userId || app.current_version == null) throw new Problem("Aplicación no encontrada.", 404);
  const { data: v } = await db.from("crm_app_versions").select("blueprint").eq("app_id", app.id).eq("version", app.current_version).maybeSingle();
  const bp = v?.blueprint as Blueprint | undefined;
  // [SECURITY] The record is looked up inside this app, never by id alone.
  const { data: record } = await db.from("crm_records").select("id, entity, data").eq("app_id", app.id).eq("id", recordId).maybeSingle();
  if (!bp || !record) throw new Problem("Registro no encontrado.", 404);
  // The records it points to (client, property) give the event its details.
  const ids = Object.values((record.data ?? {}) as Record<string, unknown>).filter((x): x is string => typeof x === "string" && /^[\w-]{1,80}$/.test(x)).slice(0, 30);
  const { data: related } = ids.length ? await db.from("crm_records").select("id, entity, data").eq("app_id", app.id).in("id", ids) : { data: [] };
  const event = eventFor(bp, record as AppRecord, (related ?? []) as AppRecord[]);

  const token = await accessToken(db, userId);
  const id = await googleEventId(userId, record.id);
  const url = `${CAL}/calendars/primary/events/${id}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (!event) {
    // No date any more (or cancelled): take it out of the calendar if it was there.
    const res = await google(url, { method: "DELETE", headers });
    await res.body?.cancel();
    if (res.status === 404 || res.status === 410) return { estado: "sin_fecha" };
    if (!res.ok) throw await calendarError(res);
    return { estado: "quitado" };
  }
  const body = googleEventBody(event, record.id);
  let res = await google(url, { method: "PUT", headers, body: JSON.stringify(body) });
  let estado = "actualizado";
  if (res.status === 404) {
    await res.body?.cancel();
    res = await google(`${CAL}/calendars/primary/events`, { method: "POST", headers, body: JSON.stringify({ id, ...body }) });
    estado = "creado";
  }
  if (!res.ok) throw await calendarError(res);
  const made = await res.json() as { htmlLink?: string };
  // [SECURITY] Only pass on a link that really points to Google Calendar.
  const enlace = typeof made.htmlLink === "string" && made.htmlLink.startsWith("https://www.google.com/calendar/") ? made.htmlLink : undefined;
  return { estado, ...(enlace ? { enlace } : {}) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return callback(new URL(req.url));
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // [SECURITY] Identify the caller from their JWT (the function runs without the gateway check).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Inicia sesión." }, 401);
  const db = admin();
  const { data: userData, error: userError } = await db.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Sesión no válida." }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }

  try {
    switch (body.action) {
      case "status": return json(await status(db, userId));
      case "start": {
        if (missingSecrets().length) throw new Problem(NOT_CONFIGURED, 503);
        const back = safeReturnTo(body.return_to, allowedOrigins(env("APP_URL")));
        // [SECURITY] Only StateHubs' own pages (APP_URL) as the way back.
        if (!back) throw new Problem("Dirección de vuelta no permitida. Revisa APP_URL en el servidor.");
        const state = await signState(env("GOOGLE_STATE_SECRET"), userId, back);
        return json({ url: consentUrl(env("GOOGLE_CLIENT_ID"), redirectUri(), state, userData.user.email ?? undefined) });
      }
      case "finish": return json(await finish(db, userId, body.code, body.state));
      case "disconnect": return json(await disconnect(db, userId));
      case "busy": {
        if (missingSecrets().length) throw new Problem(NOT_CONFIGURED, 503);
        return json(await busy(db, userId, body.from, body.to));
      }
      case "push": {
        if (missingSecrets().length) throw new Problem(NOT_CONFIGURED, 503);
        return json(await push(db, userId, body.app_id, body.record_id));
      }
      default: return json({ error: "Acción desconocida." }, 400);
    }
  } catch (e) {
    if (e instanceof Problem) return json({ error: e.message }, e.status);
    return json({ error: "Algo ha fallado con Google Calendar." }, 500);
  }
});
