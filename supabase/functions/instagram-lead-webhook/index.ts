import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const env = (key: string) => Deno.env.get(key) ?? "";
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const has = (value: unknown) => value !== undefined && value !== null && String(value).trim().length > 0;
const asNumber = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(raw: string, header: string, secret: string) {
  if (!header.startsWith("sha256=") || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(header.slice(7).toLowerCase(), hex);
}

function fieldsFromLead(payload: Record<string, unknown>) {
  const fields = Array.isArray(payload.field_data) ? payload.field_data as { name?: string; values?: unknown[] }[] : [];
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (!field?.name || !Array.isArray(field.values)) continue;
    out[normalize(field.name)] = field.values.map(String).join(", ").trim();
  }
  return out;
}

function pick(fields: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = fields[normalize(alias)];
    if (has(value)) return value;
  }
  return "";
}

function enumValue(value: string, options: Record<string, string>) {
  const n = normalize(value);
  for (const [needle, result] of Object.entries(options)) if (n.includes(needle)) return result;
  return "";
}

function qualify(data: Record<string, unknown>) {
  let score = 0;
  if (has(data.operacion_busca)) score += 25;
  if (asNumber(data.presupuesto_max) > 0) score += 20;
  if (has(data.zona)) score += 15;
  const plazo = String(data.plazo ?? "");
  if (["mes", "trimestre"].includes(plazo)) score += 15;
  else if (plazo === "semestre" || plazo === "sin_prisa") score += 8;
  if (["preaprobada", "no_necesita"].includes(String(data.financiacion ?? ""))) score += 15;
  else if (data.financiacion === "en_tramite") score += 8;
  if (has(data.telefono) || has(data.email)) score += 10;
  return { score, level: score >= 70 ? "alta" : score >= 40 ? "media" : "baja" };
}

