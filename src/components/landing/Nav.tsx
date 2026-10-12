import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

// Floating top bar of the public web. It turns to glass once you scroll.

const LINKS: [string, string][] = [['#funciones', 'Funciones'], ['#leads', 'Leads de Instagram'], ['#turistico', 'Airbnb y Booking'], ['#para-quien', 'Para quién']];

export function Nav({ account, onStart }: { account?: ReactNode; onStart: () => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <nav aria-label="Principal" className={`mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-full px-3 pl-4 transition-all duration-300 sm:gap-4 ${solid ? 'border border-estate-line bg-white/80 shadow-[0_14px_40px_-22px_rgba(19,42,30,.5)] backdrop-blur-xl' : 'border border-white/60 bg-white/55 shadow-[0_18px_65px_-30px_rgba(19,42,30,.4)] backdrop-blur-2xl'}`}>
        <Link to="/" className="shrink-0 text-base sm:text-lg" aria-label="StateHubs, inicio"><Logo size={26} /></Link>
        <div className="ml-4 hidden items-center gap-1 text-sm text-estate-muted lg:flex">
          {LINKS.map(([href, label]) => <a key={href} href={href} className="rounded-full px-3 py-1.5 transition hover:bg-estate-forest/[.06] hover:text-estate-ink">{label}</a>)}
          <Link to="/demo" className="rounded-full px-3 py-1.5 transition hover:bg-estate-forest/[.06] hover:text-estate-ink">Demo</Link>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">
          {account}
          <button onClick={onStart} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-estate-forest px-3.5 py-2 font-semibold text-white shadow-[0_12px_28px_-12px_rgba(19,42,30,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.035] hover:bg-estate-deep active:scale-[.98] sm:px-4">
            Empezar<span className="hidden sm:inline"> gratis</span> <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </nav>
    </header>
  );
}
