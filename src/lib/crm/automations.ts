import { server } from '@/lib/supabase';
import { AUTOMATION_ENTITY, hookPayload, isAllowedHookUrl, matchAutomations } from '@shared/blueprint/automations.ts';
import type { HookEvent } from '@shared/blueprint/automations.ts';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';

// Runs automations after a record is created or changed. Apps with an account
// send from the server (crm-automate); guest apps send from the browser, which
// works when the webhook allows it (n8n does by default).

const pad = (n: number) => String(n).padStart(2, '0');
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export async function sendFromBrowser(url: unknown, payload: unknown, post: typeof fetch = fetch): Promise<string> {
  if (!isAllowedHookUrl(url)) return 'URL no permitida: tiene que ser https y pública.';
  try {
    const res = await post(String(url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.ok ? `Enviado (${res.status})` : `El webhook respondió ${res.status}`;
  } catch {
    return 'El navegador no pudo enviarlo (el webhook no lo permite o no responde). Con cuenta se envía desde el servidor.';
  }
}

interface Ctx {
  appId: string;
  appName: string;
  local: boolean;
  blueprint: Blueprint;
  records: AppRecord[];
  titleOf?: (id: string) => string | undefined;
  // Saves the automation's last result (guest mode keeps it in the browser).
  saveResult: (automation: AppRecord, resultado: string) => Promise<unknown> | void;
}

// Returns one line per automation that ran, for a toast.
export async function runAutomations(ctx: Ctx, record: AppRecord, event: HookEvent, before: RecordData | null): Promise<string[]> {
  if (!ctx.local) {
    if (event !== 'prueba' && matchAutomations(ctx.blueprint, ctx.records, record.entity, event, before, record.data).length === 0) return [];
    const { data, error } = await server().functions.invoke('crm-automate', { body: { app_id: ctx.appId, record_id: record.id, event, before } });
    if (error) throw new Error('No se pudieron lanzar las automatizaciones.');
    return (data?.results ?? []).map((r: { resultado: string }) => r.resultado);
  }
  const targets = event === 'prueba'
    ? (record.entity === AUTOMATION_ENTITY ? [record] : [])
    : matchAutomations(ctx.blueprint, ctx.records, record.entity, event, before, record.data);
  const out: string[] = [];
  for (const a of targets) {
    const resultado = await sendFromBrowser(a.data.url, hookPayload(ctx.blueprint, ctx.appName, record.entity, event, record, before, ctx.titleOf));
    await ctx.saveResult(a, resultado);
    out.push(`${a.data.nombre ?? 'Automatización'}: ${resultado}`);
  }
  return out;
}

export const resultPatch = (resultado: string) => ({ ultimo_envio: nowLocal(), resultado });
