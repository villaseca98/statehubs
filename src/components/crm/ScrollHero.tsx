import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { ArrowRight, ChevronDown, Plus, Search } from 'lucide-react';
import type { AppKind } from '@shared/blueprint/modules.ts';
import { BRAND } from '@shared/blueprint/look.ts';
import { Logo } from '@/components/brand/Logo';

// Scroll story for /crm: the app itself is the product on the stage. It floats
// tilted, comes apart into its pieces, swaps one piece for another and closes
// back up, front-on, into the one-page layout. Plain UI in CSS 3D, no video:
// sharp on any screen and nothing heavy to download.

// The StateHubs look (see _shared/blueprint/look.ts)
const C = { bg: '#f5f4f0', surface: '#ffffff', border: '#e6e2d9', text: '#1c1a16', muted: '#6e695f', primary: BRAND.red, nav: '#1c1a16', navText: '#bdb7ab' };
const CHIP: Record<string, [string, string]> = {
  blue: ['#dbeafe', '#1d4ed8'], amber: ['#fef3c7', '#b45309'], purple: ['#ede9fe', '#6d28d9'], green: ['#dcfce7', '#15803d'],
  teal: ['#ccfbf1', '#0f766e'], pink: ['#fce7f3', '#be185d'], red: ['#fee2e2', '#b91c1c'], gray: ['#f1f0ec', '#57534e'],
};
const W = 640;
const H = 420;
const NUM = { fontFamily: '"Space Grotesk", ui-sans-serif, sans-serif' } as const;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);
const explodeAt = (v: number) => ease(seg(v, 0.15, 0.4)) * (1 - ease(seg(v, 0.65, 0.82)));
const tiltAt = (v: number) => 1 - ease(seg(v, 0.65, 0.86));
const swapAt = (v: number) => ease(seg(v, 0.47, 0.62));
/** Fades in over [a, b] and out over [c, d]. */
const windowed = (v: number, a: number, b: number, c = 2, d = 3) => seg(v, a, b) * (1 - seg(v, c, d));

function Chip({ color, children }: { color: string; children: ReactNode }) {
  const [bg, fg] = CHIP[color] ?? CHIP.gray;
  return <span className="whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-medium" style={{ background: bg, color: fg }}>{children}</span>;
}

function Card({ title, count, children, style }: { title: string; count?: string; children: ReactNode; style: React.CSSProperties }) {
  return (
    <div className="absolute overflow-hidden p-2.5" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.text }}>
        {title}
        {count && <span className="rounded-full px-1.5 text-[9px] font-normal" style={{ background: C.bg, color: C.muted }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

// ---- the pieces, each drawn where it sits in the assembled page ----------

function Base() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: C.bg, borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.45)' }}>
      <div className="flex h-9 items-center gap-2 px-3 text-[10px]" style={{ background: C.nav, color: C.navText }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: C.primary }}>M</span>
        <span className="text-[11px] font-semibold text-white">Mi CRM</span>
        <span className="rounded border px-1 text-[8px] font-bold uppercase tracking-wider opacity-70">crm</span>
        <span className="ml-2 hidden gap-2.5 sm:flex">{['Leads', 'Embudo', 'Agenda', 'Clientes'].map((l) => <span key={l}>{l}</span>)}</span>
        <span className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'rgba(189,183,171,.14)' }}><Search className="h-2.5 w-2.5" />Buscar en todo</span>
        <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium text-white" style={{ background: C.primary }}><Plus className="h-2.5 w-2.5" />Nuevo</span>
      </div>
    </div>
  );
}