function mapLead(payload: Record<string, unknown>) {
  const f = fieldsFromLead(payload);
  const name = pick(f, ["full_name", "nombre completo", "nombre y apellidos", "nombre"]) ||
    [pick(f, ["first_name", "nombre"]), pick(f, ["last_name", "apellidos"])].filter(Boolean).join(" ") ||
    "Lead de Instagram";
  const operation = enumValue(pick(f, ["operacion_busca", "operacion", "que buscas", "tipo de operacion"]), {
    comprar: "comprar", compra: "comprar", alquilar: "alquilar", alquiler: "alquilar",
    vender: "vender", venta: "vender", arrendar: "alquilar_suya",
  });
  const budget = asNumber(pick(f, ["presupuesto_max", "presupuesto maximo", "presupuesto", "budget"]));
  const zone = pick(f, ["zona", "zona de interes", "localidad", "city", "ciudad"]);
  const timeline = enumValue(pick(f, ["plazo", "cuando quieres", "timeline", "cuando"]), {
    "mes": "mes", "este mes": "mes", "inmediato": "mes", "proximo mes": "mes", "1 mes": "mes",
    "trimestre": "trimestre", "3 meses": "trimestre", "este trimestre": "trimestre",
    "semestre": "semestre", "6 meses": "semestre", "sin prisa": "sin_prisa",
  });
  const finance = enumValue(pick(f, ["financiacion", "hipoteca", "financiacion aprobada"]), {
    "preaprobada": "preaprobada", "aprobada": "preaprobada", "no necesito": "no_necesita",
    "no necesito hipoteca": "no_necesita", "en tramite": "en_tramite", "sin mirar": "sin_mirar",
  });
  const consentRaw = normalize(pick(f, ["contacto autorizado", "permiso de contacto", "consentimiento", "acepto que me contacten", "contact permission"]));
  const consent = ["si", "yes", "true", "acepto", "confirmado", "1"].includes(consentRaw)
    ? "confirmado"
    : ["no", "false", "no acepto", "0"].includes(consentRaw) ? "no" : "pendiente";
  const data: Record<string, unknown> = {
    nombre: name,
    telefono: pick(f, ["phone_number", "phone", "telefono", "teléfono", "movil", "móvil"]),
    email: pick(f, ["email", "correo electronico", "correo"]),
    estado: "nuevo",
    origen: "instagram",
    fuente_lead: env("META_LEAD_SOURCE") === "instagram" ? "instagram" : "meta_ads",
    campana_instagram: pick(f, ["campaign_name", "campana", "campaña"]) || String(payload.campaign_id ?? payload.form_id ?? "Formulario Meta"),
    estado_cualificacion: "nuevo",
    contacto_autorizado: consent,
    plazo: timeline,
    financiacion: finance,
  };
  if (operation) data.operacion_busca = operation;
  if (budget > 0) data.presupuesto_max = budget;
  if (zone) data.zona = zone;
  const { score, level } = qualify(data);
  data.puntuacion_lead = score;
  data.estado_cualificacion = score >= 70 ? "cualificado" : "pendiente_datos";
  data.prioridad_comercial = level;
  data.siguiente_paso = consent === "no"
    ? "No iniciar contacto comercial; revisar preferencias y base legal"
    : consent !== "confirmado"
      ? "Revisar permiso y completar cualificación antes de contactar"
      : score >= 70
        ? "Asignar agente y contactar por el canal autorizado"
        : "Completar zona, presupuesto, plazo o financiación";
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && token && safeEqual(token, env("META_VERIFY_TOKEN")) && env("META_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return json({ error: "Verificación de webhook no válida." }, 403);
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256") ?? "", env("META_APP_SECRET")))) {
    return json({ error: "Firma del webhook no válida." }, 401);
  }

  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const appId = env("INSTAGRAM_CRM_APP_ID");
  const accessToken = env("META_ACCESS_TOKEN");
  const pageId = env("META_PAGE_ID");
  const graphVersion = env("META_GRAPH_VERSION");
  if (![url, serviceKey, appId, accessToken, pageId, graphVersion, env("META_VERIFY_TOKEN")].every(Boolean)) {
    return json({ error: "Falta configuración del conector Meta en los secretos del servidor." }, 503);
  }

  let event: { object?: string; entry?: { id?: string; changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  try { event = JSON.parse(raw); } catch { return json({ error: "JSON no válido." }, 400); }
  if (event.object !== "page" || !Array.isArray(event.entry)) return json({ received: true, ignored: true });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: app } = await admin.from("crm_apps").select("id, current_version").eq("id", appId).maybeSingle();
  if (!app) return json({ error: "Aplicación CRM de destino no encontrada." }, 503);
  const { data: version } = app.current_version == null
    ? { data: null }
    : await admin.from("crm_app_versions").select("blueprint").eq("app_id", appId).eq("version", app.current_version).maybeSingle();
  if ((version?.blueprint as { sector?: string } | null)?.sector !== "inmobiliaria") {
    return json({ error: "La aplicación de destino no tiene la plantilla inmobiliaria activa." }, 409);
  }

  let imported = 0;
  let duplicates = 0;
  for (const entry of event.entry) {
    if (entry.id !== pageId) continue;
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = String(change.value?.leadgen_id ?? "");
      if (!leadgenId) continue;

      const leadResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(leadgenId)}?fields=id,created_time,field_data,form_id,ad_id,campaign_id`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!leadResponse.ok) return json({ error: "Meta no ha permitido recuperar el lead; se puede reintentar el webhook." }, 502);
      const lead = await leadResponse.json() as Record<string, unknown>;
      const data = mapLead(lead);
      data.meta_lead_id = leadgenId;
      data.meta_form_id = String(lead.form_id ?? change.value?.form_id ?? "");
      data.meta_ad_id = String(lead.ad_id ?? change.value?.ad_id ?? "");
      data.meta_created_at = String(lead.created_time ?? change.value?.created_time ?? "");

      const { error } = await admin.from("crm_records").insert({
        app_id: appId,
        entity: "lead",
        data,
        is_sample: false,
        source: "meta_leadgen",
        external_event_id: leadgenId,
      });
      if (error?.code === "23505") { duplicates++; continue; }
      if (error) return json({ error: "No se pudo guardar el lead en el CRM; Meta puede reintentar el webhook." }, 500);
      imported++;
    }
  }

  return json({ received: true, imported, duplicates });
});
