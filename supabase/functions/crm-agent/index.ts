// Builder agent for StateHubs CRM/ERP apps.
// POST { app_id, message } with the user's JWT. Returns the assistant reply and,
// when there is one, a pending proposal (blueprint + changes) to review.
// POST { app_id, blueprint } is the card path (functions picked by hand): no AI,
// the blueprint is validated here and becomes a proposal like any other.
// Applying or undoing is done by the user through crm_apply_proposal / crm_restore_version.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { runAgent } from "../_shared/blueprint/agent.ts";
import { cardProposal } from "../_shared/blueprint/modules.ts";
import type { CallModel, ModelMessage } from "../_shared/blueprint/agent.ts";
import type { Blueprint } from "../_shared/blueprint/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-opus-5-5";
const HISTORY = 20;
const MAX_MESSAGE = 4000;
const HOURLY_LIMIT = 40;
const MAX_BLUEPRINT = 200_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function anthropic(apiKey: string): CallModel {
  return async ({ system, messages, tools }) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 32000, thinking: { type: "adaptive" }, system, messages, tools }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { content: data.content ?? [], stop_reason: data.stop_reason ?? null };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // [SECURITY] Identify the caller from their JWT; every read below is scoped to apps they own.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Inicia sesión para usar el constructor." }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) return json({ error: "Sesión no válida." }, 401);
  const userId = userData.user.id;

  let body: { app_id?: string; message?: string; blueprint?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  if (!body.app_id) return json({ error: "Falta app_id." }, 400);

  const { data: app } = await admin.from("crm_apps").select("id, owner_id, current_version").eq("id", body.app_id).maybeSingle();
  // [SECURITY] Same answer for "missing" and "not yours", so ids can't be probed.
  if (!app || app.owner_id !== userId) return json({ error: "Aplicación no encontrada." }, 404);

  const loadCurrent = async (): Promise<Blueprint | null> => {
    if (app.current_version == null) return null;
    const { data: v } = await admin.from("crm_app_versions").select("blueprint")
      .eq("app_id", app.id).eq("version", app.current_version).maybeSingle();
    return (v?.blueprint as Blueprint) ?? null;
  };
  const saveProposal = async (proposal: { summary: string; blueprint: Blueprint; changes: unknown; samples: unknown }) => {
    await admin.from("crm_proposals").update({ status: "discarded" }).eq("app_id", app.id).eq("status", "pending");
    const { data, error } = await admin.from("crm_proposals").insert({
      app_id: app.id,
      base_version: app.current_version,
      blueprint: proposal.blueprint,
      summary: proposal.summary,
      changes: proposal.changes,
      samples: proposal.samples,
    }).select("*").single();
    return error ? null : data;
  };

  if (body.blueprint !== undefined) {
    // [SECURITY] Bound the size of a hand-made blueprint; it is validated like the AI's before it is stored.
    if (JSON.stringify(body.blueprint).length > MAX_BLUEPRINT) return json({ error: "La aplicación es demasiado grande." }, 400);
    const current = await loadCurrent();
    const made = cardProposal(current, body.blueprint as Blueprint, () => crypto.randomUUID());
    if ("errors" in made) return json({ error: `La propuesta no es válida: ${made.errors.slice(0, 3).join("; ")}` }, 400);
    const proposalRow = await saveProposal(made.proposal);
    if (!proposalRow) return json({ error: "No se pudo guardar la propuesta." }, 500);
    const { data: reply } = await admin.from("crm_messages")
      .insert({ app_id: app.id, role: "assistant", content: `${made.proposal.summary}. Así quedaría; aplícalo si te convence.`, proposal_id: proposalRow.id })
      .select("*").single();
    return json({ message: reply, proposal: proposalRow });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Falta configurar ANTHROPIC_API_KEY en Supabase." }, 500);
  const message = String(body.message ?? "").trim();
  if (!message) return json({ error: "Falta message." }, 400);
  // [SECURITY] Bound prompt size so one request can't run up the bill.
  if (message.length > MAX_MESSAGE) return json({ error: `El mensaje es demasiado largo (máx. ${MAX_MESSAGE} caracteres).` }, 400);

  // [SECURITY] Per-user hourly cap on agent calls.
  const { data: apps } = await admin.from("crm_apps").select("id").eq("owner_id", userId);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("crm_messages").select("id", { count: "exact", head: true })
    .in("app_id", (apps ?? []).map((a) => a.id)).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) return json({ error: "Has llegado al límite de mensajes por hora. Prueba en un rato." }, 429);

  const current = await loadCurrent();

  const { data: past } = await admin.from("crm_messages").select("role, content")
    .eq("app_id", app.id).order("created_at", { ascending: false }).limit(HISTORY);
  const history: ModelMessage[] = [];
  for (const m of (past ?? []).reverse()) {
    // The API needs alternating turns; merge consecutive messages from the same side.
    const last = history[history.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else history.push({ role: m.role as "user" | "assistant", content: m.content });
  }
  if (history[0]?.role === "assistant") history.shift();
  if (history[history.length - 1]?.role === "user") history.pop();

  await admin.from("crm_messages").insert({ app_id: app.id, role: "user", content: message });

  let result;
  try {
    result = await runAgent({ callModel: anthropic(apiKey), current, history, message });
  } catch (e) {
    console.error("[crm-agent]", e);
    return json({ error: "El asistente no ha respondido. Prueba otra vez en un momento." }, 502);
  }

  let proposalRow = null;
  if (result.proposal) {
    proposalRow = await saveProposal(result.proposal);
    if (!proposalRow) return json({ error: "No se pudo guardar la propuesta." }, 500);
  }

  const { data: reply } = await admin.from("crm_messages")
    .insert({ app_id: app.id, role: "assistant", content: result.reply, proposal_id: proposalRow?.id ?? null })
    .select("*").single();

  return json({ message: reply, proposal: proposalRow });
});