function Figures() {
  const items = [['Leads nuevos', '12'], ['Citas hoy', '4'], ['En el embudo', '18.400 €'], ['Cobrado este mes', '6.250 €']];
  return (
    <div className="absolute grid grid-cols-4 gap-2" style={{ left: 12, right: 12, top: 46, height: 52 }}>
      {items.map(([label, value]) => (
        <div key={label} className="relative overflow-hidden px-2.5 py-1.5" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: C.primary }} />
          <div className="text-[9px]" style={{ color: C.muted }}>{label}</div>
          <div className="text-[17px] font-semibold leading-tight" style={{ ...NUM, color: C.text }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Leads() {
  const rows: [string, string, string, string, string][] = [
    ['Lucía Romero', 'WhatsApp', 'green', 'Llamar hoy', 'amber'],
    ['Taller Hnos. Gil', 'Web', 'teal', 'Enviar presupuesto', 'blue'],
    ['Marta Ruiz', 'Instagram', 'pink', 'Confirmar cita', 'purple'],
    ['Clínica Sol', 'Recomendación', 'purple', 'Llamar hoy', 'amber'],
    ['Pedro Lara', 'Llamada', 'blue', 'Cerrar venta', 'green'],
  ];
  return (
    <Card title="Leads" count="12" style={{ left: 12, top: 108, width: 304, height: 194 }}>
      <div className="flex flex-col">
        {rows.map(([name, origin, oc, next, nc]) => (
          <div key={name} className="flex items-center gap-1.5 py-[5px] text-[10px]" style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
            <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
            <Chip color={oc}>{origin}</Chip>
            <span className="text-[9px]" style={{ color: C.muted }}>→</span>
            <Chip color={nc}>{next}</Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Pipeline() {
  const cols: [string, string, [string, string][]][] = [
    ['Nuevo', 'gray', [['Reforma baño', '2.400 €'], ['Web tienda', '1.200 €']]],
    ['Propuesta', 'blue', [['Mantenimiento', '890 €'], ['Instalación', '3.100 €']]],
    ['Negociación', 'amber', [['Contrato anual', '7.800 €']]],
    ['Ganado', 'green', [['Cocina López', '3.010 €']]],
  ];
  return (
    <Card title="Embudo" count="18.400 €" style={{ left: 324, top: 108, width: 304, height: 194 }}>
      <div className="grid grid-cols-4 gap-1.5">
        {cols.map(([name, color, deals]) => (
          <div key={name} className="flex flex-col gap-1 rounded-lg p-1" style={{ background: C.bg }}>
            <Chip color={color}>{name}</Chip>
            {deals.map(([t, v]) => (
              <div key={t} className="rounded-md bg-white p-1 text-[9px] leading-tight shadow-sm" style={{ border: `1px solid ${C.border}`, color: C.text }}>
                <div className="truncate">{t}</div>
                <div className="font-semibold" style={NUM}>{v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

const LOWER = { left: 12, top: 312, width: 304, height: 96 } as const;

function Agenda() {
  const items: [string, string, string][] = [['10:00', 'Visita · Cocina López', 'teal'], ['12:30', 'Llamada · Lucía Romero', 'blue'], ['17:00', 'Reunión · Clínica Sol', 'purple']];
  return (
    <Card title="Agenda · Hoy" style={LOWER}>
      <div className="flex flex-col gap-1">
        {items.map(([h, t, c]) => (
          <div key={h} className="flex items-center gap-2 rounded-md px-1.5 py-[3px] text-[10px]" style={{ border: `1px solid ${C.border}`, color: C.text }}>
            <span className="w-8 font-semibold" style={NUM}>{h}</span>
            <span className="h-3.5 w-[3px] rounded-full" style={{ background: CHIP[c][1] }} />
            <span className="truncate">{t}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Invoices() {
  const items: [string, string, string, string, string][] = [['F-0142', 'Cocina López', '3.010 €', 'Cobrada', 'green'], ['F-0143', 'Clínica Sol', '1.452 €', 'Pendiente', 'amber'], ['F-0139', 'Hnos. Gil', '726 €', 'Vencida', 'red']];
  return (
    <Card title="Facturas" count="ERP" style={LOWER}>
      <div className="flex flex-col">
        {items.map(([n, c, t, s, col]) => (
          <div key={n} className="flex items-center gap-2 py-[3px] text-[10px]" style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
            <span className="w-11 font-medium" style={NUM}>{n}</span>
            <span className="min-w-0 flex-1 truncate">{c}</span>
            <span className="font-semibold" style={NUM}>{t}</span>
            <Chip color={col}>{s}</Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Automations() {
  const node = (t: string, sub: string, accent = false) => (
    <div className="rounded-lg px-2 py-1 text-center text-[9px] leading-tight" style={{ background: accent ? C.primary : C.bg, color: accent ? '#fff' : C.text, border: `1px solid ${accent ? C.primary : C.border}` }}>
      <div className="font-semibold">{t}</div>
      <div style={{ opacity: 0.75 }}>{sub}</div>
    </div>
  );
  return (
    <Card title="Automatizaciones" count="activa" style={{ ...LOWER, left: 324 }}>
      <div className="flex items-center gap-1 pt-2">
        {node('Lead ganado', 'cuando pasa')}
        <span className="mew-wire relative h-px flex-1" style={{ background: C.border }}><span className="mew-dot" /></span>
        {node('Webhook', 'https://…', true)}
        <span className="mew-wire relative h-px flex-1" style={{ background: C.border }}><span className="mew-dot" style={{ animationDelay: '.7s' }} /></span>
        {node('n8n · Make', 'o Zapier')}
      </div>
    </Card>
  );
}

// ---- layers and story -----------------------------------------------------

const PIECES = [
  { key: 'base', label: 'Tu página', Comp: Base },
  { key: 'cifras', label: 'Cifras del día', Comp: Figures },
  { key: 'leads', label: 'Leads con su siguiente paso', Comp: Leads },
  { key: 'embudo', label: 'Embudo de ventas', Comp: Pipeline },
  { key: 'agenda', label: 'Agenda', Comp: Agenda },
  { key: 'auto', label: 'Automatizaciones', Comp: Automations },
] as const;
const GAP = 70; // px between pieces when apart

function Layer({ p, index, swap, children }: { p: MotionValue<number>; index: number; swap?: 'out' | 'in'; children: ReactNode }) {
  const transform = useTransform(p, (v) => {
    const s = swapAt(v);
    const x = swap === 'out' ? -s * 820 : swap === 'in' ? (1 - s) * 820 : 0;
    return `translate3d(${x}px, 0, ${index * GAP * explodeAt(v)}px)`;
  });
  const opacity = useTransform(p, (v) => (swap === 'out' ? 1 - swapAt(v) : swap === 'in' ? swapAt(v) : 1));
  // A faint sheet behind each piece so it reads as a layer while apart.
  const sheet = useTransform(p, (v) => (index === 0 ? 0 : explodeAt(v)));
  return (
    <motion.div className="absolute inset-0" style={{ transform, opacity, transformStyle: 'preserve-3d' }}>
      <motion.div className="absolute inset-0" style={{ opacity: sheet, borderRadius: 14, background: 'rgba(15,159,174,.05)', border: '1px solid rgba(15,159,174,.45)', boxShadow: '0 0 40px rgba(15,159,174,.12)' }} />
      {children}
    </motion.div>
  );
}

function Line({ p, from, to, children, className = '' }: { p: MotionValue<number>; from: [number, number]; to?: [number, number]; children: ReactNode; className?: string }) {
  const opacity = useTransform(p, (v) => windowed(v, from[0], from[1], to?.[0], to?.[1]));
  const y = useTransform(p, (v) => (1 - seg(v, from[0], from[1])) * 18);
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'));
  return <motion.div className={`absolute inset-x-0 top-0 ${className}`} style={{ opacity, y, pointerEvents }}>{children}</motion.div>;
}

function LegendItem({ p, i, label, out, isNew }: { p: MotionValue<number>; i: number; label: string; out?: boolean; isNew?: boolean }) {
  const start = isNew ? 0.5 : 0.19 + i * 0.035;
  const opacity = useTransform(p, (v) => {
    const shown = seg(v, start, start + 0.04) * (1 - seg(v, 0.64, 0.69));
    return out ? shown * (1 - 0.65 * swapAt(v)) : shown;
  });
  const strike = useTransform(p, (v) => (out && swapAt(v) > 0.5 ? 'line-through' : 'none'));
  return (
    <motion.li className="flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs lg:text-sm" style={{ opacity, textDecoration: strike, borderColor: isNew ? C.primary : 'rgba(255,255,255,.14)', color: isNew ? BRAND.light : 'rgba(255,255,255,.85)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: isNew ? BRAND.light : C.primary }} />
      {label}
    </motion.li>
  );
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / 660, (window.innerHeight - 300) / 470));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return Math.max(0.42, scale);
}

export function ScrollHero({ onChoose, nav }: { onChoose: (kind: AppKind) => void; nav?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const still = useMotionValue(1);
  const p = reduced ? still : scrollYProgress;
  const scale = useStageScale();

  const object = useTransform(p, (v) => {
    const t = tiltAt(v);
    const spin = -34 + 12 * seg(v, 0, 0.62);
    return `translateY(${t * 56}px) rotateX(${56 * t}deg) rotateZ(${spin * t}deg) scale(${0.86 + 0.14 * (1 - t)})`;
  });
  const floor = useTransform(p, (v) => tiltAt(v));
  const glow = useTransform(p, (v) => 0.55 + 0.45 * explodeAt(v));

  return (
    <section ref={ref} aria-label="Así se monta tu CRM" className="relative" style={{ height: reduced ? 'auto' : '420vh', background: '#14120f' }}>
      <style>{`
        .mew-dot{position:absolute;top:-2px;left:0;width:5px;height:5px;border-radius:9999px;background:${C.primary};box-shadow:0 0 8px ${C.primary};animation:mew-run 1.4s linear infinite}
        @keyframes mew-run{from{left:0}to{left:calc(100% - 5px)}}
        @media (prefers-reduced-motion: reduce){.mew-dot{animation:none}}
      `}</style>
      <div className={`${reduced ? 'relative min-h-screen' : 'sticky top-0 h-screen'} flex flex-col overflow-hidden text-white`}>
        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg"><Logo dark /></Link>
          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link to="/demo" className="hover:text-white">Ver demo</Link>
            {nav}
          </nav>
        </header>

        {/* Story lines */}
        <div className="relative z-20 mx-auto h-36 w-full max-w-3xl px-4 text-center md:h-40">
          <Line p={p} from={[-1, 0]} to={[0.12, 0.17]}>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Esto es tu CRM.</h1>
            <p className="mt-3 text-white/65 md:text-lg">Ventas, agenda, facturas y automatizaciones. Y te dice qué toca hoy.</p>
          </Line>
          <Line p={p} from={[0.17, 0.22]} to={[0.42, 0.47]}>
            <p className="text-4xl font-bold tracking-tight md:text-6xl">Hecho de <span style={{ color: BRAND.light }}>piezas</span>.</p>
            <p className="mt-3 text-white/65 md:text-lg">Cada función es una pieza. Solo pones las que usas.</p>
          </Line>
          <Line p={p} from={[0.47, 0.52]} to={[0.62, 0.67]}>
            <p className="text-4xl font-bold tracking-tight md:text-6xl">Pon y quita.</p>
            <p className="mt-3 text-white/65 md:text-lg">¿Ahora también facturas? Entra la pieza. Lo que tenías apuntado no se pierde.</p>
          </Line>
          <Line p={p} from={[0.67, 0.72]} to={[0.82, 0.86]}>
            <p className="text-4xl font-bold tracking-tight md:text-6xl">Y se monta en vivo.</p>
            <p className="mt-3 text-white/65 md:text-lg">Lo ves funcionando antes de crear nada. Y cada cambio tiene vuelta atrás.</p>
          </Line>
          <Line p={p} from={[0.86, 0.92]}>
            <p className="text-3xl font-bold tracking-tight md:text-5xl">Tu CRM o tu ERP, <span style={{ color: BRAND.light }}>montado a piezas</span>.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => onChoose('crm')} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white" style={{ background: C.primary }}>Montar un CRM <ArrowRight className="h-4 w-4" /></button>
              <button onClick={() => onChoose('erp')} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 font-semibold text-white hover:border-white/60">Montar un ERP <ArrowRight className="h-4 w-4" /></button>
            </div>
          </Line>
        </div>

        {/* Stage */}
        <div aria-hidden className="relative z-10 flex flex-1 items-center justify-center" style={{ perspective: 1900 }}>
          <motion.div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full" style={{ opacity: glow, background: 'radial-gradient(circle, rgba(15,159,174,.32) 0%, rgba(15,159,174,0) 65%)' }} />
          {/* Layout box at the scaled size so it stays centred on narrow screens. */}
          <div style={{ width: W * scale, height: H * scale, transformStyle: 'preserve-3d' }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0', transformStyle: 'preserve-3d' }}>
            <motion.div className="relative h-full w-full" style={{ transform: object, transformStyle: 'preserve-3d' }}>
              <motion.div className="absolute" style={{ opacity: floor, left: -180, right: -180, top: -160, bottom: -160, transform: 'translateZ(-60px)', borderRadius: 24,
                backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
                backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)' }} />
              {PIECES.map(({ key, Comp }, i) => (
                <Layer key={key} p={p} index={i} swap={key === 'agenda' ? 'out' : undefined}><Comp /></Layer>
              ))}
              <Layer p={p} index={4} swap="in"><Invoices /></Layer>
            </motion.div>
          </div>
          </div>
        </div>

        {/* Names of the pieces while they are apart */}
        <ul className="relative z-20 mx-auto mb-6 flex max-w-xl flex-wrap justify-center gap-2 px-4 lg:absolute lg:right-8 lg:top-1/2 lg:mb-0 lg:-translate-y-1/2 lg:flex-col lg:items-start" aria-label="Piezas">
          {PIECES.map(({ key, label }, i) => <LegendItem key={key} p={p} i={i} label={label} out={key === 'agenda'} />)}
          <LegendItem p={p} i={6} label="Facturas (pieza de ERP)" isNew />
        </ul>

        {!reduced && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 h-10">
            <Line p={p} from={[-1, 0]} to={[0.04, 0.08]}>
              <span className="flex flex-col items-center text-xs text-white/50">Desliza <ChevronDown className="h-4 w-4 animate-bounce" /></span>
            </Line>
          </div>
        )}
      </div>
    </section>
  );
}
