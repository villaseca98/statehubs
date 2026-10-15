import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { hasServer, supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useProductText } from '@/i18n/product';
import { Logo } from '@/components/brand/Logo';
import { LanguageSelector } from '@/components/brand/LanguageSelector';

export default function Login() {
  const text = useProductText();
  const location = useLocation();
  const [params] = useSearchParams();
  const requestedNext = params.get('next');
  const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\') ? requestedNext : '/workspace';
  const { user, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const [register, setRegister] = useState(location.pathname === '/register');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { document.title = `${register ? text.register : text.signIn} · StateHubs`; }, [register, text]);
  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, next, navigate]);

  // OAuth/magic-link callbacks must return through a route registered in Supabase Auth.
  // Preserve the requested workspace onboarding path through the redirect allow-list.
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const google = async () => {
    if (!supabase || state === 'sending') return;
    setState('sending'); setError('');
    try {
      const { error: failure } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (failure) throw failure;
    } catch (failure) { setError(failure instanceof Error ? failure.message : text.error); setState('idle'); }
  };
  const magic = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!supabase || state === 'sending') return;
    setState('sending'); setError('');
    try {
      const { error: failure } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: register } });
      if (failure) throw failure;
      setState('sent');
    } catch (failure) { setError(failure instanceof Error ? failure.message : text.error); setState('idle'); }
  };

  return <main className="grid min-h-screen bg-white text-estate-ink lg:grid-cols-2">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-[#18181c] p-12 text-white lg:flex xl:p-20">
      <div className="absolute -right-44 top-20 h-[520px] w-[520px] rounded-full border-[100px] border-[#b41636]/25" aria-hidden="true" />
      <Link to="/" className="relative w-fit"><Logo dark size={42} /></Link>
      <div className="relative max-w-lg py-20"><p className="mb-6 text-xs font-semibold uppercase tracking-[.22em] text-rose-200">{text.allWork}</p>
        <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">{text.accessTitle}</h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">{text.accessSubtitle}</p>
        <div className="mt-12 grid grid-cols-3 gap-3">{[text.contacts, text.properties, text.rentals].map(label => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><Building2 className="mb-3 h-5 w-5 text-rose-300" />{label}</div>)}</div>
      </div><p className="relative flex items-center gap-2 text-xs text-white/55"><ShieldCheck className="h-4 w-4" />{text.privacy}</p>
    </section>
    <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12">
      <header className="flex items-center justify-between gap-3"><Link to="/" className="lg:hidden"><Logo size={30} /></Link><Link to="/" className="hidden text-sm text-estate-muted hover:text-estate-forest lg:block">{text.backHome}</Link><LanguageSelector /></header>
      <div className="mx-auto my-auto w-full max-w-md py-14">
        <div className="mb-8 inline-flex rounded-xl bg-estate-sand p-1" role="group" aria-label={text.account}>
          {[false, true].map(value => <button key={String(value)} onClick={() => { setRegister(value); setState('idle'); setError(''); }} disabled={state === 'sending'} aria-pressed={register === value} className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${register === value ? 'bg-white text-estate-forest shadow-sm' : 'text-estate-muted'}`}>{value ? text.register : text.signIn}</button>)}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">{register ? text.registerTitle : text.welcome}</h2>
        <p className="mt-3 text-sm leading-relaxed text-estate-muted">{text.noPassword}</p>
        {!hasServer ? <div className="mt-8 rounded-2xl border border-estate-line bg-estate-sand p-6"><p role="status" className="text-sm leading-relaxed">{text.accessUnavailable}</p><Link to="/demo" className="mt-5 inline-flex items-center gap-2 font-semibold text-estate-forest">{text.exploreDemo}<ArrowRight className="h-4 w-4" /></Link></div>
          : state === 'sent' ? <div className="mt-8 rounded-2xl border border-rose-100 bg-rose-50 p-6" role="status"><CheckCircle2 className="h-8 w-8 text-estate-forest" /><h3 className="mt-4 font-semibold">{text.linkSent}</h3><p className="mt-2 break-all text-sm font-medium">{email}</p><p className="mt-3 text-sm text-estate-muted">{text.linkDetails}</p><button onClick={() => setState('idle')} className="mt-5 text-sm font-semibold text-estate-forest">{text.sendAgain}</button></div>
          : <><button onClick={google} disabled={state === 'sending'} className="mt-8 min-h-12 w-full rounded-xl border border-estate-line bg-white px-4 py-3 text-sm font-semibold hover:bg-estate-sand disabled:opacity-50">{text.google}</button>
            <div className="my-6 flex items-center gap-4 text-xs text-estate-muted"><span className="h-px flex-1 bg-border" />{text.orEmail}<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={magic} className="space-y-3"><label htmlFor="email" className="block text-sm font-semibold">{text.email}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@agency.com" className="min-h-12 w-full rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" />
              <button disabled={state === 'sending'} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-estate-forest px-4 py-3 text-sm font-semibold text-white hover:bg-estate-deep disabled:opacity-60">{state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{register ? text.createAccount : text.sendLink}</button></form>
          </>}
        {(error || sessionError) && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error || text.sessionError}</p>}
      </div>
    </section>
  </main>;
}
