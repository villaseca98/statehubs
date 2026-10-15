import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { AlertTriangle, ArrowRight, Building2, Home, Instagram, Search, TrendingUp } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Mesh } from '@/components/landing/Backdrop';
import { AreaChart, Donut, Photo } from '@/components/landing/Mockups';
import { APP, CHANNEL, E, NUM } from '@/components/landing/palette';

// The opening of the public web. The headline sits over the app, which comes
// up from below tilted, turns, comes apart into its pieces (figures, property
// card, sales, the booking calendar), gets a lead from the Instagram bot,
// warns about an overlap and closes back up front-on. Plain UI in CSS 3D driven by the scroll: sharp on any
// screen and nothing heavy to download. The 3D lives only here, never in the
// app. With reduced motion it is a still picture.

const C = APP;
const W = 720;
const H = 440;
const GAP = 84; // px between pieces when apart
const TINT: Record<string, [string, string]> = { lime: ['#eef7cf', '#3d5a12'], sun: ['#fbf0c9', '#7a5a07'], red: ['#fde2e2', '#b91c1c'], blue: ['#e3efff', '#1d4ed8'] };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);
/** Fades in over [a, b] and out over [c, d]. */
const windowed = (v: number, a: number, b: number, c = 2, d = 3) => seg(v, a, b) * (1 - seg(v, c, d));
const heroAt = (v: number) => ease(seg(v, 0, 0.18));
const isoAt = (v: number) => ease(seg(v, 0.1, 0.28)) * (1 - ease(seg(v, 0.66, 0.84)));
const explodeAt = (v: number) => ease(seg(v, 0.28, 0.42)) * (1 - ease(seg(v, 0.5, 0.6)));

function Card({ title, extra, children, style }: { title: string; extra?: ReactNode; children: ReactNode; style: CSSProperties }) {
  return (
    <div className="absolute overflow-hidden p-3" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(19,42,30,.05)', ...style }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.text }}>{title}{extra && <span className="ml-auto">{extra}</span>}</div>
      {children}
    </div>
  );
}
const Pill = ({ c, children }: { c: string; children: ReactNode }) => <span className="whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-medium" style={{ background: TINT[c][0], color: TINT[c][1] }}>{children}</span>;

// ---- the pieces, each drawn where it sits in the assembled app -------------

function Base() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: C.bg, borderRadius: 24, boxShadow: '0 50px 120px -40px rgba(19,42,30,.55), 0 0 0 1px rgba(30,58,43,.08)' }}>
      <div className="absolute left-3 right-3 top-3 flex h-10 items-center gap-1.5 rounded-full px-1.5 text-[10px]" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
        <LogoMark size={26} tile="dark" />
        <span className="mr-2 text-[11px] font-semibold" style={{ color: C.text }}>Mediterranean</span>
        {['Today', 'Clients', 'Deals', 'Properties', 'Bookings'].map((l, i) => (
          <span key={l} className="rounded-full px-3 py-1.5 font-medium" style={i === 0 ? { background: E.forest, color: '#fff' } : { border: `1px solid ${C.border}` }}>{l}</span>
        ))}
        <span className="ml-auto grid h-7 w-7 place-items-center rounded-full" style={{ border: `1px solid ${C.border}` }}><Search className="h-3 w-3" /></span>
        <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold" style={{ background: E.lime, color: E.forest }}>MV</span>
      </div>
    </div>
  );
}

