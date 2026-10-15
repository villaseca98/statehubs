import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ArrowRight, Building2, CalendarRange, Layers, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useI18n } from '@/i18n';
import { hasServer } from '@/lib/supabase';
import { crmApi } from '@/lib/crm/api';
import type { CrmApp } from '@/lib/crm/api';
import { isLocalApp, localCrmApi } from '@/lib/crm/localApi';
import { ScrollHero } from '@/components/crm/ScrollHero';
import { Nav } from '@/components/landing/Nav';
import { Features } from '@/components/landing/Features';
import { Audience, Channels, Closing, Footer, Leads, Marquee, Numbers } from '@/components/landing/Sections';
import { Reveal } from '@/components/landing/Backdrop';
import { composePack, getModule, PACKS } from '@shared/blueprint/modules.ts';
import type { PackKey } from '@shared/blueprint/modules.ts';

// Landing: the public web of the CRM for estate agencies and holiday lets.
// The 3D story, what it does (bento of features), the Instagram leads bot,
// the honest part about Airbnb and Booking, who it is for and, to close, one
// question (what does your agency do?) that opens a working app straight
// away. A discreet link below takes a free description instead. Estate look:
// cream, white, forest green and lime. Pieces live in components/landing.

const PACK_ICON: Record<PackKey, typeof Building2> = { compraventa: Building2, turistico: CalendarRange, ambos: Layers };
const PACK_NAME: Record<PackKey, string> = { compraventa: 'My real estate business', turistico: 'My holiday rentals', ambos: 'My real estate business' };

