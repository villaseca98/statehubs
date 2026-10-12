// The Instagram assistant on the server (Instagram API with Instagram Login).
//
// POST { action, app_id } with the user's JWT, from the app:
//   status     → { connected, username?, expires_at? }
//   connect    → { url } to send the person to Instagram (signed state)
//   disconnect → forgets the token for this app
// GET ?code&state            → OAuth callback from Instagram: stores a long-lived token and goes back to the app.
// GET ?hub.mode=subscribe…   → webhook verification (INSTAGRAM_VERIFY_TOKEN).
// POST with X-Hub-Signature-256 → webhook: comments and messages. A comment with a
//   keyword gets a private reply (and the public one, if set); messages run the
//   assistant (_shared/blueprint/bot.ts, the same code as the simulator) and are
//   answered through the Send API. Each event is handled once, and only inside
//   Meta's windows (24 h for messages, 7 days for a comment's private reply).
//
// Deploy with --no-verify-jwt: Instagram calls the callback and the webhook without a Supabase JWT.
// Secrets: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_STATE_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { applyBotOps, runBot } from "../_shared/blueprint/bot.ts";
import type { AppRecord, Blueprint, RecordData } from "../_shared/blueprint/types.ts";
import { authorizeUrl, GRAPH, messageBody, parseWebhook, safeEqual, signState, verifySignature, verifyState, withinWindow } from "../_shared/instagram.ts";
import type { IgEvent } from "../_shared/instagram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) ?? "";
const APP_ID = env("INSTAGRAM_APP_ID");
const APP_SECRET = env("INSTAGRAM_APP_SECRET");
const VERIFY_TOKEN = env("INSTAGRAM_VERIFY_TOKEN");
const STATE_SECRET = env("INSTAGRAM_STATE_SECRET");
const SUPABASE_URL = env("SUPABASE_URL");
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/crm-instagram`;
// [SECURITY] Bound the work one webhook call can trigger.
const MAX_BODY = 512_000;
const MAX_EVENTS = 40;
const TIMEOUT_MS = 10_000;
// Records the assistant reads: its own conversations and contacts, the agenda, bookings and flats.
const BOT_ENTITIES = ["conversacion", "contacto_inmo", "cita_inmo", "reserva", "inmueble"];

const admin = () => createClient(SUPABASE_URL, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// The apps are Spanish: the assistant writes Madrid's wall-clock time.
const madridNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));

async function graph(path: string, init: RequestInit & { token?: string } = {}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.searchParams.get("hub.mode") === "subscribe") return verifyWebhook(url);
    if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) return await oauthCallback(url);
    if (req.method === "POST" && req.headers.get("x-hub-signature-256")) return await webhook(req);
    if (req.method === "POST") return await appAction(req);
    return json({ error: "Método no permitido" }, 405);
  } catch (e) {
    console.error("crm-instagram", e);
    return json({ error: "Algo ha fallado con Instagram." }, 500);
  }
});

// ---- From the app ----

async function appAction(req: Request): Promise<Response> {
  // [SECURITY] Identify the caller from their JWT; only the app's owner can connect or read it.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Inicia sesión." }, 401);
  const db = admin();
  const { data: userData, error: userError } = await db.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Sesión no válida." }, 401);
  let body: { app_id?: string; action?: string; origin?: string };
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  if (!body.app_id) return json({ error: "Falta app_id." }, 400);
  const { data: app } = await db.from("crm_apps").select("id, owner_id").eq("id", body.app_id).maybeSingle();
  // [SECURITY] Same answer for "missing" and "not yours", so ids can't be probed.
  if (!app || app.owner_id !== userData.user.id) return json({ error: "Aplicación no encontrada." }, 404);

  if (body.action === "status") {
    // [SECURITY] Never the token: only whether it is connected and as whom.
    const { data: acc } = await db.from("crm_instagram_accounts").select("username, expires_at").eq("app_id", app.id).maybeSingle();
    return json({ connected: !!acc, username: acc?.username ?? null, expires_at: acc?.expires_at ?? null, configured: !!(APP_ID && APP_SECRET && STATE_SECRET) });
  }
  if (body.action === "disconnect") {
    await db.from("crm_instagram_accounts").delete().eq("app_id", app.id);
    return json({ connected: false });
  }
  if (body.action === "connect") {
    if (!APP_ID || !APP_SECRET || !STATE_SECRET) return json({ error: "Instagram aún no está configurado en el servidor (faltan los datos de la app de Meta)." }, 503);
    const origin = String(body.origin ?? req.headers.get("origin") ?? "");
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) return json({ error: "Origen no válido." }, 400);
    const state = await signState(STATE_SECRET, { app: app.id, user: userData.user.id, origin });
    return json({ url: authorizeUrl(APP_ID, REDIRECT_URI, state) });
  }
  return json({ error: "Acción no válida." }, 400);
}

// ---- OAuth callback ----

async function oauthCallback(url: URL): Promise<Response> {
  const state = await verifyState(STATE_SECRET, url.searchParams.get("state") ?? "");
  // [SECURITY] Without a valid signed state we don't even know where to send the person back.
  if (!state) return new Response("El enlace de Instagram ha caducado o no es válido. Vuelve a la app y pulsa «Conectar» otra vez.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const back = (result: string) => Response.redirect(`${state.origin}/app/${state.app}?instagram=${result}`, 302);
  const code = url.searchParams.get("code");
  if (!code) return back("cancelado");

  const db = admin();
  // [SECURITY] The person who started the connection must still own the app.
  const { data: app } = await db.from("crm_apps").select("id, owner_id").eq("id", state.app).maybeSingle();
  if (!app || app.owner_id !== state.user) return back("error");

  const form = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: "authorization_code", redirect_uri: REDIRECT_URI, code: code.replace(/#_$/, "") });
  const short = await graph("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const first = (Array.isArray(short.data) ? short.data[0] : short) as Record<string, unknown>;
  const shortToken = String(first?.access_token ?? "");
  if (!shortToken) return back("error");
  const long = await graph(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: APP_SECRET, access_token: shortToken })}`);
  const token = String(long.access_token ?? shortToken);
  const me = await graph("/me?fields=user_id,username", { token });
  const igUserId = String(me.user_id ?? me.id ?? first.user_id ?? "");
  if (!igUserId) return back("error");
  // Ask Meta to send this account's comments and messages to our webhook.
  await graph(`/me/subscribed_apps?subscribed_fields=comments,messages`, { method: "POST", token }).catch((e) => console.error("subscribed_apps", e));
  // One account, one app: connecting it here takes it away from any other app.
  await db.from("crm_instagram_accounts").delete().eq("ig_user_id", igUserId).neq("app_id", app.id);
  const { error } = await db.from("crm_instagram_accounts").upsert({
    app_id: app.id, owner_id: app.owner_id, ig_user_id: igUserId, username: me.username ? String(me.username) : null,
    access_token: token, expires_at: long.expires_in ? new Date(Date.now() + Number(long.expires_in) * 1000).toISOString() : null, updated_at: new Date().toISOString(),
  });
  return back(error ? "error" : "conectado");
}

