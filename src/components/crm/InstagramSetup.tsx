import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Link2, Loader2, MessagesSquare, Plus, ShieldCheck, Unlink, X } from 'lucide-react';
import type { AppRecord, Blueprint, BotConfig, RecordData } from '@shared/blueprint/types.ts';
import type { Change } from '@shared/blueprint/diff.ts';
import { botTemplate, withBot } from '@shared/blueprint/bot.ts';
import { validateBlueprint } from '@shared/blueprint/validate.ts';
import { BRAND } from '@shared/blueprint/look.ts';
import type { InstagramAction, InstagramStatus } from '@/lib/crm/api';
import { BotEditor } from './BotEditor';
import { InstagramSimulator } from './InstagramSimulator';

// «Instagram»: the assistant that qualifies leads from comments, stories and
// DMs. Three parts: try it (a simulator that runs the real engine and saves
// what it does), its flow (saved as a proposal like any other change) and the
// account (connected on the server; in guest mode and the demo it says so).

export const META_NOTE = 'Instagram exige cuenta profesional y la revisión de la app de Meta; hasta entonces funciona con las cuentas de prueba.';

type Tab = 'probar' | 'flujo' | 'cuenta';

export interface InstagramSetupProps {
  blueprint: Blueprint;          // what is being edited (the pending proposal, if any)
  live: Blueprint;               // the version in use: the simulator writes records for it
  records: AppRecord[];
  onCreate: (entity: string, data: RecordData) => Promise<AppRecord | void> | AppRecord | void;
  onUpdate: (id: string, patch: RecordData) => void;
  onPropose?: (next: Blueprint) => Promise<void>;   // missing in the demo: nothing is saved
  onAddPiece?: () => void;
  onClose: () => void;
  account?: ((action: InstagramAction) => Promise<InstagramStatus>) | null;
  guest?: boolean;               // guest mode or demo: no account, no server
  busy?: boolean;
  // The proposal waiting to be applied, so it can be applied without leaving.
  pending?: { summary: string; changes: Change[]; applying?: boolean; onApply: () => void; onDiscard: () => void } | null;
}