function Figures() {
  const items: [string, string, typeof Home][] = [['82 %', 'occupancy today', Home], ['6.840 €', 'net this month', TrendingUp], ['1,2 M€', 'in deals', Building2], ['3', 'Instagram leads', Instagram]];
  return (
    <div className="absolute flex gap-2" style={{ left: 16, right: 16, top: 64, height: 38 }}>
      {items.map(([value, label, Icon], i) => (
        <div key={label} className="flex flex-1 items-center gap-2 rounded-full px-1.5" style={{ background: i === 3 ? E.forest : C.surface, border: `1px solid ${i === 3 ? E.forest : C.border}`, color: i === 3 ? '#fff' : C.text }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: i === 3 ? E.lime : E.cream, color: E.forest }}><Icon className="h-3.5 w-3.5" /></span>
          <span className="whitespace-nowrap text-[14px] font-semibold" style={NUM}>{value}</span>
          <span className="truncate text-[9px]" style={{ color: i === 3 ? 'rgba(255,255,255,.75)' : C.muted }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Listing() {
  return (
    <Card title="Penthouse with terrace" extra={<Pill c="lime">For sale</Pill>} style={{ left: 16, top: 112, width: 300, height: 312 }}>
      <Photo className="h-[168px] rounded-xl">
        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold" style={{ color: E.forest }}>Ruzafa, Valencia</span>
      </Photo>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <Photo key={i} className="h-[40px] rounded-lg" />)}</div>
      <div className="mt-2 flex items-end justify-between">
        <span className="leading-tight"><span className="block text-[18px] font-bold" style={{ ...NUM, color: C.text }}>330.000 €</span><span className="text-[9px]" style={{ color: C.muted }}>3 beds · 2 baths · 110 m² · 4 viewings</span></span>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white" style={{ background: E.forest }}>Ver ficha</span>
      </div>
    </Card>
  );
}

function Sales() {
  return (
    <Card title="Ventas cerradas" extra={<Pill c="lime">+18 %</Pill>} style={{ left: 326, top: 112, width: 378, height: 150 }}>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-bold leading-none" style={{ ...NUM, color: C.text }}>1,48 M€</div>
          <AreaChart className="mt-1 w-full" height={88} />
        </div>
        <div className="flex shrink-0 flex-col items-center"><Donut size={96} /></div>
      </div>
    </Card>
  );
}

const DAYS = 10;
type Bar = [from: number, nights: number, guest: string, color: string, lane?: number];
const ROWS: [string, Bar[]][] = [
  ['Malvarrosa Sol', [[0, 3, 'Emma', CHANNEL.airbnb], [4, 4, 'Familia Dubois', CHANNEL.booking]]],
  ['Loft Carmen', [[0, 2, 'Liam', CHANNEL.airbnb], [2, 3, 'Paolo', CHANNEL.booking], [4, 3, 'Sophie', CHANNEL.airbnb, 1]]],
  ['Ruzafa penthouse', [[1, 6, 'Martinez Group', CHANNEL.booking]]],
];

function Bookings({ p }: { p: MotionValue<number> }) {
  const pct = (d: number) => `${(d / DAYS) * 100}%`;
  const callout = useTransform(p, (v) => windowed(v, 0.56, 0.6, 0.7, 0.74));
  const calloutY = useTransform(callout, (o) => (1 - o) * 10);
  return (
    <Card title="Bookings por alojamiento" extra={<span className="flex gap-1"><Pill c="red">Airbnb</Pill><Pill c="blue">Booking</Pill></span>} style={{ left: 326, top: 272, width: 378, height: 152, overflow: 'visible' }}>
      <div className="ml-[76px] grid text-center text-[8.5px]" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)`, color: C.muted, ...NUM }}>
        {Array.from({ length: DAYS }, (_, i) => <span key={i} className="mx-auto w-5 rounded-full" style={i === 0 ? { background: E.forest, color: '#fff', fontWeight: 700 } : undefined}>{12 + i}</span>)}
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {ROWS.map(([name, bars]) => {
          const clash = bars.some((b) => b[4]);
          return (
            <div key={name} className="flex items-center text-[9.5px]" style={{ color: C.text }}>
              <span className="w-[76px] shrink-0 truncate pr-1 font-medium">{name}</span>
              <span className="relative flex-1 rounded-md" style={{ height: clash ? 34 : 18, background: C.bg }}>
                {clash && <span className="absolute inset-y-0" style={{ left: pct(4.5), width: pct(1), background: 'repeating-linear-gradient(45deg, rgba(220,38,38,.28) 0 3px, rgba(220,38,38,.06) 3px 6px)' }} />}
                {bars.map(([from, nights, guest, color, lane]) => {
                  const hit = clash && (lane || guest === 'Paolo');
                  return (
                    <span key={guest} className={`absolute flex items-center gap-0.5 truncate rounded px-1 text-[8.5px] font-semibold leading-[14px] text-white ${hit ? 'sh-pulse' : ''}`}
                      style={{ left: `calc(${pct(from + 0.5)} + 1px)`, width: `calc(${pct(nights)} - 2px)`, top: lane ? 18 : 2, height: 14, background: color, outline: hit ? '2px solid #b91c1c' : undefined, outlineOffset: 1 }}>
                      {hit && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}{guest}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      <motion.div className="absolute -top-5 right-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white" style={{ opacity: callout, y: calloutY, background: '#b91c1c', boxShadow: '0 10px 30px -6px rgba(185,28,28,.6)' }}>
        <AlertTriangle className="h-4 w-4" /> Solape el 16: Paolo y Sophie
      </motion.div>
    </Card>
  );
}

/** The lead the Instagram bot leaves in the CRM: it drops in while the story talks about leads. */
function Lead({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, (v) => windowed(v, 0.36, 0.42, 0.5, 0.55));
  const y = useTransform(opacity, (o) => (1 - o) * -16);
  return (
    <motion.div className="absolute flex w-[250px] items-center gap-2 rounded-2xl p-2.5 text-[10px]" style={{ opacity, y, right: 28, top: 190, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 24px 50px -18px rgba(19,42,30,.5)', color: C.text }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b 55%, #6228d7)' }}><Instagram className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 leading-tight"><b className="block text-[11px]">Nuevo lead · Clara Vidal</b><span style={{ color: C.muted }}>Para vivir · hipoteca preaprobada</span><b className="block" style={{ color: E.moss }}>Visita agendada jue 18:00</b></span>
      <Pill c="red">Caliente</Pill>
    </motion.div>
  );
}

const PIECES: { key: string; label: string; Comp: (props: { p: MotionValue<number> }) => ReactNode }[] = [
  { key: 'base', label: 'Pill navigation', Comp: Base },
  { key: 'cifras', label: 'Daily figures', Comp: Figures },
  { key: 'ficha', label: 'Fichas con fotos', Comp: Listing },
  { key: 'ventas', label: 'Ventas y objetivos', Comp: Sales },
  { key: 'reservas', label: 'Calendario de reservas', Comp: Bookings },
  { key: 'lead', label: 'Leads de Instagram', Comp: Lead },
];

// ---- motion helpers -----------------------------------------------------------

function Layer({ p, index, children }: { p: MotionValue<number>; index: number; children: ReactNode }) {
  const transform = useTransform(p, (v) => `translate3d(0, 0, ${index * GAP * explodeAt(v)}px)`);
  const sheet = useTransform(p, (v) => (index === 0 ? 0 : explodeAt(v)));
  return (
    <motion.div className="absolute inset-0" style={{ transform, transformStyle: 'preserve-3d' }}>
      <motion.div className="absolute inset-0" style={{ opacity: sheet, borderRadius: 24, background: 'rgba(255,255,255,.28)', border: '1px solid rgba(47,90,65,.35)', boxShadow: '0 0 50px rgba(212,236,122,.25)' }} />
      {children}
    </motion.div>
  );
}

function Line({ p, from, to, children, className = '' }: { p: MotionValue<number>; from: [number, number]; to?: [number, number]; children: ReactNode; className?: string }) {
  const opacity = useTransform(p, (v) => windowed(v, from[0], from[1], to?.[0], to?.[1]));
  const y = useTransform(p, (v) => (1 - seg(v, from[0], from[1])) * 18 - seg(v, to?.[0] ?? 2, to?.[1] ?? 3) * 18);
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'));
  // Hidden captions leave the accessibility tree and the tab order.
  const visibility = useTransform(opacity, (o) => (o < 0.02 ? 'hidden' : 'visible'));
  return <motion.div className={`absolute inset-x-0 top-0 ${className}`} style={{ opacity, y, pointerEvents, visibility }}>{children}</motion.div>;
}

function LegendItem({ p, i, label }: { p: MotionValue<number>; i: number; label: string }) {
  const start = 0.3 + i * 0.025;
  const opacity = useTransform(p, (v) => seg(v, start, start + 0.03) * (1 - seg(v, 0.49, 0.53)));
  const x = useTransform(opacity, (o) => (1 - o) * 12);
  return (
    <motion.li className="flex items-center gap-2 whitespace-nowrap rounded-full border border-estate-line bg-white/80 px-3 py-1 text-xs text-estate-ink shadow-sm backdrop-blur lg:text-sm" style={{ opacity, x }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: E.moss }} />
      {label}
    </motion.li>
  );
}

function Stage({ p, scale, shift, zoom, lift }: { p: MotionValue<number>; scale: number; shift: number; zoom: number; lift: number }) {
  const object = useTransform(p, (v) => {
    const hero = 1 - heroAt(v);
    const iso = isoAt(v);
    const spin = -30 + 10 * seg(v, 0.28, 0.62);
    return `translateY(${shift * hero - lift * iso}px) rotateX(${24 * hero + 50 * iso}deg) rotateZ(${spin * iso}deg) scale(${1 + zoom * iso - 0.04 * hero})`;
  });
  const glow = useTransform(p, (v) => 0.35 + 0.65 * Math.max(explodeAt(v), 1 - heroAt(v)));
  return (
    <div className="relative flex h-full items-center justify-center" style={{ perspective: 2000 }}>
      <motion.div className="pointer-events-none absolute h-[620px] w-[620px] max-w-[140vw] rounded-full" style={{ opacity: glow, background: 'radial-gradient(circle, rgba(212,236,122,.55) 0%, rgba(143,174,139,.22) 38%, transparent 68%)' }} />
      {/* Layout box at the scaled size so it stays centred on narrow screens. */}
      <div style={{ width: W * scale, height: H * scale, transformStyle: 'preserve-3d' }}>
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0', transformStyle: 'preserve-3d' }}>
          <motion.div className="relative h-full w-full" style={{ transform: object, transformStyle: 'preserve-3d' }}>
            {PIECES.map(({ key, Comp }, i) => <Layer key={key} p={p} index={i}><Comp p={p} /></Layer>)}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ---- copy -----------------------------------------------------------------------

function HeroCopy({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 text-center">
      <a href="#leads" className="group inline-flex max-w-full items-center gap-2 rounded-full border border-estate-line bg-white/70 py-1 pl-1 pr-3 text-xs text-estate-ink shadow-sm backdrop-blur transition hover:border-estate-sage sm:text-sm">
        <span className="shrink-0 rounded-full bg-estate-forest px-2 py-0.5 text-[11px] font-semibold text-estate-lime">Nuevo</span>
        <span className="truncate">Un bot de Instagram que cualifica y agenda</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
      </a>
      <h1 id="hero-title" className="mt-6 text-balance font-serif text-[2.7rem] font-normal leading-[1] tracking-[-0.025em] text-estate-ink sm:text-[4.2rem] lg:text-[5.4rem]">
        The CRM for real estate and <span className="sh-accent">holiday rentals</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-estate-muted sm:text-xl">
        Contactos, inmuebles, operaciones y reservas en una sola app. Los Instagram leads llegan qualified y con la visita en tu agenda.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onStart} className="group inline-flex items-center gap-2 rounded-full bg-estate-forest px-6 py-3 font-semibold text-white shadow-[0_14px_34px_-14px_rgba(19,42,30,.8)] transition hover:-translate-y-0.5 hover:bg-estate-deep">
          Empezar gratis <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <Link to="/demo" className="inline-flex items-center gap-2 rounded-full border border-estate-forest/25 bg-white/60 px-6 py-3 font-semibold text-estate-forest backdrop-blur transition hover:border-estate-forest">
          Ver la demo
        </Link>
      </div>
      <p className="mt-4 text-xs text-estate-muted sm:text-sm">No card or account required to explore the demo.</p>
    </div>
  );
}

const Caption = ({ title, text }: { title: ReactNode; text: ReactNode }) => (
  <>
    <p className="text-balance font-serif text-[2rem] font-normal leading-[1.04] tracking-[-0.02em] text-estate-ink sm:text-[3.2rem]">{title}</p>
    <div className="mx-auto mt-3 max-w-xl text-pretty text-sm text-estate-muted sm:text-lg">{text}</div>
  </>
);

// ---- layout -----------------------------------------------------------------------

/** Fits the app to the space under the captions and works out how far down it starts, under the headline. */
function useLayout(box: RefObject<HTMLDivElement>, copy: RefObject<HTMLDivElement>, band: RefObject<HTMLDivElement>) {
  const [layout, setLayout] = useState({ scale: 0.5, shift: 0, top: 230 });
  const measure = useCallback(() => {
    if (!box.current || !copy.current || !band.current) return;
    const vw = window.innerWidth;
    const vh = box.current.clientHeight || window.innerHeight;
    const top = band.current.offsetTop + band.current.offsetHeight;
    const region = vh - top;
    const scale = Math.max(0.42, Math.min(1.12, (vw - 32) / W, (region - 70) / H));
    const center = top + region / 2;
    const copyBottom = copy.current.offsetTop + copy.current.offsetHeight;
    setLayout({ scale, top, shift: Math.max(0, copyBottom + 44 - (center - (H * scale) / 2)) });
  }, [box, copy, band]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return layout;
}

export function ScrollHero({ onStart }: { onStart: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const still = useMotionValue(0.9);
  const p = reduced ? still : scrollYProgress;
  const { scale, shift, top } = useLayout(box, copy, band);
  const copyOpacity = useTransform(p, (v) => 1 - seg(v, 0.03, 0.12));
  const copyY = useTransform(p, (v) => -60 * seg(v, 0, 0.14));
  const copyEvents = useTransform(copyOpacity, (o) => (o > 0.5 ? 'auto' : 'none'));
  const copyVisibility = useTransform(copyOpacity, (o) => (o < 0.02 ? 'hidden' : 'visible'));

  if (reduced) {
    const s = Math.min(1, (typeof window === 'undefined' ? 1024 : window.innerWidth - 32) / W);
    return (
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-estate-cream pb-16 pt-28">
        <Mesh />
        <div className="relative z-10"><HeroCopy onStart={onStart} /></div>
        <div aria-hidden className="relative z-10 mx-auto mt-12 flex justify-center px-4">
          <div style={{ width: W * s, height: H * s }}>
            <div className="relative" style={{ width: W, height: H, transform: `scale(${s})`, transformOrigin: '0 0' }}>
              {PIECES.map(({ key, Comp }) => <div key={key} className="absolute inset-0"><Comp p={p} /></div>)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative bg-estate-cream" style={{ height: '380vh' }}>
      <div ref={box} className="sticky top-0 h-[100svh] overflow-hidden text-estate-ink">
        <Mesh />
        {/* Stage, centred in the space under the caption band */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 z-10" style={{ top }}>
          <Stage p={p} scale={scale} shift={shift} zoom={scale < 0.7 ? 0.14 : 0.04} lift={scale < 0.7 ? 150 : 20} />
        </div>

        <div className="relative z-20 pt-[84px] sm:pt-[96px]">
          {/* Story captions share a band at the top */}
          <div ref={band} className="relative mx-auto h-[150px] w-full max-w-3xl px-4 text-center sm:h-[170px]">
            <Line p={p} from={[0.12, 0.17]} to={[0.28, 0.32]}>
              <Caption title={<>Open your CRM and <span className="sh-accent">know what's next</span>.</>} text="Viewings, arrivals, cleaning and sales in one view, with clear overlap alerts." />
            </Line>
            <Line p={p} from={[0.32, 0.36]} to={[0.46, 0.5]}>
              <Caption title={<>Leads that arrive <span className="sh-accent">qualified</span>.</>} text="Configure authorized Instagram lead qualification and viewing scheduling workflows. Review qualified leads from your CRM." />
            </Line>
            <Line p={p} from={[0.5, 0.54]} to={[0.7, 0.74]}>
              <Caption title={<>Te avisa <span className="sh-accent">antes</span> de que pase.</>} text="Dos reservas en el mismo piso la misma noche: lo ves en rojo antes de que nadie llegue a la puerta." />
            </Line>
            <Line p={p} from={[0.8, 0.86]}>
              <Caption title={<>Tu inmobiliaria, <span className="sh-accent">en orden</span>.</>} text={
                <span className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-estate-forest px-5 py-2.5 text-base font-semibold text-white">Empezar gratis <ArrowRight className="h-4 w-4" /></button>
                  <Link to="/demo" className="inline-flex items-center gap-2 rounded-full border border-estate-forest/25 bg-white/60 px-5 py-2.5 text-base font-semibold text-estate-forest hover:border-estate-forest">Ver la demo</Link>
                </span>
              } />
            </Line>
          </div>
          {/* Headline: the first thing on screen, it lifts away as you scroll */}
          <motion.div ref={copy} className="absolute inset-x-0 top-[84px] sm:top-[104px]" style={{ opacity: copyOpacity, y: copyY, pointerEvents: copyEvents, visibility: copyVisibility }}>
            <HeroCopy onStart={onStart} />
          </motion.div>
        </div>

        {/* Names of the pieces while they are apart */}
        <ul className="absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-xl flex-wrap justify-center gap-2 px-4 lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-1/2 lg:-translate-y-1/2 lg:flex-col lg:items-start" aria-label="Piezas de la app">
          {PIECES.map(({ key, label }, i) => <LegendItem key={key} p={p} i={i} label={label} />)}
        </ul>

      </div>
    </section>
  );
}