// ---- Webhook ----

function verifyWebhook(url: URL): Response {
  // [SECURITY] Meta proves it is Meta with the token we gave it in the app dashboard.
  if (VERIFY_TOKEN && safeEqual(url.searchParams.get("hub.verify_token") ?? "", VERIFY_TOKEN)) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

async function webhook(req: Request): Promise<Response> {
  const raw = await req.text();
  // [SECURITY] Only bodies signed with our app secret are read; anything else is refused.
  if (raw.length > MAX_BODY || !(await verifySignature(APP_SECRET, raw, req.headers.get("x-hub-signature-256")))) return new Response("Forbidden", { status: 403 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("Bad Request", { status: 400 }); }
  const db = admin();
  for (const ev of parseWebhook(body).slice(0, MAX_EVENTS)) {
    try { await handle(db, ev); } catch (e) { console.error("crm-instagram event", ev.id, e); }
  }
  // Meta retries anything that isn't a quick 200; each event is idempotent anyway.
  return new Response("EVENT_RECEIVED", { status: 200 });
}

interface Account { app_id: string; ig_user_id: string; access_token: string; expires_at: string | null; username: string | null }

async function handle(db: SupabaseClient, ev: IgEvent) {
  const { data: acc } = await db.from("crm_instagram_accounts").select("app_id, ig_user_id, access_token, expires_at, username").eq("ig_user_id", ev.account).maybeSingle();
  if (!acc) return;
  const account = acc as Account;
  // [SECURITY] Idempotency: Meta can deliver the same event more than once; the first insert wins.
  const { error: dup } = await db.from("crm_instagram_events").insert({ id: ev.id, app_id: account.app_id });
  if (dup) return;
  // Respect Meta's windows: late deliveries are recorded but not answered.
  const late = !withinWindow(ev);

  const { data: app } = await db.from("crm_apps").select("id, current_version").eq("id", account.app_id).maybeSingle();
  if (!app || app.current_version == null) return;
  const { data: v } = await db.from("crm_app_versions").select("blueprint").eq("app_id", app.id).eq("version", app.current_version).maybeSingle();
  const bp = v?.blueprint as Blueprint | undefined;
  if (!bp?.bot?.enabled) return;
  const token = await freshToken(db, account);

  let username = ev.username;
  if (!username) {
    const profile = await graph(`/${encodeURIComponent(ev.from)}?fields=username,name`, { token }).catch(() => ({} as Record<string, unknown>));
    username = profile.username ? String(profile.username) : `usuario_${ev.from.slice(-6)}`;
  }

  const { data: rows } = await db.from("crm_records").select("id, entity, data").eq("app_id", app.id).in("entity", BOT_ENTITIES);
  const records = (rows ?? []) as AppRecord[];
  const turn = runBot(bp, records, { kind: ev.kind, text: ev.text, username, igId: ev.from }, { now: madridNow(), newId: () => crypto.randomUUID() });

  await applyBotOps(turn.ops, {
    create: async (entity: string, data: RecordData) => {
      const { data: made, error } = await db.from("crm_records").insert({ app_id: app.id, entity, data }).select("id").single();
      if (error || !made) throw new Error(`No se pudo crear ${entity}`);
      return String(made.id);
    },
    update: async (id: string, patch: RecordData) => {
      // [SECURITY] Scoped to this app as well as the id; the patch is merged, nothing else is lost.
      const { data: cur } = await db.from("crm_records").select("data").eq("id", id).eq("app_id", app.id).maybeSingle();
      if (!cur) return;
      await db.from("crm_records").update({ data: { ...(cur.data as RecordData), ...patch }, updated_at: new Date().toISOString() }).eq("id", id).eq("app_id", app.id);
    },
  });

  if (late || !turn.handled) return;
  const me = account.ig_user_id;
  if (ev.kind === "comment" && ev.commentId) {
    // One private reply per comment (Meta's rule), then the person answers in their inbox.
    if (turn.replies[0]) await graph(`/${me}/messages`, { method: "POST", token, headers: { "Content-Type": "application/json" }, body: JSON.stringify(messageBody({ comment_id: ev.commentId }, turn.replies[0].text)) });
    if (turn.publicReply) await graph(`/${encodeURIComponent(ev.commentId)}/replies`, { method: "POST", token, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: turn.publicReply.slice(0, 300) }) }).catch((e) => console.error("public reply", e));
    return;
  }
  for (const m of turn.replies) {
    await graph(`/${me}/messages`, { method: "POST", token, headers: { "Content-Type": "application/json" }, body: JSON.stringify(messageBody({ id: ev.from }, m.text, m.quick)) });
  }
}

// Long-lived tokens last 60 days; refresh them when less than a week is left.
async function freshToken(db: SupabaseClient, acc: Account): Promise<string> {
  if (!acc.expires_at || new Date(acc.expires_at).getTime() - Date.now() > 7 * 86400e3) return acc.access_token;
  try {
    const r = await graph(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: acc.access_token })}`);
    if (!r.access_token) return acc.access_token;
    await db.from("crm_instagram_accounts").update({ access_token: String(r.access_token), expires_at: new Date(Date.now() + Number(r.expires_in ?? 5184000) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("app_id", acc.app_id);
    return String(r.access_token);
  } catch (e) {
    console.error("refresh token", e);
    return acc.access_token;
  }
}