export function InstagramSetup({ blueprint, live, records, onCreate, onUpdate, onPropose, onAddPiece, onClose, account, guest, busy, pending }: InstagramSetupProps) {
  const hasPiece = !!blueprint.modules?.includes('instagram') || blueprint.entities.some((e) => e.key === 'conversacion');
  const saved = blueprint.bot;
  const [draft, setDraft] = useState<BotConfig>(() => saved ?? botTemplate(blueprint));
  const [tab, setTab] = useState<Tab>('probar');
  useEffect(() => { if (saved) setDraft(saved); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const next = useMemo(() => withBot(blueprint, draft), [blueprint, draft]);
  const errors = useMemo(() => validateBlueprint(next).filter((e) => e.startsWith('Asistente de Instagram')), [next]);

  const liveReady = live.entities.some((e) => e.key === 'conversacion') && live.entities.some((e) => e.key === 'contacto_inmo');
  const simBp = useMemo(() => withBot(live, { ...draft, enabled: true }), [live, draft]);
  const simErrors = useMemo(() => validateBlueprint(simBp).filter((e) => e.startsWith('Asistente de Instagram')), [simBp]);
  const disabled = !liveReady ? (hasPiece ? 'Aplica la propuesta con la pieza «Leads de Instagram» para probarlo.' : 'Pon la pieza «Leads de Instagram» para probarlo.')
    : simErrors.length ? 'Arregla el flujo para probarlo (mira los avisos de abajo).' : undefined;

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!onPropose || errors.length) return;
    setSaving(true);
    try { await onPropose(next); } finally { setSaving(false); }
  };

  const tabs: [Tab, string][] = [['probar', 'Probar'], ['flujo', 'Flujo'], ['cuenta', 'Cuenta']];
  // On a wide screen the simulator is always there, so «Probar» shows the flow next to it.
  const left = tab === 'probar' ? 'flujo' : tab;
  const tabClass = (k: Tab) => (tab === k ? 'bg-foreground text-background' : k === 'flujo' && tab === 'probar' ? 'text-muted-foreground lg:bg-foreground lg:text-background' : 'text-muted-foreground');

  return (
    <div role="dialog" aria-label="Asistente de Instagram" className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})` }}><MessagesSquare className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">Asistente de Instagram</h2>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">Contesta comentarios, historias y mensajes, cualifica al lead y le da cita o le guarda la reserva mientras duermes.</p>
        </div>
        <div role="tablist" aria-label="Partes" className="flex rounded-full border p-0.5 text-sm">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1 font-medium transition ${k === 'probar' ? 'lg:hidden' : ''} ${tabClass(k)}`}>{label}</button>
          ))}
        </div>
        <button aria-label="Cerrar" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
      </header>

      {!hasPiece && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-6">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Para tener la Bandeja de Instagram y que el asistente guarde los leads, pon la pieza «Leads de Instagram».</span>
          {onAddPiece && <button onClick={onAddPiece} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Ponerla</button>}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)] xl:grid-cols-[minmax(0,1fr)_760px]">
        <div className={`min-h-0 flex-col overflow-y-auto ${tab === 'probar' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 md:px-6">
            {left === 'flujo' && <BotEditor blueprint={next} draft={draft} onChange={setDraft} />}
            {left === 'cuenta' && <AccountPanel account={account} guest={guest} />}
          </div>
          {left === 'flujo' && (
            <div className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur md:px-6">
              {pending && !dirty && (
                <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
                  <b>Propuesta pendiente:</b> {pending.summary}
                  <ul className="mt-1 list-disc pl-5 text-xs">{pending.changes.slice(0, 6).map((c, i) => <li key={i}>{c.text}</li>)}</ul>
                  <div className="mt-2 flex gap-2">
                    <button onClick={pending.onApply} disabled={pending.applying} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending.applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aplicar</button>
                    <button onClick={pending.onDiscard} className="rounded-full border border-amber-900/20 px-3 py-1 text-sm">Descartar</button>
                  </div>
                </div>
              )}
              {errors.length > 0 && (
                <ul className="mb-2 flex flex-col gap-0.5 text-xs text-red-700" aria-label="Avisos del flujo">
                  {errors.slice(0, 4).map((e) => <li key={e}>• {e.replace('Asistente de Instagram, ', '').replace('Asistente de Instagram: ', '')}</li>)}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {!onPropose ? 'En la demo no se guarda: pruébalo en el simulador y crea tu app para quedártelo.' : dirty ? 'Primero lo ves como propuesta; luego lo aplicas o lo descartas.' : 'Sin cambios. Lo que toques se prueba al momento en el simulador.'}
                </p>
                {dirty && <button onClick={() => setDraft(saved ?? botTemplate(blueprint))} className="rounded-full border px-3 py-1.5 text-sm">Deshacer</button>}
                <button onClick={save} disabled={!onPropose || !dirty || errors.length > 0 || saving || busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Proponer el cambio
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={`min-h-0 overflow-y-auto border-l bg-muted/40 px-4 py-5 md:px-6 ${tab === 'probar' ? 'block' : 'hidden lg:block'}`}>
          <InstagramSimulator blueprint={simBp} records={records} onCreate={onCreate} onUpdate={onUpdate} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function AccountPanel({ account, guest }: { account?: InstagramSetupProps['account']; guest?: boolean }) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!account) return;
    let on = true;
    setLoading(true);
    account('status').then((s) => { if (on) setStatus(s); }, (e) => { if (on) setError((e as Error).message); }).finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [account]);
  const act = async (action: InstagramAction) => {
    if (!account) return;
    setLoading(true); setError(null);
    try {
      const s = await account(action);
      if (s.url) { window.location.href = s.url; return; }
      setStatus(s);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const offline = guest || !account;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="font-semibold">Tu cuenta de Instagram</h3>
        {offline ? (
          <p className="mt-2 text-sm text-muted-foreground">{status?.mensaje ?? 'Conectar tu Instagram necesita una cuenta de StateHubs: los mensajes llegan a nuestro servidor. Aquí puedes probar el asistente en el simulador.'}</p>
        ) : status?.connected ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"><Check className="h-4 w-4" /> Conectada{status.username ? ` como @${status.username}` : ''}</span>
            <button onClick={() => { if (window.confirm('¿Desconectar Instagram? El asistente dejará de contestar; las conversaciones se quedan.')) void act('disconnect'); }} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"><Unlink className="h-4 w-4" /> Desconectar</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => void act('connect')} disabled={loading || status?.configured === false} className="inline-flex items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})` }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Conectar con Instagram
            </button>
            {status?.configured === false && <p className="text-sm text-amber-700">Falta configurar la app de Meta en el servidor.</p>}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm">{META_NOTE}</p>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Qué hace y qué no</h3>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>A quien comenta una palabra clave le escribe por privado. Meta permite una respuesta privada por comentario; si contesta, sigue la conversación.</li>
          <li>Contesta mensajes y respuestas a historias solo en las 24 horas siguientes al último mensaje del cliente (lo exige Meta).</li>
          <li>Cada respuesta va a la ficha del contacto y de la conversación; la cita aparece en tu Agenda y la reserva en tu Calendario.</li>
          <li>Nunca cobra: una reserva queda «Por confirmar» hasta que tú la confirmas y envías el pago.</li>
          <li>Si alguien pide hablar con una persona o dice que no le interesa, se calla y te lo deja en la Bandeja de Instagram.</li>
        </ul>
      </section>
    </div>
  );
}
