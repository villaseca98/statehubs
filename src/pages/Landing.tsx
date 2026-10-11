import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Handshake, Loader2, Sparkles, Sun, Trash2, Undo2, Zap } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { hasServer } from '@/lib/supabase';
import { crmApi } from '@/lib/crm/api';
import type { CrmApp } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { ScrollHero } from '@/components/crm/ScrollHero';
import { composeApp, getModule, STARTER } from '@shared/blueprint/modules.ts';
import type { AppKind } from '@shared/blueprint/modules.ts';

// Landing: the 3D story, then two doors (CRM or ERP) that open a working app
// straight away, or a sentence to the AI. Nothing else to configure first.

const KINDS: { kind: AppKind; icon: typeof Handshake; title: string; tagline: string }[] = [
  { kind: 'crm', icon: Handshake, title: 'CRM', tagline: 'Para vender y atender: leads con su siguiente paso, embudo, agenda y clientes.' },
  { kind: 'erp', icon: Briefcase, title: 'ERP', tagline: 'Para llevar la empresa: facturas y cobros, pedidos, almacén y clientes.' },
];

const POINTS = [
  { icon: Sun, title: 'Abres y sabes qué toca', text: '«Hoy» junta las citas, lo atrasado y lo que viene. Sin buscar en tablas.' },
  { icon: Sparkles, title: 'Lo cambias hablando', text: 'Pide un campo, una pantalla o una pieza. Ves la propuesta antes de aplicarla.' },
  { icon: Undo2, title: 'Siempre hay vuelta atrás', text: 'Cada cambio es una versión. Quitar una pieza no borra tus datos.' },
  { icon: Zap, title: 'Conectado a lo tuyo', text: 'Cuando entra un lead o se cobra una factura, avisa a tu n8n, Make o Zapier.' },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<CrmApp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const start = useRef<HTMLElement>(null);

  useEffect(() => { document.title = 'StateHubs · Tu CRM o tu ERP, montado a piezas'; }, []);
  useEffect(() => {
    if (loading) return;
    Promise.all([localCrmApi.listApps(), user ? crmApi.listApps().catch(() => []) : Promise.resolve([])]).then(([mine, remote]) => setApps([...remote, ...mine]));
  }, [user, loading]);

  // With an account the app lives on the server; if that fails (or there is no account) it lives in this browser.
  const newApp = async () => (user ? await crmApi.createApp(user.id).then((a) => ({ api: crmApi, app: a })).catch(() => null) : null)
    ?? { api: localCrmApi, app: await localCrmApi.createApp('') };

  const open = async (kind: AppKind) => {
    setBusy(kind); setError('');
    try {
      const { api, app } = await newApp();
      const { proposal } = await api.propose(app.id, composeApp(kind, kind === 'crm' ? 'Mi CRM' : 'Mi ERP', STARTER[kind]));
      await api.apply(proposal.id);
      navigate(`/app/${app.id}`);
    } catch (e) { setError((e as Error).message); setBusy(null); }
  };
  const ask = async () => {
    const message = prompt.trim();
    if (!message) return;
    setBusy('chat'); setError('');
    try {
      const { app } = await newApp();
      navigate(`/app/${app.id}`, { state: { firstMessage: message } });
    } catch (e) { setError((e as Error).message); setBusy(null); }
  };
  const remove = async (a: CrmApp) => {
    if (!window.confirm(`¿Borrar «${a.name}» con todos sus datos? No se puede deshacer.`)) return;
    await (isLocalApp(a.id) ? localCrmApi : crmApi).deleteApp(a.id);
    setApps((xs) => xs.filter((x) => x.id !== a.id));
  };

  return (
    <div className="min-h-screen bg-background">
      <ScrollHero onChoose={(k) => { start.current?.scrollIntoView({ behavior: 'smooth' }); void open(k); }}
        nav={!loading && (user
          ? <span className="text-white/60">{user.email}</span>
          : hasServer && <Link to="/entrar" className="rounded-md border border-white/25 px-3 py-1.5 text-white hover:border-white/60">Entrar</Link>)} />

      <section ref={start} aria-label="Empezar" className="mx-auto max-w-4xl scroll-mt-6 px-4 pb-10 pt-14 md:pt-20">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight md:text-4xl">Empieza en un clic</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Se abre funcionando, con datos de ejemplo. Luego le pones o quitas piezas, o se lo pides a la IA.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {KINDS.map(({ kind, icon: Icon, title, tagline }) => (
            <button key={kind} onClick={() => open(kind)} disabled={!!busy}
              className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md disabled:opacity-60">
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white"><Icon className="h-5 w-5" /></span>
                <span className="font-display text-2xl font-bold">{title}</span>
                {busy === kind ? <Loader2 className="ml-auto h-5 w-5 animate-spin text-primary" /> : <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />}
              </span>
              <span className="mt-3 block text-sm text-muted-foreground">{tagline}</span>
              <span className="mt-3 flex flex-wrap gap-1.5">
                {STARTER[kind].filter((k) => k !== 'panel').map((k) => <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs">{getModule(k)?.name}</span>)}
              </span>
            </button>
          ))}
        </div>

        <form className="mt-5 rounded-2xl border bg-card p-2 shadow-sm" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <label htmlFor="pedir" className="flex items-center gap-2 px-2 pt-1 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> O cuéntale tu negocio a la IA</label>
          <textarea id="pedir" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={4000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            placeholder="Tengo una clínica de fisio. Quiero pacientes por WhatsApp, citas y bonos de sesiones."
            className="w-full resize-none bg-transparent p-2 text-sm outline-none" />
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <span className="text-xs text-muted-foreground">{user ? 'Se guarda en tu cuenta.' : 'Sin cuenta: se guarda en este navegador.'}</span>
            <button disabled={!!busy || !prompt.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy === 'chat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Proponer
            </button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {apps.length > 0 && (
        <section aria-label="Tus aplicaciones" className="mx-auto max-w-4xl px-4 pb-12">
          <h2 className="mb-3 text-lg font-semibold">Tus aplicaciones</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {apps.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <Link to={`/app/${a.id}`} className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.current_version ? `Versión ${a.current_version}` : 'Sin crear todavía'} · {new Date(a.updated_at).toLocaleDateString('es-ES')}{isLocalApp(a.id) && ' · en este navegador'}</span>
                </Link>
                <span className="flex items-center">
                  <button aria-label={`Borrar ${a.name}`} onClick={() => remove(a)} className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  <Link to={`/app/${a.id}`} aria-label={`Abrir ${a.name}`} className="rounded p-2"><ArrowRight className="h-4 w-4" /></Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-5">
            <Icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        StateHubs · <Link to="/demo" className="underline">Demo</Link> · <Link to="/reels" className="underline">Reels</Link>
      </footer>
    </div>
  );
}
