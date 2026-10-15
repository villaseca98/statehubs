import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarCheck, CalendarRange, Check, KeyRound, Layers, Link2, MessageCircle, UserCheck, X } from 'lucide-react';
import type { PackKey } from '@shared/blueprint/modules.ts';
import { Logo } from '@/components/brand/Logo';
import { Mesh, Reveal, SectionHead } from './Backdrop';
import { InstagramMock } from './Mockups';
import { CHANNEL, E } from './palette';

// The other sections of the public web: the ribbon of words, the Instagram
// leads, the big numbers, the honest part about Airbnb and Booking, who it
// is for, the closing call and the footer.

const WORDS = ['Lead capture', 'Viewings', 'Offers', 'Instagram leads', 'Owners', 'Arrivals', 'Cleaning', 'Holiday permits', 'Net per booking', 'Commissions', 'iCal calendar', 'Sales pipeline'];

export function Marquee() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className={`flex shrink-0 items-center gap-8 pr-8 ${hidden ? 'motion-reduce:hidden' : ''}`}>
      {WORDS.map((w) => (
        <li key={w} className="flex items-center gap-8 whitespace-nowrap font-serif text-xl italic text-estate-forest/80 sm:text-3xl">
          {w}<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-estate-sage" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="What StateHubs brings together" className="relative overflow-hidden border-y border-estate-line bg-white/50 py-6"
      style={{ maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)' }}>
      <div className="sh-marquee">{row(false)}{row(true)}</div>
    </section>
  );
}

// ---- Instagram leads ----------------------------------------------------------

const STEPS: [typeof MessageCircle, string, string][] = [
  [MessageCircle, 'Reply instantly', 'Even late at night, every enquiry gets a timely reply.'],
  [UserCheck, 'Ask the right questions', 'Capture intent, preferred area, budget and financing in a contact profile.'],
  [CalendarCheck, 'Schedule the viewing', 'Suggest available appointment slots and link the viewing to the property and agent.'],
];

export function Leads() {
  return (
    <section id="leads" aria-labelledby="leads-title" className="relative scroll-mt-24 overflow-hidden bg-estate-forest px-4 py-24 text-estate-cream sm:py-32">
      <Mesh dark intensity={0.9} />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <SectionHead dark center={false} id="leads-title" eyebrow="Lead workflows" title={<>Qualify and schedule <span className="sh-accent">while you sleep</span>.</>}
            text="Turn authorized Instagram enquiries into structured leads, with qualification and scheduling workflows when integrations are configured." />
          <ol className="mt-10 space-y-5">
            {STEPS.map(([Icon, title, text], i) => (
              <Reveal key={title} delay={i * 0.08}>
                <li className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-estate-lime text-estate-forest"><Icon className="h-5 w-5" /></span>
                  <span><b className="block font-semibold text-white">{title}</b><span className="text-sm text-estate-cream/75">{text}</span></span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal delay={0.1} className="pb-24">
          <figure>
            <InstagramMock />
            <figcaption className="sr-only">Illustrative Instagram lead conversation and appointment scheduling preview.</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

const FIGURES: [string, string, string][] = [
  ['1', 'connected app', 'Sales and rentals can share contacts, properties and teams.'],
  ['24 h', 'Instagram coverage', 'Configure authorized lead responses and appointment workflows.'],
  ['2', 'calendars per listing', 'Airbnb and Booking calendars in one property view.'],
  ['0 €', 'to explore', 'Explore a browser-based demo without creating an account.'],
];

export function Numbers() {
  return (
    <section aria-label="StateHubs at a glance" className="px-4 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-[28px] border border-estate-line bg-estate-line sm:grid-cols-2 lg:grid-cols-4">
        {FIGURES.map(([n, label, text], i) => (
          <Reveal key={label} delay={i * 0.07} className="h-full">
            <div className="group h-full bg-white p-6 transition-all duration-500 hover:bg-estate-cream sm:p-8">
              <div className="font-serif text-6xl font-normal leading-none tracking-tight text-estate-forest sm:text-7xl">{n}</div>
              <div className="mt-4 font-semibold text-estate-ink">{label}</div>
              <p className="mt-1.5 text-sm text-estate-muted">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---- Airbnb and Booking, sin humo --------------------------------------------------

function Source({ name, color, sub }: { name: string; color: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-estate-line bg-white p-3 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}><CalendarRange className="h-5 w-5" /></span>
      <span className="min-w-0"><span className="block font-semibold text-estate-ink">{name}</span><span className="block truncate text-xs text-estate-muted">{sub}</span></span>
    </div>
  );
}

function Wire({ delay = '0s' }: { delay?: string }) {
  return (
    <span aria-hidden className="relative mx-auto block h-10 w-px bg-estate-sage/60 sm:mx-0 sm:h-px sm:w-full">
      <span className="sh-dot-run hidden sm:block" style={{ animationDelay: delay }} />
    </span>
  );
}

const YES = ['Las reservas entran solas por el enlace iCal de cada anuncio', 'Se crean, se mueven o se cancelan cuando cambian en la plataforma', 'Los solapes entre canales se marcan en rojo', 'Cleaning y llegadas salen en Hoy, con su hora'];
const NO = ['Pricing and rates', 'Guest messages', 'Platform payments and collections'];

export function Channels() {
  return (
    <section id="turistico" aria-labelledby="turistico-title" className="relative scroll-mt-24 overflow-hidden px-4 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHead center={false} id="turistico-title" eyebrow="Airbnb and Booking" title={<>Sincronizado, <span className="sh-accent">sin humo</span>.</>}
            text="Connect each listing's iCal calendar to view booking dates in one place. Calendar sync does not manage payments or messages." />
          <Reveal delay={0.1} className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-estate-ink">What it does</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-estate-muted">
                {YES.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-estate-moss" />{t}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-estate-ink">What it does not do</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-estate-muted">
                {NO.map((t) => <li key={t} className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-estate-muted" />{t}</li>)}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-estate-muted">Las API de las plataformas piden ser partner o pasar por un channel manager. Eso se queda en cada plataforma.</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <figure className="relative rounded-[28px] border border-estate-line bg-estate-sand/60 p-5 sm:p-8">
            <div className="relative grid items-center gap-3 sm:grid-cols-[minmax(0,.8fr)_56px_minmax(0,1.4fr)] sm:gap-0">
              <div className="flex flex-col gap-3">
                <Source name="Airbnb" color={CHANNEL.airbnb} sub="iCal del anuncio" />
                <Source name="Booking" color={CHANNEL.booking} sub="iCal del anuncio" />
              </div>
              <div className="flex flex-col gap-10 sm:gap-16"><Wire /><span className="hidden sm:block"><Wire delay="1.1s" /></span></div>
              <div className="rounded-2xl border border-estate-line bg-white p-3 text-estate-ink shadow-[0_24px_60px_-28px_rgba(19,42,30,.45)]">
                <div className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-estate-moss" />Malvarrosa Sol</div>
                <div className="mt-2 space-y-1.5">
                  {([['Emma Larsen', CHANNEL.airbnb, '12–15 oct', 2, 46], ['Familia Dubois', CHANNEL.booking, '16–20 oct', 30, 58], ['Iker · directa', CHANNEL.directa, '22–25 oct', 52, 46]] as const).map(([g, c, d, l, w]) => (
                    <div key={g} className="relative h-7 rounded-md bg-estate-cream">
                      <span className="absolute inset-y-0.5 flex items-center justify-between gap-1 overflow-hidden whitespace-nowrap rounded px-1.5 text-[10px] font-semibold text-white" style={{ left: `${l}%`, width: `${w}%`, background: c }}><span className="truncate">{g}</span><span className="font-normal opacity-80">{d}</span></span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-estate-muted"><span>Last synced: 12 min ago</span><span className="font-semibold text-estate-moss">3 reservas</span></div>
              </div>
            </div>
            <figcaption className="sr-only">Los calendarios iCal de Airbnb y de Booking llenan la fila del alojamiento en StateHubs.</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Who it's for ------------------------------------------------------------------

const WHO: { key: PackKey; icon: typeof Building2; title: string; lead: string; points: string[] }[] = [
  { key: 'compraventa', icon: Building2, title: 'Real Estate', lead: 'Find clients, show homes and close deals.', points: ['Buyers and sellers with clear next steps', 'Qualified Instagram leads and viewings', 'Lead, sales and rental pipelines', 'Property listings with photos, prices and status'] },
  { key: 'turistico', icon: KeyRound, title: 'Holiday Rentals', lead: 'Manage properties for owners.', points: ['Airbnb and Booking reservations by property', 'Daily cleaning and check-in', 'Net booking value: revenue minus fees and costs', 'Permits and incidents in property records'] },
  { key: 'ambos', icon: Layers, title: 'Both businesses', lead: 'Sell, rent and manage short stays.', points: ['One owner can sell one property and rent another', 'Shared contacts, properties and team', 'One Today dashboard for daily operations', 'One workspace instead of two separate systems'] },
];

export function Audience({ onPick, busy }: { onPick: (k: PackKey) => void; busy: boolean }) {
  return (
    <section id="para-quien" aria-labelledby="para-quien-title" className="scroll-mt-24 px-4 py-24 sm:py-32">
      <SectionHead id="para-quien-title" eyebrow="Who it's for" title={<>Built for real estate <span className="sh-accent">teams</span>.</>}
        text="From solo agents to full teams. Choose the tools your business needs." />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:gap-5 md:grid-cols-3">
        {WHO.map(({ key, icon: Icon, title, lead, points }, i) => {
          const dark = key === 'ambos';
          return (
            <Reveal key={key} delay={i * 0.08} className="h-full">
              <article className={`group relative flex h-full transform-gpu flex-col rounded-[28px] border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_35px_65px_-30px_rgba(19,42,30,.42)] motion-reduce:transform-none ${dark ? 'border-estate-forest bg-estate-forest text-estate-cream' : 'border-estate-line bg-white'}`}>
                {dark && <span className="absolute right-5 top-5 rounded-full bg-estate-lime px-2.5 py-0.5 text-[11px] font-semibold text-estate-forest">Todo en uno</span>}
                <span className={`grid h-11 w-11 place-items-center rounded-full ${dark ? 'bg-estate-lime text-estate-forest' : 'bg-estate-forest text-estate-lime'}`}><Icon className="h-5 w-5" /></span>
                <h3 className={`mt-5 font-serif text-3xl font-normal ${dark ? 'text-white' : 'text-estate-ink'}`}>{title}</h3>
                <p className={`mt-1 ${dark ? 'text-estate-cream/75' : 'text-estate-muted'}`}>{lead}</p>
                <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${dark ? 'text-estate-cream/85' : 'text-estate-muted'}`}>
                  {points.map((t) => <li key={t} className="flex gap-2"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? 'text-estate-lime' : 'text-estate-moss'}`} />{t}</li>)}
                </ul>
                <button type="button" disabled={busy} onClick={() => onPick(key)} className={`group mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${dark ? 'bg-estate-lime text-estate-forest hover:bg-white' : 'border border-estate-forest/25 text-estate-forest hover:border-estate-forest'}`}>
                  Empezar con {title.toLowerCase()} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// ---- Cierre y pie ----------------------------------------------------------------

export function Closing({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-estate-forest px-4 pb-24 pt-24 text-estate-cream sm:pb-32 sm:pt-32">
      <Mesh dark intensity={0.8} />
      <div className="relative z-10 mx-auto max-w-4xl">{children}</div>
    </div>
  );
}

export function Footer() {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-estate-lime">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([to, label]) => (
          <li key={label}>{to.startsWith('#') ? <a href={to} className="text-estate-cream/80 hover:text-white">{label}</a> : <Link to={to} className="text-estate-cream/80 hover:text-white">{label}</Link>}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="bg-estate-deep px-4 py-14 text-estate-cream" style={{ borderTop: `1px solid ${E.forest}` }}>
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link to="/" className="text-xl" aria-label="StateHubs, inicio"><Logo dark size={32} /></Link>
          <p className="mt-3 max-w-xs text-sm text-estate-cream/75">A global CRM for real estate and holiday rentals.</p>
        </div>
        {col('Product', [['#funciones', 'Features'], ['#leads', 'Instagram leads'], ['#turistico', 'Airbnb and Booking'], ['#para-quien', 'Who it's for'], ['/demo', 'Demo']])}
        {col('Cuenta', [['#empezar', 'Empezar gratis'], ['/entrar', 'Entrar'], ['/reels', 'Reels']])}
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-xs text-estate-cream/60">© {new Date().getFullYear()} StateHubs</p>
    </footer>
  );
}