export default function Landing() {
  const { user, loading } = useAuth();
  const { t,language } = useI18n();
  const navigate = useNavigate();
  const [apps, setApps] = useState<CrmApp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const start = useRef<HTMLElement>(null);
  const toStart = () => start.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  useEffect(() => { document.title = 'StateHubs — Global Real Estate CRM & ERP'; }, [language]);
  useEffect(() => {
    if (loading) return;
    Promise.all([localCrmApi.listApps(), user ? crmApi.listApps().catch(() => []) : Promise.resolve([])]).then(([mine, remote]) => setApps([...remote, ...mine]));
  }, [user, loading]);

  // Signed-in apps must persist on the server; guest demos remain browser-only.
  const newApp = async () => {
    // Never silently create a browser-only app for a signed-in agency if the server fails.
    // Otherwise the user may believe their business data has been saved to their account.
    if (user) return { api: crmApi, app: await crmApi.createApp(user.id) };
    return { api: localCrmApi, app: await localCrmApi.createApp('') };
  };

  // Each answer opens the same unified app with the pieces that business uses.
  const open = async (pack: PackKey) => {
    // Account-first onboarding: never create anonymous browser-only production workspaces.
    const mode = pack === 'turistico' ? 'holidays' : pack === 'ambos' ? 'both' : 'real-estate';
    navigate(user ? '/onboarding?mode='+mode : '/register?next='+encodeURIComponent('/onboarding?mode='+mode));
    return;
  };
  const legacyOpen = async (pack: PackKey) => {
    setBusy(pack); setError('');
    try {
      const { api, app } = await newApp();
      const { proposal } = await api.propose(app.id, composePack(pack, PACK_NAME[pack]));
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
    if (!window.confirm(`${t('confirmDelete')} (${a.name})`)) return;
    await (isLocalApp(a.id) ? localCrmApi : crmApi).deleteApp(a.id);
    setApps((xs) => xs.filter((x) => x.id !== a.id));
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-clip bg-estate-cream text-estate-ink">
      <a href="#empezar" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-estate-forest focus:px-4 focus:py-2 focus:text-white">Skip to get started</a>
      <Nav onStart={toStart} account={!loading && (user
        ? <Link to="/workspace" className="hidden max-w-[12rem] truncate text-estate-forest sm:inline">{t('yourApps')}</Link>
        : <Link to="/login" className="rounded-full px-3 py-2 font-medium text-estate-ink transition hover:bg-estate-forest/[.06]">{t('signIn')}</Link>)} />

      <main>
        <ScrollHero onStart={toStart} />

        {apps.length > 0 && (
          <section aria-label="Your workspaces" className="mx-auto max-w-6xl px-4 pt-16">
            <h2 className="mb-4 font-serif text-2xl">{t('yourApps')}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-2xl border border-estate-line bg-white p-4 transition hover:shadow-md">
                  <Link to={`/app/${a.id}`} className="min-w-0">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="text-xs text-estate-muted">{a.current_version ? `Version ${a.current_version}` : 'Not configured yet'} · {new Date(a.updated_at).toLocaleDateString('en-GB')}{isLocalApp(a.id) && ' · in this browser'}</span>
                  </Link>
                  <span className="flex items-center">
                    <button aria-label={`Delete ${a.name}`} onClick={() => remove(a)} className="rounded-full p-2 text-estate-muted hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                    <Link to={`/app/${a.id}`} aria-label={`Open ${a.name}`} className="rounded-full p-2 text-estate-forest"><ArrowRight className="h-4 w-4" /></Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pt-16"><Marquee /></div>
        <Features />
        <Leads />
        <Numbers />
        <Channels />
        <Audience onPick={(k) => { toStart(); void open(k); }} busy={!!busy} />

        <Closing>
          <section ref={start} id="empezar" aria-labelledby="empezar-title" className="scroll-mt-24">
            <Reveal className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-estate-lime">{t('startMinute')}</p>
              <h2 id="empezar-title" className="mt-4 text-balance font-serif text-[2.5rem] font-normal leading-[1.02] tracking-[-0.02em] text-white sm:text-[4rem]">{t('agencyQuestion')}</h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-estate-cream/75 sm:text-lg">{t('browserOnly')}</p>
            </Reveal>
            <div role="group" aria-label="Business type" className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
              {PACKS.map((p) => {
                const Icon = PACK_ICON[p.key];
                const main = p.key === 'ambos';
                return (
                  <button key={p.key} onClick={() => open(p.key)} disabled={!!busy}
                    className={`group flex flex-col rounded-[26px] border p-5 text-left transition duration-300 hover:-translate-y-1 disabled:opacity-60 ${main ? 'border-estate-lime bg-estate-cream text-estate-ink' : 'border-white/15 bg-white/[.06] text-white hover:bg-white/[.1]'}`}>
                    <span className="flex items-center gap-3">
                      <span className={`grid h-11 w-11 place-items-center rounded-full ${main ? 'bg-estate-forest text-estate-lime' : 'bg-estate-lime text-estate-forest'}`}><Icon className="h-5 w-5" /></span>
                      <span className="font-serif text-2xl">{p.name}</span>
                      {busy === p.key ? <Loader2 className="ml-auto h-5 w-5 animate-spin" /> : <ArrowRight className={`ml-auto h-5 w-5 transition group-hover:translate-x-0.5 ${main ? 'text-estate-forest' : 'text-estate-cream/70'}`} />}
                    </span>
                    <span className={`mt-3 block text-sm ${main ? 'text-estate-muted' : 'text-estate-cream/75'}`}>{p.pitch}</span>
                    <span className="mt-4 flex flex-wrap gap-1.5">
                      {p.modules.filter((k) => k !== 'centro').map((k) => <span key={k} className={`rounded-full px-2 py-0.5 text-xs ${main ? 'bg-estate-sand text-estate-ink' : 'bg-white/10 text-estate-cream/85'}`}>{getModule(k)?.name}</span>)}
                    </span>
                  </button>
                );
              })}
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
            <p className="mt-8 text-center text-sm text-estate-cream/75">{t('previewFirst')} <Link to="/demo" className="font-semibold text-white underline decoration-estate-lime/50 underline-offset-4 hover:decoration-estate-lime">{t('openDemo')}</Link>, without creating an account.</p>

            {/* A discreet way in for agencies that do not fit the three answers. */}
            <details className="group mx-auto mt-6 max-w-2xl text-sm">
              <summary className="cursor-pointer list-none text-center text-estate-cream/70 underline decoration-white/20 underline-offset-4 hover:text-white">None of these fit? Describe your business</summary>
              <form className="mt-4 rounded-[22px] border border-white/15 bg-white/[.06] p-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
                <label htmlFor="pedir" className="block px-3 pt-2 text-sm font-medium text-white">Describe your business</label>
                <textarea id="pedir" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={4000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
                  placeholder="We are three agents selling homes and managing 12 holiday apartments."
                  className="w-full resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-estate-cream/50" />
                <div className="flex items-center justify-between gap-2 px-3 pb-2">
                  <span className="text-xs text-estate-cream/65">{user ? 'Saved to your account. We do not silently fall back to local storage.' : 'Without an account, this draft is stored only in this browser.'}</span>
                  <button disabled={!!busy || !prompt.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-estate-lime px-4 py-2 text-sm font-semibold text-estate-forest transition disabled:opacity-50">
                    {busy === 'chat' && <Loader2 className="h-4 w-4 animate-spin" />} Create my workspace
                  </button>
                </div>
              </form>
            </details>
          </section>
        </Closing>
      </main>

      <Footer />
    </div>
    </MotionConfig>
  );
}
