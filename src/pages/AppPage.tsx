import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Eye, History, Home, Loader2, Minus, Pencil, Plus, Puzzle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/lib/toast';
import { crmApi } from '@/lib/crm/api';
import type { CrmApp, CrmMessage, CrmProposal, CrmVersion } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { resultPatch, runAutomations } from '@/lib/crm/automations';
import { Workspace } from '@/components/crm/Workspace';
import type { Tool } from '@/components/crm/Workspace';
import { ModuleCards } from '@/components/crm/ModuleCards';
import { AnalysisSetup } from '@/components/crm/AnalysisSetup';
import { LogoSetup } from '@/components/brand/LogoSetup';
import { makeTitleLookup } from '@/components/crm/theme';
import { addModule, agencyModules, extraModules, removeModule } from '@shared/blueprint/modules.ts';
import { AUTOMATION_ENTITY } from '@shared/blueprint/automations.ts';
import type { HookEvent } from '@shared/blueprint/automations.ts';
import { DEFAULT_ANALYSIS, withAnalysis } from '@shared/blueprint/analysis.ts';
import type { AnalysisConfig, AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import type { Change } from '@shared/blueprint/diff.ts';
import { syncSummaryText } from '@shared/blueprint/ical.ts';

// One app, open: the workspace for daily work, and three side panels to
// change it (pieces, the AI, history). Every change arrives as a proposal you
// can preview over your own data, apply, discard or undo later.

type Panel = 'piezas' | 'ia' | 'historial' | null;
const CHANGE_ICON = { add: Plus, remove: Minus, change: Pencil };
const CHANGE_COLOR = { add: 'text-emerald-600', remove: 'text-red-600', change: 'text-amber-600' };

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {changes.map((c, i) => {
        const Icon = CHANGE_ICON[c.kind];
        return (
          <li key={i} className="flex gap-2 text-sm">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CHANGE_COLOR[c.kind]}`} />
            <span>{c.text}{c.data && <span className="block text-xs text-muted-foreground">{c.data}</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SidePanel({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(20,18,15,.28)' }} onClick={onClose}>
      <aside role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[420px] flex-col bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer}
      </aside>
    </div>
  );
}

export default function AppPage() {
  const { appId = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const local = isLocalApp(appId);
  const api = local ? localCrmApi : crmApi;

  const [app, setApp] = useState<CrmApp | null>(null);
  const [versions, setVersions] = useState<CrmVersion[]>([]);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [proposal, setProposal] = useState<CrmProposal | null>(null);
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState('');
  const sentFirst = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const fail = useCallback((e: unknown) => toast({ title: 'Algo ha fallado', description: (e as Error).message, error: true }), [toast]);

  const load = useCallback(async () => {
    const [a, v, m, p, r] = await Promise.all([api.getApp(appId), api.versions(appId), api.messages(appId), api.pendingProposal(appId), api.records(appId)]);
    setApp(a); setVersions(v); setMessages(m); setProposal(p); setRecords(r);
    return { app: a, messages: m };
  }, [appId, api]);

  useEffect(() => {
    if (!local && authLoading) return;
    if (!local && !user) { navigate(`/entrar?next=/app/${appId}`); return; }
    load().then(({ app: a, messages: m }) => {
      setLoading(false);
      if (!a) return;
      document.title = `${a.name} · StateHubs`;
      const first = (location.state as { firstMessage?: string } | null)?.firstMessage;
      if (first && m.length === 0 && !sentFirst.current) {
        sentFirst.current = true;
        navigate(location.pathname, { replace: true, state: null });
        setPanel('ia');
        void send(first);
      }
    }).catch((e) => { setLoading(false); fail(e); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, appId]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking, panel]);

  const current = versions.find((v) => v.version === app?.current_version) ?? null;
  const previewRecords = useMemo<AppRecord[]>(() => {
    if (!proposal) return records;
    return [...records, ...proposal.samples.map((s, i) => ({ id: s.id ?? `muestra-${i}`, entity: s.entity, data: s.data, is_sample: true }))];
  }, [proposal, records]);
  const showing = preview && proposal ? proposal.blueprint : current?.blueprint ?? (proposal ? proposal.blueprint : null);
  const previewing = !!proposal && (preview || !current);
  const analysisView = (proposal?.blueprint ?? current?.blueprint)?.views.find((v) => v.type === 'analysis');

  async function send(text: string) {
    const message = text.trim();
    if (!message || thinking) return;
    setDraft('');
    setThinking(true);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: message, proposal_id: null, created_at: new Date().toISOString() }]);
    try {
      const res = await api.ask(appId, message);
      setMessages(await api.messages(appId));
      setProposal(res.proposal);
      setPreview(!!res.proposal);
    } catch (e) {
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: (e as Error).message, proposal_id: null, created_at: new Date().toISOString() }]);
    } finally { setThinking(false); }
  }

  async function toggleModule(key: string) {
    const base = proposal?.blueprint ?? current?.blueprint;
    if (!base || thinking) return;
    await proposeBlueprint(base.modules?.includes(key) ? removeModule(base, key) : addModule(base, key));
  }

  async function setLogo(logo: string | undefined) {
    const base = proposal?.blueprint ?? current?.blueprint;
    if (!base || thinking) return;
    const next = { ...base };
    if (logo) next.logo = logo; else delete next.logo;
    await proposeBlueprint(next);
  }

  async function setAnalysis(config: AnalysisConfig) {
    const base = proposal?.blueprint ?? current?.blueprint;
    if (!base || thinking) return;
    await proposeBlueprint(withAnalysis(base, config));
  }

  async function proposeBlueprint(next: Blueprint) {
    setThinking(true);
    try {
      const res = await api.propose(appId, next);
      setMessages(await api.messages(appId));
      setProposal(res.proposal);
      setPreview(true);
    } catch (e) { fail(e); } finally { setThinking(false); }
  }

  const apply = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      await api.apply(proposal.id);
      await load();
      setPreview(false);
      toast({ title: 'Cambio aplicado', description: 'Si no te convence, vuelve atrás desde Historial.' });
    } catch (e) { fail(e); await load(); } finally { setApplying(false); }
  };
  const discard = async () => {
    if (!proposal) return;
    try { await api.discard(proposal.id); setProposal(null); setPreview(false); } catch (e) { fail(e); }
  };
  const restore = async (v: number) => {
    try {
      await api.restore(appId, v);
      await load();
      toast({ title: `Has vuelto a la versión ${v}`, description: 'Se guarda como una versión nueva: no se pierde nada.' });
    } catch (e) { fail(e); }
  };

  // Automations run after a record is saved. A record created empty counts as new once it gets a name.
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const pendingNew = useRef(new Set<string>());
  const automate = async (record: AppRecord, event: HookEvent, before: RecordData | null): Promise<string[]> => {
    const bp = current?.blueprint;
    if (!bp || !app || !bp.entities.some((e) => e.key === AUTOMATION_ENTITY)) return [];
    const lines = await runAutomations({
      appId, appName: app.name, local, blueprint: bp, records: recordsRef.current,
      titleOf: makeTitleLookup(bp.entities, recordsRef.current),
      saveResult: (a, resultado) => {
        const data = { ...a.data, ...resultPatch(resultado) };
        setRecords((rs) => rs.map((r) => (r.id === a.id ? { ...r, data } : r)));
        return api.updateRecord(a.id, data);
      },
    }, record, event, before);
    if (lines.length && !local) setRecords(await api.records(appId));
    return lines;
  };
  const automateQuietly = (record: AppRecord, event: HookEvent, before: RecordData | null) => {
    automate(record, event, before).then((lines) => { if (lines.length) toast({ title: 'Automatizaciones', description: lines.join(' · ') }); }).catch(fail);
  };
  const hasTitle = (entity: string, data: RecordData) => {
    const e = current?.blueprint.entities.find((x) => x.key === entity);
    return !!e && data[e.titleField] !== undefined && data[e.titleField] !== null && data[e.titleField] !== '';
  };
  const createRecord = async (entity: string, data: RecordData) => {
    try {
      const r = await api.createRecord(appId, entity, data);
      setRecords((rs) => [...rs, r]);
      if (hasTitle(entity, data)) automateQuietly(r, 'alta', null); else pendingNew.current.add(r.id);
      return r;
    } catch (e) { fail(e); }
  };
  const updateRecord = (id: string, patch: RecordData) => {
    const prev = records.find((r) => r.id === id);
    if (!prev) return;
    const data = { ...prev.data, ...patch };
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, data } : r)));
    api.updateRecord(id, data).then(() => {
      if (!pendingNew.current.has(id)) automateQuietly({ ...prev, data }, 'cambio', prev.data);
      else if (hasTitle(prev.entity, data)) { pendingNew.current.delete(id); automateQuietly({ ...prev, data }, 'alta', null); }
    }, (e) => { fail(e); setRecords((rs) => rs.map((r) => (r.id === id ? prev : r))); });
  };
  const deleteRecord = (id: string) => {
    const prev = records;
    setRecords((rs) => rs.filter((r) => r.id !== id));
    api.deleteRecord(id).catch((e) => { fail(e); setRecords(prev); });
  };
  // Airbnb/Booking calendars (iCal), read on the server; guest mode says it needs an account.
  const syncIcal = async () => {
    const res = await api.syncIcal(appId);
    if (res.nuevas + res.actualizadas + res.canceladas > 0) setRecords(await api.records(appId));
    return syncSummaryText(res);
  };
  const testWebhook = async (r: AppRecord) => (await automate(r, 'prueba', null)).join(' · ') || 'No hay nada que probar.';
  const clearSamples = async () => {
    if (!window.confirm('¿Quitar todos los datos de ejemplo? Tus datos reales no se tocan.')) return;
    try { await api.clearSamples(appId); setRecords(await api.records(appId)); } catch (e) { fail(e); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!app) return <div className="flex h-screen flex-col items-center justify-center gap-3"><p>No encontramos esta aplicación.</p><Link to="/" className="text-primary underline">Volver</Link></div>;

  const hasSamples = records.some((r) => r.is_sample);
  const tools: Tool[] = [
    { key: 'piezas', label: 'Piezas', icon: Puzzle, onClick: () => setPanel('piezas'), active: panel === 'piezas' },
    { key: 'ia', label: 'Pedírselo a la IA', icon: Sparkles, onClick: () => setPanel('ia'), active: panel === 'ia' },
    { key: 'historial', label: 'Historial', icon: History, onClick: () => setPanel('historial'), badge: versions.length || undefined, active: panel === 'historial' },
    { key: 'inicio', label: 'Todas mis apps', icon: Home, onClick: () => navigate('/') },
  ];

  const proposalBar = proposal && (
    <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-6">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1"><b>{previewing ? 'Vista previa' : 'Propuesta pendiente'}:</b> {proposal.summary}{previewing ? '. Todavía no se ha aplicado nada.' : ''}</span>
      {current && <button onClick={() => setPreview((p) => !p)} className="rounded-full px-3 py-1 underline-offset-2 hover:underline">{previewing ? 'Ver la actual' : 'Ver cómo queda'}</button>}
      <button onClick={discard} className="rounded-full border border-amber-900/20 px-3 py-1">Descartar</button>
      <button onClick={apply} disabled={applying} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50">
        {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aplicar
      </button>
    </div>
  );

  return (
    <div className="h-[100dvh]">
      {showing ? (
        <Workspace key={showing.name} appId={appId} blueprint={showing} records={previewing ? previewRecords : records} tools={tools} banner={proposalBar} className="h-full"
          onCreate={previewing ? () => undefined : createRecord}
          onUpdate={previewing ? () => undefined : updateRecord}
          onDelete={previewing ? () => undefined : deleteRecord}
          onWebhook={previewing ? undefined : testWebhook}
          onSyncIcal={previewing ? undefined : syncIcal} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary" />
          <p className="max-w-sm text-muted-foreground">Cuéntale a la IA qué negocio tienes y qué quieres controlar. Te propone la aplicación y la ves antes de crearla.</p>
          <button onClick={() => setPanel('ia')} className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground">Empezar a hablar</button>
        </div>
      )}

      {panel === 'piezas' && current && (
        <SidePanel title="Piezas" onClose={() => setPanel(null)}
          footer={hasSamples && <div className="border-t p-3"><button onClick={clearSamples} className="w-full rounded-lg border px-3 py-2 text-sm">Quitar los datos de ejemplo</button></div>}>
          <p className="mb-3 text-sm text-muted-foreground">Toca una pieza para ponerla o quitarla. Primero ves cómo queda; quitarla no borra lo que habías apuntado.</p>
          {thinking && <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparando la propuesta…</p>}
          <ModuleCards compact disabled={thinking} modules={agencyModules()} selected={(proposal?.blueprint ?? current.blueprint).modules ?? []} onToggle={toggleModule} />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Más piezas</summary>
            <div className="mt-3"><ModuleCards compact disabled={thinking} modules={extraModules()} selected={(proposal?.blueprint ?? current.blueprint).modules ?? []} onToggle={toggleModule} /></div>
          </details>
          <div className="mt-5">
            <LogoSetup name={(proposal?.blueprint ?? current.blueprint).name} logo={(proposal?.blueprint ?? current.blueprint).logo} disabled={thinking} onChange={setLogo} />
          </div>
          {analysisView && (
            <div className="mt-5">
              <AnalysisSetup blueprint={proposal?.blueprint ?? current.blueprint} value={analysisView.analysis ?? DEFAULT_ANALYSIS} onChange={setAnalysis} />
            </div>
          )}
        </SidePanel>
      )}

      {panel === 'ia' && (
        <SidePanel title="Pedírselo a la IA" onClose={() => setPanel(null)}
          footer={(
            <form className="border-t p-3" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
              <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={4000} aria-label="Mensaje"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
                  placeholder={current ? 'Ej.: añade la provincia a los clientes' : 'Describe tu negocio…'}
                  className="max-h-40 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none" />
                <button aria-label="Enviar" disabled={thinking || !draft.trim()} className="rounded-xl bg-primary p-2 text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button>
              </div>
            </form>
          )}>
          <div className="flex flex-col gap-3">
            {messages.length === 0 && !thinking && (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                Pide lo que quieras cambiar: un campo, una pantalla, una pieza, una acción. Te enseño la propuesta antes de tocar nada.
                {local && ' En modo prueba puedo poner o quitar piezas por su nombre; para lo demás, entra con tu cuenta.'}
              </p>
            )}
            {messages.map((m) => {
              const pending = proposal && m.proposal_id === proposal.id;
              return (
                <div key={m.id} className={m.role === 'user' ? 'ml-8 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground' : 'mr-4 text-sm'}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {pending && (
                    <div className="mt-2 rounded-xl border bg-card p-3">
                      <ChangeList changes={proposal.changes} />
                      <div className="mt-3 flex gap-2">
                        <button onClick={apply} disabled={applying} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aplicar
                        </button>
                        <button onClick={discard} className="rounded-lg border px-3 py-1.5 text-sm">Descartar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {thinking && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 animate-pulse" /> Preparando la propuesta…</p>}
            <div ref={chatEnd} />
          </div>
        </SidePanel>
      )}

      {panel === 'historial' && (
        <SidePanel title="Historial" onClose={() => setPanel(null)}>
          <p className="mb-3 text-sm text-muted-foreground">Cada cambio aplicado es una versión. Volver a una antigua crea otra nueva: nunca se pierde nada.</p>
          <ul className="flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.version} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">Versión {v.version}</span>{v.version === app.current_version && <span className="ml-1 text-xs text-primary">(actual)</span>}
                  <span className="block text-muted-foreground">{v.summary || 'Sin descripción'}</span>
                  <span className="block text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
                {v.version !== app.current_version && <button onClick={() => restore(v.version)} className="shrink-0 rounded-full border px-3 py-1 text-xs">Volver a esta</button>}
              </li>
            ))}
          </ul>
        </SidePanel>
      )}

    </div>
  );
}
