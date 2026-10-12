// Brings the bookings of Airbnb and Booking into a StateHubs app through the
// iCal link of each listing (the only thing both offer without a partner
// agreement). It only knows which dates are taken: no prices, no messages.
// POST { app_id } with the user's JWT. For each property (inmueble) with
// ical_airbnb / ical_booking, it reads the feed and keeps one «reserva» per
// event (keyed by its UID): new ones are created, moved ones updated, and the
// future ones that left the feed are marked as cancelled. Nothing is deleted.
// Returns { nuevas, actualizadas, canceladas, errores[] }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { ICAL_FIELDS, parseIcal, planSync } from "../_shared/blueprint/ical.ts";
import type { IcalSource, SyncSummary } from "../_shared/blueprint/ical.ts";
import { fetchPublicText } from "../_shared/publicUrl.ts";
import type { AppRecord, Blueprint } from "../_shared/blueprint/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIMEOUT_MS = 10_000;
// [SECURITY] A listing's calendar is a few KB; cap it so one link can't exhaust memory.
const MAX_BYTES = 2_000_000;
// [SECURITY] Bound the work one request can trigger.
const MAX_FEEDS = 60;
const LABEL: Record<IcalSource, string> = { airbnb: "Airbnb", booking: "Booking" };

// The apps are Spanish: «today» is today in Madrid.
const todayMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // [SECURITY] Identify the caller from their JWT; only the app's owner can sync it.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Inicia sesión." }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Sesión no válida." }, 401);

  let body: { app_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  if (!body.app_id) return json({ error: "Falta app_id." }, 400);

  const { data: app } = await admin.from("crm_apps").select("id, owner_id, current_version").eq("id", body.app_id).maybeSingle();
  // [SECURITY] Same answer for "missing" and "not yours", so ids can't be probed.
  if (!app || app.owner_id !== userData.user.id || app.current_version == null) return json({ error: "Aplicación no encontrada." }, 404);
  const { data: v } = await admin.from("crm_app_versions").select("blueprint").eq("app_id", app.id).eq("version", app.current_version).maybeSingle();
  const bp = v?.blueprint as Blueprint | undefined;
  if (!bp?.entities.some((e) => e.key === "reserva") || !bp.entities.some((e) => e.key === "inmueble")) {
    return json({ error: "Esta aplicación no tiene reservas ni inmuebles. Pon la pieza «Alquiler turístico»." }, 400);
  }

  const { data: rows, error: readError } = await admin.from("crm_records").select("id, entity, data").eq("app_id", app.id).in("entity", ["inmueble", "reserva"]);
  if (readError) return json({ error: "No se pudieron leer los datos." }, 500);
  const records = (rows ?? []) as AppRecord[];
  const reservas = records.filter((r) => r.entity === "reserva");
  const feeds: { inmueble: AppRecord; source: IcalSource; url: string }[] = [];
  for (const inmueble of records.filter((r) => r.entity === "inmueble")) {
    for (const source of ["airbnb", "booking"] as const) {
      const url = String(inmueble.data[ICAL_FIELDS[source]] ?? "").trim();
      if (url) feeds.push({ inmueble, source, url });
    }
  }

  const summary: SyncSummary = { nuevas: 0, actualizadas: 0, canceladas: 0, errores: [] };
  if (feeds.length === 0) return json({ ...summary, mensaje: "Ningún alojamiento tiene enlace iCal. Pégalo en la ficha del inmueble (Calendario iCal de Airbnb o de Booking)." });
  if (feeds.length > MAX_FEEDS) summary.errores.push(`Solo se leen ${MAX_FEEDS} calendarios por vez.`);

  const today = todayMadrid();
  const stamp = () => new Date().toISOString();
  for (const feed of feeds.slice(0, MAX_FEEDS)) {
    const name = String(feed.inmueble.data.referencia || feed.inmueble.data.direccion || "Alojamiento").slice(0, 60);
    const got = await fetchPublicText(feed.url, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, userAgent: "StateHubs-Calendario/1" });
    if (!got.ok) { summary.errores.push(`${name} (${LABEL[feed.source]}): ${got.error}`); continue; }
    if (!/BEGIN:VCALENDAR/i.test(got.text)) { summary.errores.push(`${name} (${LABEL[feed.source]}): el enlace no es un calendario iCal`); continue; }

    const plan = planSync(reservas, feed.inmueble.id, feed.source, parseIcal(got.text), today);
    if (plan.create.length) {
      const { data: made, error } = await admin.from("crm_records").insert(plan.create.map((data) => ({ app_id: app.id, entity: "reserva", data }))).select("id, entity, data");
      if (error) summary.errores.push(`${name} (${LABEL[feed.source]}): no se pudieron guardar las nuevas`);
      else { summary.nuevas += made?.length ?? 0; reservas.push(...((made ?? []) as AppRecord[])); }
    }
    for (const [list, key] of [[plan.update, "actualizadas"], [plan.cancel, "canceladas"]] as const) {
      for (const u of list) {
        // [SECURITY] Scoped to this app as well as the id.
        const { error } = await admin.from("crm_records").update({ data: u.data, updated_at: stamp() }).eq("id", u.id).eq("app_id", app.id);
        if (error) continue;
        summary[key] += 1;
        const r = reservas.find((x) => x.id === u.id);
        if (r) r.data = u.data;
      }
    }
  }
  return json(summary);
});
