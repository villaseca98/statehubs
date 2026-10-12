import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { AppShowcase } from '@/components/crm/AppShowcase';
import { ease, seg, showcaseLayers, win } from '@/components/crm/showcase';
import type { ShowcaseMotion } from '@/components/crm/showcase';
import { composeApp, modulesFor, sampleRecordsFor, STARTER } from '@shared/blueprint/modules.ts';
import { DEMO_APPS } from '@shared/blueprint/samples.ts';
import { BRAND, LOOK } from '@shared/blueprint/look.ts';
import { LogoMark } from '@/components/brand/Logo';
import { computeToday } from '@/lib/crm/today';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';

// Vertical ads (1080×1920) for StateHubs, made with the same 3D engine the
// landing uses, from real apps the builder produces.
// /reels lists them, /reels/:key plays one on a loop. For export, open it
// with ?capture=1 and drive the clock with window.__reel.set(seconds).

const CW = 1080;
const CH = 1920;
const APP = { width: 1180, height: 760 };
const TEAL = BRAND.red;
const TEAL_LIGHT = BRAND.light;

interface AppSource { blueprint: Blueprint; records: AppRecord[] }
interface Beat { from: number; to: number; title: ReactNode; sub?: ReactNode; focus?: string }
interface ReelDef {
  key: string;
  name: string;
  about: string;
  duration: number;
  endAt: number;
  apps: AppSource[];
  appAt?: (t: number) => number;
  motion: Omit<ShowcaseMotion, 'focus'>;
  beats: Beat[];
  /** Names of the pieces shown as pills while they are apart: [from, to]. */
  pills?: [number, number];
  overlay?: (t: MotionValue<number>) => ReactNode;
  gap?: number;
  maxLayers?: number;
}

const house = (kind: 'crm' | 'erp', modules?: string[], name?: string): AppSource => {
  const blueprint = composeApp(kind, name ?? `StateHubs ${kind.toUpperCase()}`, modules ?? modulesFor(kind).map((m) => m.key));
  return { blueprint, records: sampleRecordsFor(blueprint) };
};
const HOY_APP = house('crm', ['panel', 'leads', 'agenda', 'operaciones', 'facturas', 'documentos']);

const T = ({ children }: { children: ReactNode }) => <span style={{ color: TEAL_LIGHT }}>{children}</span>;

// Common camera: comes in front-on, tilts, opens up, closes, goes flat.
const camera = (open: number, close: number) => ({
  tilt: (t: number) => win(t, open - 0.9, open, close, close + 1),
  explode: (t: number) => win(t, open - 0.2, open + 1.2, close - 0.6, close + 0.6),
  spin: (t: number) => 20 * ease(seg(t, open - 0.9, close + 1)),
  zoom: (t: number) => 0.8 + 0.2 * ease(seg(t, 0, 1.4)),
});

const REELS: ReelDef[] = [
  {
    key: 'marca', name: 'Toda tu empresa en una página', about: 'El CRM de la casa se despieza: leads, embudo y agenda.',
    duration: 14, endAt: 11, apps: [house('crm')], pills: [2.9, 9.2], maxLayers: 7,
    motion: camera(2.6, 9.6),
    beats: [
      { from: -1, to: 2.3, title: <>Tu empresa entera.</>, sub: 'En una sola página.' },
      { from: 2.5, to: 4.9, title: <>Hecha de <T>piezas</T>.</>, sub: 'Solo pones las que usas.' },
      { from: 5.0, to: 6.9, title: <>Cada lead, con su <T>siguiente paso</T>.</>, focus: 'leads' },
      { from: 6.9, to: 8.8, title: <>Tu embudo, <T>en euros</T>.</>, focus: 'embudo' },
      { from: 9.0, to: 10.8, title: <>Y lo cambias <T>cuando quieras</T>.</>, sub: 'Cada versión, con vuelta atrás.' },
    ],
  },
  {
    key: 'erp', name: 'Facturas, pedidos y stock', about: 'El ERP de la casa: cobros, pedidos e inventario.',
    duration: 14, endAt: 11, apps: [house('erp')], pills: [2.9, 9.2], maxLayers: 7,
    motion: camera(2.6, 9.6),
    beats: [
      { from: -1, to: 2.3, title: <>Facturas, pedidos y stock.</>, sub: 'Sin un solo Excel.' },
      { from: 2.5, to: 4.9, title: <>Tu <T>ERP</T>, a piezas.</>, sub: 'Montado para tu negocio.' },
      { from: 5.0, to: 6.9, title: <>Sabes quién te debe <T>y desde cuándo</T>.</>, focus: 'facturas' },
      { from: 6.9, to: 8.8, title: <>Te avisa cuando <T>falta stock</T>.</>, focus: 'inventario' },
      { from: 9.0, to: 10.8, title: <>Todo el negocio, <T>de un vistazo</T>.</> },
    ],
  },
  {
    key: 'piezas', name: 'Móntalo pieza a pieza', about: 'Las piezas llegan una a una y el CRM se monta solo.',
    duration: 14, endAt: 11, apps: [house('crm', STARTER.crm)], pills: [1.6, 9.2], gap: 150,
    motion: {
      tilt: (t) => win(t, 0, 0.6, 9.2, 10.2),
      explode: (t) => win(t, 0, 0.6, 8.2, 9.4),
      spin: (t) => 22 * ease(seg(t, 0, 10.2)),
      reveal: (t, i) => ease(seg(t, 1.2 + i * 0.95, 1.9 + i * 0.95)),
    },
    beats: [
      { from: -1, to: 3.4, title: <>Monta tu CRM</>, sub: <>pieza a pieza.</> },
      { from: 3.5, to: 6.4, title: <>¿Agenda? <T>Dentro.</T></>, sub: '¿Embudo? Dentro. ¿Clientes? También.' },
      { from: 6.5, to: 8.4, title: <>Quitas una pieza</>, sub: 'y tus datos siguen ahí.' },
      { from: 8.6, to: 10.8, title: <>Lo ves <T>funcionar</T> al momento.</> },
    ],
  },
  {
    key: 'hoy', name: 'Abres y sabes qué toca', about: 'La pantalla «Hoy»: citas, lo atrasado y lo que viene, sin buscar en tablas.',
    duration: 14, endAt: 11, apps: [HOY_APP],
    motion: { tilt: (t) => 1 - 0.25 * ease(seg(t, 0, 10)), explode: (t) => 0.25 * win(t, 0.3, 1.5, 9.5, 10.6), spin: (t) => 18 * ease(seg(t, 0, 11)), zoom: (t) => 0.92 - 0.06 * ease(seg(t, 1.4, 2.4)) },
    beats: [
      { from: -1, to: 2.3, title: <>Abres tu CRM</>, sub: <>y te dice <T>qué toca hoy</T>.</> },
      { from: 2.5, to: 5.6, title: <>Lo <T>atrasado</T>, primero.</>, sub: 'Cobros vencidos, citas sin cerrar, tareas pasadas de fecha.' },
      { from: 5.7, to: 8.4, title: <>Lo de <T>hoy</T>, con un toque.</>, sub: 'WhatsApp o llamada desde la misma lista.' },
      { from: 8.5, to: 10.8, title: <>Y lo que <T>viene</T>.</>, sub: 'Sin buscar en tablas.' },
    ],
    overlay: (t) => <TodayOverlay t={t} />,
  },
  {
    key: 'sectores', name: 'Para tu sector', about: 'Inmobiliaria, clínica, distribución y agencia.',
    duration: 13.5, endAt: 10.8, apps: DEMO_APPS.map((d) => ({ blueprint: d.blueprint, records: d.records })),
    appAt: (t) => Math.min(DEMO_APPS.length - 1, Math.max(0, Math.floor((t - 0.9) / 2.3))),
    motion: {
      tilt: (t) => win(t, 0.4, 1.2, 9.8, 10.6),
      explode: (t) => (t < 0.9 || t > 10.1 ? 0 : 0.85 * Math.sin(Math.PI * Math.min(1, ((t - 0.9) % 2.3) / 2.3))),
      spin: (t) => 22 * ease(seg(t, 0.4, 10.6)),
    },
    beats: [
      { from: -1, to: 0.9, title: <>¿Cuál es tu sector?</> },
      { from: 9.4, to: 10.8, title: <>¿El tuyo? <T>A medida.</T></> },
    ],
    overlay: (t) => <SectorLabel t={t} />,
    gap: 120,
  },
  {
    key: 'ia', name: 'Cuéntaselo a la IA', about: 'Lo pides hablando, ves la propuesta y se monta.',
    duration: 15, endAt: 12, apps: [{ blueprint: DEMO_APPS[1].blueprint, records: DEMO_APPS[1].records }], gap: 140,
    motion: {
      tilt: (t) => win(t, 5.8, 6.6, 10.6, 11.6),
      explode: (t) => win(t, 6.2, 7.0, 10.0, 11.0),
      spin: (t) => 20 * ease(seg(t, 5.8, 11.6)),
      reveal: (t, i) => ease(seg(t, 6.0 + i * 0.45, 6.6 + i * 0.45)),
      zoom: (t) => 0.92 + 0.08 * ease(seg(t, 6, 8)),
    },
    beats: [
      { from: -1, to: 5.6, title: <>Cuéntaselo.</>, sub: <>La IA te monta el <T>CRM</T>.</> },
      { from: 5.8, to: 8.6, title: <>Ves la propuesta <T>antes</T>.</>, sub: 'Nada se aplica sin tu OK.' },
      { from: 8.7, to: 11.6, title: <>Y lo cambias <T>hablando</T>.</>, sub: '«Añade la provincia a pacientes».' },
    ],
    overlay: (t) => <ChatOverlay t={t} blueprint={DEMO_APPS[1].blueprint} />,
  },
  {
    key: 'empresa', name: 'Toda la empresa dentro', about: 'Operaciones, procesos, documentos y automatizaciones.',
    duration: 14.5, endAt: 11.5, apps: [house('crm', ['panel', 'operaciones', 'documentos', 'automatizaciones', 'proyectos'], 'Tu empresa')],
    pills: [2.9, 8.5], maxLayers: 7, motion: camera(2.6, 10),
    beats: [
      { from: -1, to: 2.3, title: <>No es solo vender.</>, sub: <>Es <T>toda</T> tu empresa.</> },
      { from: 2.5, to: 4.6, title: <>Tareas con <T>responsable</T>.</>, focus: 'operaciones' },
      { from: 4.6, to: 6.4, title: <>Procesos <T>paso a paso</T>.</>, focus: 'procesos' },
      { from: 6.4, to: 8.2, title: <>Documentos que avisan <T>antes de caducar</T>.</>, focus: 'documentos' },
      { from: 8.2, to: 11.2, title: <>Cuando pasa algo, <T>avisa a tu n8n</T>.</>, sub: 'También Make o Zapier.', focus: 'automatizaciones' },
    ],
    overlay: (t) => <WebhookOverlay t={t} from={8.6} to={11.2} />,
  },
];

// ---- pieces of the canvas ---------------------------------------------------

function Wordmark({ size = 44 }: { size?: number }) {
  return (
    <span className="inline-flex items-center font-bold tracking-tight text-white" style={{ fontSize: size, gap: size * 0.32 }}>
      <LogoMark size={size * 1.15} />
      <span>state<span style={{ background: `linear-gradient(90deg, ${BRAND.from}, ${BRAND.to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>hubs</span></span>
    </span>
  );
}

function Caption({ t, beat }: { t: MotionValue<number>; beat: Beat }) {
  const opacity = useTransform(t, (v) => win(v, beat.from, beat.from + 0.35, beat.to - 0.3, beat.to));
  const y = useTransform(t, (v) => (1 - ease(seg(v, beat.from, beat.from + 0.45))) * 30);
  return (
    <motion.div className="absolute inset-x-0 top-0 px-16 text-center" style={{ opacity, y }}>
      <div className="font-bold leading-[1.05] tracking-tight text-white" style={{ fontSize: 88 }}>{beat.title}</div>
      {beat.sub && <div className="mt-6 text-white/70" style={{ fontSize: 44 }}>{beat.sub}</div>}
    </motion.div>
  );
}

function Pill({ t, label, at, until }: { t: MotionValue<number>; label: string; at: number; until: number }) {
  const opacity = useTransform(t, (v) => win(v, at, at + 0.3, until - 0.3, until));
  const scale = useTransform(t, (v) => 0.85 + 0.15 * ease(seg(v, at, at + 0.3)));
  return (
    <motion.span className="inline-flex items-center gap-3 rounded-full border px-6 py-3 text-white/90" style={{ opacity, scale, fontSize: 30, borderColor: 'rgba(255,255,255,.18)', background: 'rgba(255,255,255,.04)' }}>
      <span className="h-3 w-3 rounded-full" style={{ background: TEAL_LIGHT }} />{label}
    </motion.span>
  );
}

function TodayOverlay({ t }: { t: MotionValue<number> }) {
  const today = useMemo(() => computeToday(HOY_APP.blueprint, HOY_APP.records), []);
  const groups: { key: string; title: string; color: string; items: typeof today.hoy; at: number }[] = [
    { key: 'a', title: 'Atrasado', color: '#fb923c', items: today.atrasado.slice(0, 2), at: 2.7 },
    { key: 'h', title: 'Para hoy', color: TEAL_LIGHT, items: today.hoy.slice(0, 2), at: 5.9 },
    { key: 'p', title: 'Próximos días', color: 'rgba(255,255,255,.55)', items: today.proximo.slice(0, 1), at: 8.7 },
  ];
  return (
    <div className="absolute flex flex-col gap-5" style={{ left: 80, right: 80, top: 690 }}>
      {groups.map(({ key, ...g }) => <TodayGroup key={key} t={t} {...g} />)}
    </div>
  );
}
function TodayGroup({ t, title, color, items, at }: { t: MotionValue<number>; title: string; color: string; items: ReturnType<typeof computeToday>['hoy']; at: number }) {
  const opacity = useTransform(t, (v) => win(v, at, at + 0.4, 10.4, 10.9));
  const x = useTransform(t, (v) => (1 - ease(seg(v, at, at + 0.5))) * 60);
  return (
    <motion.div className="rounded-[34px] p-6" style={{ opacity, x, background: 'rgba(20,18,15,.82)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(10px)', boxShadow: '0 30px 80px rgba(0,0,0,.45)' }}>
      <div className="mb-3 flex items-center gap-3 font-semibold text-white" style={{ fontSize: 30 }}>
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />{title}
      </div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-4 border-t py-3" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
          <span className="h-12 w-1.5 rounded-full" style={{ background: color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-white" style={{ fontSize: 32 }}>{i.title}</span>
            <span className="block truncate text-white/60" style={{ fontSize: 26 }}>{i.reason.startsWith(i.entity.label) ? i.reason : `${i.entity.label} · ${i.reason}`}</span>
          </span>
          {i.phone && <span className="rounded-full px-5 py-2 font-semibold" style={{ fontSize: 24, background: '#dcf5e6', color: '#15803d' }}>WhatsApp</span>}
        </div>
      ))}
    </motion.div>
  );
}

function SectorLabel({ t }: { t: MotionValue<number> }) {
  return (
    <div className="absolute inset-x-0" style={{ top: 330 }}>
      {DEMO_APPS.map((d, i) => {
        const a = 0.9 + i * 2.3;
        return <SectorBeat key={d.key} t={t} from={a} to={a + 2.3} title={d.sector.replace(' (ERP)', '')} sub={d.pitch} />;
      })}
    </div>
  );
}
function SectorBeat({ t, from, to, title, sub }: { t: MotionValue<number>; from: number; to: number; title: string; sub: string }) {
  return <Caption t={t} beat={{ from, to, title: <T>{title}</T>, sub }} />;
}

const ASK = 'Tengo una clínica dental. Quiero pacientes por WhatsApp, citas y presupuestos.';

function ChatOverlay({ t, blueprint }: { t: MotionValue<number>; blueprint: Blueprint }) {
  const typed = useTransform(t, (v) => ASK.slice(0, Math.round(ASK.length * seg(v, 0.5, 2.6))));
  const opacity = useTransform(t, (v) => 1 - ease(seg(v, 5.6, 6.2)));
  const y = useTransform(t, (v) => -ease(seg(v, 5.6, 6.2)) * 60);
  const dots = useTransform(t, (v) => win(v, 2.7, 2.9, 3.3, 3.5));
  const answer = useTransform(t, (v) => ease(seg(v, 3.4, 3.8)));
  const pressed = useTransform(t, (v) => (v > 5.0 ? 1 : 0));
  const btnScale = useTransform(t, (v) => (v > 4.9 && v < 5.2 ? 0.94 : 1));
  const hint = useTransform(pressed, (p) => 1 - p);
  const added = blueprint.entities.map((e) => e.labelPlural);
  return (
    <motion.div className="absolute flex flex-col gap-6" style={{ left: 90, right: 90, top: 720, opacity, y }}>
      <div className="ml-auto max-w-[760px] rounded-[36px] rounded-br-lg px-9 py-7 text-white" style={{ background: TEAL, fontSize: 38, lineHeight: 1.3 }}>
        <motion.span>{typed}</motion.span>
      </div>
      <motion.div className="flex gap-3 pl-4" style={{ opacity: dots }}>
        {[0, 1, 2].map((i) => <span key={i} className="h-4 w-4 animate-pulse rounded-full bg-white/60" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </motion.div>
      <motion.div className="max-w-[820px] rounded-[36px] rounded-bl-lg bg-white px-9 py-8" style={{ opacity: answer, color: '#1c1a16' }}>
        <div className="flex items-center gap-3 font-semibold" style={{ fontSize: 34 }}><Sparkles className="h-8 w-8" style={{ color: TEAL }} /> Te propongo esto:</div>
        <div className="mt-5 flex flex-wrap gap-3">
          {added.map((l) => <span key={l} className="rounded-full px-5 py-2 font-medium" style={{ fontSize: 30, background: '#dcf5e6', color: '#15803d' }}>+ {l}</span>)}
          <span className="rounded-full px-5 py-2 font-medium" style={{ fontSize: 30, background: '#e3efff', color: '#1d4ed8' }}>+ Agenda</span>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <motion.span className="inline-flex items-center gap-2 rounded-2xl px-7 py-3 font-semibold text-white" style={{ fontSize: 32, background: TEAL, scale: btnScale }}>
            <Check className="h-7 w-7" /> Aplicar
          </motion.span>
          <motion.span className="text-[#6e695f]" style={{ fontSize: 28, opacity: hint }}>Puedes deshacerlo</motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WebhookOverlay({ t, from, to }: { t: MotionValue<number>; from: number; to: number }) {
  const opacity = useTransform(t, (v) => win(v, from, from + 0.4, to - 0.4, to));
  const dot = useTransform(t, (v) => `${(((v - from) * 0.9) % 1) * 100}%`);
  const node = (title: string, sub: string, accent = false) => (
    <div className="rounded-3xl px-7 py-5 text-center" style={{ background: accent ? TEAL : 'rgba(255,255,255,.08)', border: `1px solid ${accent ? TEAL : 'rgba(255,255,255,.2)'}`, color: '#fff' }}>
      <div className="font-semibold" style={{ fontSize: 32 }}>{title}</div>
      <div className="text-white/70" style={{ fontSize: 24 }}>{sub}</div>
    </div>
  );
  const wire = (
    <div className="relative h-[3px] flex-1 rounded-full bg-white/20">
      <motion.span className="absolute -top-[7px] h-4 w-4 rounded-full" style={{ left: dot, background: TEAL_LIGHT, boxShadow: `0 0 18px ${TEAL_LIGHT}` }} />
    </div>
  );
  return (
    <motion.div className="absolute flex items-center gap-4" style={{ left: 70, right: 70, top: 1470, opacity }}>
      {node('Lead ganado', 'en tu CRM')}{wire}{node('Webhook', 'https://…', true)}{wire}{node('n8n · Make', 'o Zapier')}
    </motion.div>
  );
}

function EndCard({ t, at }: { t: MotionValue<number>; at: number }) {
  const opacity = useTransform(t, (v) => ease(seg(v, at, at + 0.5)));
  const y = useTransform(t, (v) => (1 - ease(seg(v, at, at + 0.6))) * 40);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center" style={{ opacity, y }}>
      <Wordmark size={96} />
      <div className="mt-12 font-bold leading-[1.08] tracking-tight text-white" style={{ fontSize: 80 }}>Tu CRM o tu ERP,<br /><T>montado a piezas</T>.</div>
      <div className="mt-14 inline-flex items-center gap-4 rounded-full px-12 py-6 font-semibold text-white" style={{ fontSize: 44, background: TEAL, boxShadow: `0 20px 60px color-mix(in srgb, ${TEAL} 50%, transparent)` }}>
        Pruébalo sin cuenta <ArrowRight className="h-10 w-10" />
      </div>
      <div className="mt-8 text-white/60" style={{ fontSize: 34 }}>Enlace en la bio</div>
    </motion.div>
  );
}

// ---- one reel -----------------------------------------------------------------

function ReelCanvas({ reel, t }: { reel: ReelDef; t: MotionValue<number> }) {
  const [appIdx, setAppIdx] = useState(0);
  useMotionValueEvent(t, 'change', (v) => {
    if (reel.appAt) setAppIdx(reel.appAt(v));
  });
  const app = reel.apps[appIdx];
  const layers = useMemo(() => showcaseLayers(app.blueprint, reel.maxLayers ?? 6), [app.blueprint, reel.maxLayers]);
  const focusBeats = reel.beats.filter((b) => b.focus && layers.some((l) => l.key === b.focus));
  const focus = (v: number): [string, number] | null => {
    const b = focusBeats.find((x) => v >= x.from && v <= x.to);
    return b ? [b.focus!, win(v, b.from, b.from + 0.5, b.to - 0.4, b.to)] : null;
  };
  const stageOpacity = useTransform(t, (v) => 1 - ease(seg(v, reel.endAt - 0.3, reel.endAt + 0.3)));
  const primary = LOOK.colors.primary;
  const scale = 0.8;
  const pills = reel.pills;

  return (
    <div className="relative overflow-hidden" style={{ width: CW, height: CH, background: '#0e0d0b', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div className="absolute rounded-full" style={{ left: CW / 2 - 560, top: 1060 - 560, width: 1120, height: 1120, background: `radial-gradient(circle, color-mix(in srgb, ${primary} 30%, transparent) 0%, transparent 62%)` }} />
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse at 50% 58%, black 10%, transparent 60%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 58%, black 10%, transparent 60%)' }} />

      <motion.div className="absolute inset-x-0 flex justify-center" style={{ top: 1060 - (APP.height * scale) / 2, perspective: 2400, opacity: stageOpacity }}>
        <div style={{ width: APP.width * scale, height: APP.height * scale, transformStyle: 'preserve-3d' }}>
          <div style={{ width: APP.width, height: APP.height, transform: `scale(${scale})`, transformOrigin: '0 0', transformStyle: 'preserve-3d' }}>
            <AppShowcase key={appIdx} blueprint={app.blueprint} records={app.records} p={t} width={APP.width} height={APP.height}
              gap={reel.gap ?? 115} maxLayers={reel.maxLayers ?? 6} panelMax={230} {...reel.motion} focus={focus} />
          </div>
        </div>
      </motion.div>

      <div className="absolute inset-x-0 flex justify-center" style={{ top: 210 }}><Wordmark size={40} /></div>
      <div className="absolute inset-x-0" style={{ top: 330 }}>
        {reel.beats.map((b, i) => <Caption key={i} t={t} beat={b} />)}
      </div>
      {pills && (
        <div className="absolute flex flex-wrap justify-center gap-4" style={{ left: 60, right: 60, top: 1480 }}>
          {layers.map((l, i) => (
            <Pill key={l.key} t={t} label={l.label} until={pills[1]}
              at={reel.motion.reveal ? 1.5 + i * 0.95 : pills[0] + i * 0.35} />
          ))}
        </div>
      )}
      {reel.overlay?.(t)}
      <EndCard t={t} at={reel.endAt} />
    </div>
  );
}

declare global { interface Window { __reel?: { duration: number; set: (s: number) => void; ready: boolean } } }

function ReelPlayer({ reel }: { reel: ReelDef }) {
  const [params] = useSearchParams();
  const capture = params.has('capture');
  const t = useMotionValue(capture ? 0 : 0);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    document.title = `${reel.name} · Reels StateHubs`;
    const resize = () => setFit(capture ? 1 : Math.min(1, window.innerWidth / CW, window.innerHeight / CH));
    resize();
    window.addEventListener('resize', resize);
    window.__reel = { duration: reel.duration, set: (s) => t.set(s), ready: true };
    return () => { window.removeEventListener('resize', resize); delete window.__reel; };
  }, [reel, capture, t]);
  useAnimationFrame((ms) => { if (!capture) t.set((ms / 1000) % reel.duration); });

  return (
    <div className="flex min-h-screen items-start justify-center overflow-hidden" style={{ background: '#000' }}>
      <div style={{ width: CW * fit, height: CH * fit }}>
        <div style={{ width: CW, height: CH, transform: `scale(${fit})`, transformOrigin: '0 0' }}>
          <ReelCanvas reel={reel} t={t} />
        </div>
      </div>
    </div>
  );
}

export default function Reels() {
  const { reelKey } = useParams();
  const reel = REELS.find((r) => r.key === reelKey);
  if (reel) return <ReelPlayer reel={reel} />;
  return (
    <div className="min-h-screen px-4 py-10 text-white" style={{ background: '#0e0d0b' }}>
      <div className="mx-auto max-w-3xl">
        <Wordmark size={32} />
        <h1 className="mt-6 text-3xl font-bold">Reels</h1>
        <p className="mt-2 text-white/60">Anuncios verticales hechos con el mismo motor 3D de la portada.</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {REELS.map((r) => (
            <li key={r.key}>
              <Link to={`/reels/${r.key}`} className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/30">
                <div className="font-semibold">{r.name}</div>
                <div className="mt-1 text-sm text-white/60">{r.about}</div>
                <div className="mt-2 text-xs text-white/40">{r.duration} s · 1080×1920</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

