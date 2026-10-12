import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, BedDouble, CalendarDays, CheckCircle2, Coins, Flame, KeyRound, LogIn, LogOut, MessageCircle, MessagesSquare, Moon, Phone, Sparkles, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { computeOps } from '@/lib/crm/ops';
import type { AlertKind, NightInstagram, OpsKind, OpsLine } from '@/lib/crm/ops';
import { itemsOn, matchesFor, monthOccupancy, monthlySeries, weekDays } from '@/lib/crm/estate';
import type { DayItem, MonthPoint } from '@/lib/crm/estate';
import { dayOf } from '@/lib/crm/today';
import { chipStyle, titleOfRecord } from './theme';
import { whatsappUrl } from './actions';
import { Photo } from './Photo';

// Centro de la agencia: the money of the year, the property to push, how full
// the flats are, what needs a look, today, the listings, the week's agenda,
// the hot contacts and the deals by stage. All read from the records.

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money = (v: number) => eur.format(Math.round(v));
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} k€` : `${Math.round(v)} €`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '·';

const KIND: Record<OpsKind, { label: string; icon: LucideIcon; color: string }> = {
  llegada: { label: 'Llegada', icon: LogIn, color: '#1f7a55' },
  salida: { label: 'Salida', icon: LogOut, color: '#9a6a07' },
  servicio: { label: 'Servicio', icon: Sparkles, color: '#0f766e' },
  cita: { label: 'Cita', icon: CalendarDays, color: '#1f5c45' },
};
const ALERT: Record<AlertKind, { icon: LucideIcon; color: string }> = {
  solape: { icon: AlertTriangle, color: '#b42318' },
  sin_limpieza: { icon: Sparkles, color: '#9a6a07' },
  incidencia: { icon: AlertTriangle, color: '#b42318' },
  cobro: { icon: Coins, color: '#9a6a07' },
  seguimiento: { icon: Flame, color: '#c2410c' },
  confirmar: { icon: CalendarDays, color: '#a15c07' },
};
const DAY_KIND: Record<DayItem['kind'], string> = { cita: 'Visita o cita', llegada: 'Llegada', salida: 'Salida', servicio: 'Servicio' };

function Panel({ title, icon: Icon, count, action, children, className = '' }: { title: string; icon?: LucideIcon; count?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`min-w-0 ${className}`} style={{ ...card, padding: '18px 16px' }}>
      <h2 className="mb-3 flex items-center gap-2 px-1 text-[1.05em] font-semibold tracking-tight">
        {Icon && <Icon className="h-4 w-4" style={{ color: 'var(--crm-primary)' }} />} {title}
        {count !== undefined && <span className="rounded-full px-2 text-[0.78em] font-medium" style={{ background: 'var(--crm-soft)', color: 'var(--crm-primary)' }}>{count}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </h2>
      {children}
    </section>
  );
}

function Chip({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: LucideIcon; tone?: 'up' | 'warn' }) {
  return (
    <div className="flex min-w-0 items-center gap-3" style={{ ...card, padding: '12px 14px', borderRadius: 999 }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--crm-soft)', color: 'var(--crm-primary)' }}><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[0.82em]" style={{ color: 'var(--crm-muted)' }}>{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[1.35em] font-semibold leading-tight tracking-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{value}</span>
          <span className="truncate rounded-full px-1.5 text-[0.74em] font-medium" style={tone === 'warn' ? { background: '#fdecc8', color: '#7a4b00' } : { background: 'var(--crm-accent)', color: '#1d2a12' }}>{sub}</span>
        </span>
      </span>
    </div>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold" style={{ width: size, height: size, fontSize: size * 0.36, background: 'var(--crm-soft)', color: 'var(--crm-primary)', border: '2px solid var(--crm-surface)' }} aria-hidden>
      {initials(name)}
    </span>
  );
}

// Twelve months of income and costs as two soft areas.
function MoneyChart({ points }: { points: MonthPoint[] }) {
  const W = 600;
  const H = 180;
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.costs))) * 1.12;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
  const y = (v: number) => H - (v / max) * H;
  // A smooth curve through the months (Catmull-Rom turned into Béziers).
  const line = (k: 'income' | 'costs') => {
    const P = points.map((p, i) => [x(i), y(p[k])]);
    return P.map(([px, py], i) => {
      if (!i) return `M${px.toFixed(1)},${py.toFixed(1)}`;
      const [ax, ay] = P[i - 2] ?? P[i - 1];
      const [bx, by] = P[i - 1];
      const [dx, dy] = P[i + 1] ?? [px, py];
      const c1 = [bx + (px - ax) / 6, Math.min(H, by + (py - ay) / 6)];
      const c2 = [px - (dx - bx) / 6, Math.min(H, py - (dy - by) / 6)];
      return `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  };
  const area = (k: 'income' | 'costs') => `${line(k)} L${W},${H} L0,${H} Z`;
  const last = points[points.length - 1];
  const total = points.reduce((s, p) => s + p.income, 0);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="text-[2em] font-semibold leading-none tracking-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{money(total)}</div>
          <div className="mt-1 text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>Ingresos de los últimos 12 meses</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.82em]" style={{ color: 'var(--crm-muted)' }}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--crm-primary)' }} /> Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#b8c24a' }} /> Gastos</span>
          {last && <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: 'var(--crm-accent)', color: '#1d2a12' }}>Este mes {short(last.income)}</span>}
        </div>
      </div>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[200px] w-full lg:h-[250px]" role="img" aria-label={`Ingresos y gastos por mes. Este mes: ${money(last?.income ?? 0)} de ingresos y ${money(last?.costs ?? 0)} de gastos.`}>
          <defs>
            <linearGradient id="ops-in" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--crm-primary)" stopOpacity="0.32" /><stop offset="1" stopColor="var(--crm-primary)" stopOpacity="0" /></linearGradient>
            <linearGradient id="ops-out" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b8c24a" stopOpacity="0.3" /><stop offset="1" stopColor="#b8c24a" stopOpacity="0" /></linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--crm-border)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
          <path d={area('income')} fill="url(#ops-in)" />
          <path d={area('costs')} fill="url(#ops-out)" />
          <path d={line('income')} fill="none" stroke="var(--crm-primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d={line('costs')} fill="none" stroke="#b8c24a" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {last && (
          <span className="pointer-events-none absolute -translate-x-full -translate-y-full whitespace-nowrap rounded-xl px-2.5 py-1 text-[0.8em] font-semibold text-white shadow" style={{ left: '100%', top: `${(y(last.income) / H) * 100}%`, background: 'var(--crm-primary)' }}>
            {short(last.income)}
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[0.76em]" style={{ color: 'var(--crm-muted)' }}>
        {points.map((p, i) => <span key={p.month} className={i % 2 && points.length > 7 ? 'hidden sm:inline' : ''}>{p.label}</span>)}
      </div>
    </div>
  );
}

function Donut({ parts, center, sub }: { parts: { value: number; color: string }[]; center: string; sub: string }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const R = 42;
  const C = 2 * Math.PI * R;
  let at = 0;
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--crm-bg)" strokeWidth="12" />
        {parts.map((p, i) => {
          const len = (p.value / total) * C;
          const el = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={p.color} strokeWidth="12" strokeLinecap={len > 2 ? 'round' : 'butt'} strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-at} />;
          at += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[1.9em] font-semibold leading-none tracking-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{center}</div>
          <div className="mt-1 text-[0.78em]" style={{ color: 'var(--crm-muted)' }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Line({ line, onOpen }: { line: OpsLine; onOpen: (r: AppRecord) => void }) {
  const k = KIND[line.kind];
  return (
    <li>
      <button onClick={() => onOpen(line.record)} className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[color:var(--crm-bg)]" style={line.done ? { opacity: 0.55 } : undefined}>
        <span className="w-11 shrink-0 text-[0.86em] font-medium tabular-nums" style={{ color: 'var(--crm-muted)' }}>{line.time ?? '—'}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `${k.color}18`, color: k.color }}><k.icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{line.title}</span>
            {line.done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#1f7a55' }} aria-label="Hecho" />}
          </span>
          <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{[k.label, line.place, line.detail].filter(Boolean).join(' · ')}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
      </button>
    </li>
  );
}

export function OpsView({ blueprint, records, onOpen, now }: { blueprint: Blueprint; records: AppRecord[]; onOpen: (r: AppRecord) => void; now?: Date }) {
  const at = useMemo(() => now ?? new Date(), [now]);
  const ops = useMemo(() => computeOps(blueprint, records, at), [blueprint, records, at]);
  const today = dayOf(at);
  const ent = (k: string) => blueprint.entities.find((e) => e.key === k);
  const inmueble = ent('inmueble');
  const operacion = ent('operacion');
  const contacto = ent('contacto_inmo');
  const { reservas, operaciones, contactos, inmuebles, titles } = useMemo(() => {
    const has = (k: string) => blueprint.entities.some((e) => e.key === k);
    const of = (k: string) => (has(k) ? records.filter((r) => r.entity === k) : []);
    const m = new Map<string, string>();
    for (const r of records) m.set(r.id, titleOfRecord(blueprint.entities.find((e) => e.key === r.entity), r.data));
    return { reservas: of('reserva'), operaciones: of('operacion'), contactos: of('contacto_inmo'), inmuebles: of('inmueble'), titles: m };
  }, [blueprint, records]);
  const flats = inmuebles.filter((r) => r.data.operacion === 'turistico');
  const nameOf = (id: unknown) => (id ? titles.get(String(id)) : undefined);
  const opt = (entity: typeof inmueble, field: string, value: unknown) => entity?.fields.find((f) => f.key === field)?.options?.find((o) => o.value === value);

  const raw = at.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = raw.charAt(0).toUpperCase() + raw.slice(1);
  const monthName = at.toLocaleDateString('es-ES', { month: 'long' });

  const count = (k: OpsKind) => ops.today.filter((l) => l.kind === k).length;
  const parts = [
    count('llegada') ? plural(count('llegada'), 'llegada', 'llegadas') : '',
    count('salida') ? plural(count('salida'), 'salida', 'salidas') : '',
    count('servicio') ? plural(count('servicio'), 'servicio', 'servicios') : '',
    count('cita') ? plural(count('cita'), 'cita', 'citas') : '',
  ].filter(Boolean);
  const headline = parts.length
    ? `Hoy: ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]}.`
    : 'Hoy no hay entradas, salidas ni citas.';

  const series = useMemo(() => (reservas.length || operaciones.length ? monthlySeries(reservas, operaciones, at) : []), [reservas, operaciones, at]);
  const month = flats.length ? monthOccupancy(flats, reservas, at) : undefined;

  // The property to push: the first featured one that isn't a holiday flat, else the first.
  const hero = ops.featured.find((r) => r.data.operacion !== 'turistico') ?? ops.featured[0];
  const heroMatches = hero ? matchesFor(hero, contactos) : [];
  const heroDeals = hero ? operaciones.filter((o) => o.data.inmueble === hero.id) : [];
  const gallery = inmuebles.filter((r) => r.id !== hero?.id && r.data.foto).slice(0, 3);

  const listings = inmuebles
    .filter((r) => !/^(vendido|alquilado|retirado)$/.test(str(r.data.estado)))
    .sort((a, b) => Number(!!b.data.exclusiva) - Number(!!a.data.exclusiva) || str(b.data.captado).localeCompare(str(a.data.captado)))
    .slice(0, 6);

  const days = weekDays(at);
  const [picked, setPicked] = useState(today);
  const agenda = itemsOn(picked, records, nameOf);
  const busyDays = new Set(days.filter((d) => itemsOn(d, records, nameOf).length));

  const hot = contactos
    .filter((r) => r.data.temperatura === 'caliente' || r.data.temperatura === 'templado')
    .sort((a, b) => Number(b.data.temperatura === 'caliente') - Number(a.data.temperatura === 'caliente') || num(b.data.presupuesto) - num(a.data.presupuesto))
    .slice(0, 4);

  const stages = ops.funnel?.stages ?? [];
  const maxStage = Math.max(1, ...stages.map((s) => s.amount));
  const topStage = stages.reduce<{ value: string; amount: number } | undefined>((best, s) => (s.amount > (best?.amount ?? 0) ? s : best), undefined)?.value;

  const hasToday = !!(ent('reserva') || ent('servicio') || ent('cita_inmo'));
  const hasAgenda = !!(ent('cita_inmo') || ent('reserva'));
  const priceOf = (r: AppRecord) => {
    const tourist = r.data.operacion === 'turistico';
    const p = tourist ? r.data.precio_noche : r.data.precio;
    return typeof p === 'number' ? `${money(p)}${tourist ? ' / noche' : r.data.operacion === 'alquiler' ? ' / mes' : ''}` : '—';
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>{date}</p>
          <p className="mt-0.5 text-[1.12em] font-medium leading-snug">{headline}</p>
        </div>
        {ops.alerts.length > 0 && (
          <span className="rounded-full px-3 py-1 text-[0.86em] font-medium" style={{ background: '#fde7e4', color: '#9b1c12' }}>
            {plural(ops.alerts.length, 'aviso necesita', 'avisos necesitan')} que lo mires
          </span>
        )}
      </header>

      {ops.instagram && <NightCard night={ops.instagram} blueprint={blueprint} onOpen={onOpen} />}

      <section aria-label="Cifras del día" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ops.occupancy && (
          <Chip icon={BedDouble} label="Ocupación hoy" value={ops.occupancy.total ? `${Math.round((ops.occupancy.busy / ops.occupancy.total) * 100)} %` : '—'}
            sub={ops.occupancy.total ? `${ops.occupancy.busy}/${ops.occupancy.total}` : 'sin pisos'} />
        )}
        {ops.income && <Chip icon={Wallet} label={`Neto de ${monthName}`} value={short(ops.income.net)} sub={plural(ops.income.bookings, 'reserva', 'reservas')} />}
        {ops.pipeline && <Chip icon={KeyRound} label="Embudo abierto" value={short(ops.pipeline.open)} sub={`${ops.pipeline.count} abiertas`} />}
        {ops.pipeline && <Chip icon={Coins} label="Comisión prevista" value={short(ops.pipeline.commission)} sub="ponderada" />}
        {ops.hot && <Chip icon={Flame} label="Contactos calientes" value={String(ops.hot.hot)} sub={`de ${ops.hot.active}`} tone={ops.hot.hot ? undefined : 'warn'} />}
      </section>

      {(series.length > 0 || hero) && (
        <div className="grid items-stretch gap-4 lg:grid-cols-12">
          {series.length > 0 && (
            <Panel title="Ingresos y gastos" icon={Wallet} className={hero ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <MoneyChart points={series} />
            </Panel>
          )}
          {hero && (
            <section aria-label="Inmueble destacado" className={`min-w-0 overflow-hidden ${series.length ? 'lg:col-span-5' : 'lg:col-span-12'}`} style={card}>
              <button onClick={() => onOpen(hero)} className="relative block w-full text-left" aria-label={`Abrir ${titleOfRecord(inmueble, hero.data)}`}>
                <Photo src={hero.data.foto} label={str(hero.data.referencia)} className="h-52 w-full sm:h-60" />
                <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.78em] font-semibold" style={{ background: 'var(--crm-accent)', color: '#1d2a12' }}>
                  {hero.data.exclusiva ? 'En exclusiva' : opt(inmueble, 'estado', hero.data.estado)?.label ?? 'Destacado'}
                </span>
                {gallery.length > 0 && (
                  <span className="absolute bottom-3 right-3 flex gap-1.5">
                    {gallery.map((g) => <Photo key={g.id} src={g.data.foto} small className="h-10 w-12 rounded-lg border-2 border-white" />)}
                    {inmuebles.length - 1 - gallery.length > 0 && <span className="grid h-10 w-12 place-items-center rounded-lg border-2 border-white text-[0.8em] font-semibold text-white" style={{ background: 'rgba(15,46,34,.75)' }}>+{inmuebles.length - 1 - gallery.length}</span>}
                  </span>
                )}
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[1.15em] font-semibold tracking-tight">{titleOfRecord(inmueble, hero.data)}</h2>
                    <p className="truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{[str(hero.data.zona), opt(inmueble, 'tipo', hero.data.tipo)?.label].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="shrink-0 text-[1.15em] font-semibold tabular-nums" style={{ color: 'var(--crm-primary)' }}>{priceOf(hero)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {([['Hab.', hero.data.habitaciones], ['Baños', hero.data.banos], ['m²', hero.data.metros]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-2xl py-2" style={{ background: 'var(--crm-bg)' }}>
                      <dt className="text-[0.76em]" style={{ color: 'var(--crm-muted)' }}>{k}</dt>
                      <dd className="font-semibold tabular-nums">{v === undefined || v === null || v === '' ? '—' : String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  {heroMatches.length > 0 ? (
                    <>
                      <span className="flex -space-x-2">{heroMatches.slice(0, 4).map((c) => <Avatar key={c.id} name={titleOfRecord(contacto, c.data)} size={28} />)}</span>
                      <span className="text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>Encaja con {plural(heroMatches.length, 'contacto', 'contactos')}</span>
                    </>
                  ) : <span className="text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>Aún no encaja con ningún contacto</span>}
                  <span className="ml-auto text-[0.86em] font-medium">{plural(heroDeals.length, 'operación', 'operaciones')}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'var(--crm-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, heroDeals.length ? 25 + heroDeals.length * 25 : heroMatches.length ? 15 : 4)}%`, background: 'linear-gradient(90deg, var(--crm-primary), var(--crm-accent))' }} />
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {(month || ops.alerts.length > 0 || hasToday) && (
        <div className="grid items-start gap-4 lg:grid-cols-12">
          {month && (
            <Panel title={`Ocupación de ${monthName}`} icon={BedDouble} className="lg:col-span-3">
              <Donut
                parts={[{ value: month.booked, color: 'var(--crm-primary)' }, { value: month.blocked, color: 'var(--crm-accent)' }]}
                center={`${month.total ? Math.round(((month.booked + month.blocked) / month.total) * 100) : 0} %`}
                sub={plural(month.booked, 'noche vendida', 'noches vendidas')}
              />
              <ul className="mt-3 flex flex-col gap-1.5 px-1 text-[0.86em]">
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--crm-primary)' }} /> Reservadas <span className="ml-auto font-medium tabular-nums">{month.booked}</span></li>
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--crm-accent)' }} /> Bloqueadas <span className="ml-auto font-medium tabular-nums">{month.blocked}</span></li>
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }} /> Libres <span className="ml-auto font-medium tabular-nums">{month.free}</span></li>
              </ul>
            </Panel>
          )}
          {ops.alerts.length > 0 && (
            <Panel title="Avisos" icon={AlertTriangle} count={ops.alerts.length} className={month ? 'lg:col-span-4' : 'lg:col-span-5'}>
              <ul className="flex flex-col gap-1">
                {ops.alerts.slice(0, 6).map((a) => {
                  const k = ALERT[a.kind];
                  return (
                    <li key={a.id}>
                      <button onClick={() => onOpen(a.record)} className="flex w-full items-start gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[color:var(--crm-bg)]">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `${k.color}16`, color: k.color }}><k.icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug">{a.title}</span>
                          <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{a.detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {ops.alerts.length > 6 && <p className="mt-1 px-2 text-[0.84em]" style={{ color: 'var(--crm-muted)' }}>y {ops.alerts.length - 6} más</p>}
            </Panel>
          )}
          {hasToday && (
            <Panel title="Hoy" icon={CalendarDays} count={ops.today.length} className={month && ops.alerts.length ? 'lg:col-span-5' : month || ops.alerts.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
              {ops.today.length
                ? <ul className="flex flex-col">{ops.today.map((l) => <Line key={l.id} line={l} onOpen={onOpen} />)}</ul>
                : <p className="px-1 py-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>Nada programado para hoy.</p>}
            </Panel>
          )}
        </div>
      )}

      {(listings.length > 0 || hasAgenda) && (
        <div className="grid items-start gap-4 lg:grid-cols-12">
          {listings.length > 0 && (
            <Panel title="Cartera activa" icon={KeyRound} count={listings.length} className={hasAgenda ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-left text-[0.92em]">
                  <thead>
                    <tr className="text-[0.82em]" style={{ color: 'var(--crm-muted)' }}>
                      <th className="px-2 py-1 font-medium">Inmueble</th>
                      <th className="px-2 py-1 font-medium">Tipo</th>
                      <th className="px-2 py-1 font-medium">Precio</th>
                      <th className="px-2 py-1 font-medium">Interesados</th>
                      <th className="px-2 py-1 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((r) => {
                      const m = matchesFor(r, contactos);
                      const st = opt(inmueble, 'estado', r.data.estado);
                      return (
                        <tr key={r.id} className="transition hover:bg-[color:var(--crm-bg)]">
                          <td className="rounded-l-2xl px-2 py-1.5">
                            <button onClick={() => onOpen(r)} className="flex min-w-0 items-center gap-3 text-left">
                              <Photo src={r.data.foto} small label={str(r.data.referencia)} className="h-11 w-14 shrink-0 rounded-xl" />
                              <span className="min-w-0">
                                <span className="block max-w-[220px] truncate font-medium">{titleOfRecord(inmueble, r.data)}</span>
                                <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{str(r.data.zona)}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-2 py-1.5">{opt(inmueble, 'operacion', r.data.operacion)?.label ?? '—'}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-medium tabular-nums">{priceOf(r)}</td>
                          <td className="px-2 py-1.5">
                            {m.length ? (
                              <span className="flex items-center gap-2">
                                <span className="flex -space-x-2">{m.slice(0, 3).map((c) => <Avatar key={c.id} name={titleOfRecord(contacto, c.data)} size={26} />)}</span>
                                <span className="text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{m.length}</span>
                              </span>
                            ) : <span style={{ color: 'var(--crm-muted)' }}>—</span>}
                          </td>
                          <td className="rounded-r-2xl px-2 py-1.5">
                            {st ? <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[0.82em] font-medium" style={chipStyle(st.color, false)}>{st.label}</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {hasAgenda && (
            <Panel title="Agenda de la semana" icon={CalendarDays} className={listings.length ? 'lg:col-span-4' : 'lg:col-span-12'}>
              <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
                {days.map((d) => {
                  const dt = new Date(`${d}T00:00:00`);
                  const on = d === picked;
                  return (
                    <button key={d} onClick={() => setPicked(d)} aria-pressed={on} aria-label={dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                      className="relative flex flex-col items-center rounded-2xl py-2 text-[0.8em] transition"
                      style={on ? { background: 'var(--crm-primary)', color: '#fff' } : { background: 'var(--crm-bg)', color: d === today ? 'var(--crm-primary)' : 'var(--crm-text)' }}>
                      <span className="opacity-80">{dt.toLocaleDateString('es-ES', { weekday: 'narrow' })}</span>
                      <span className="text-[1.25em] font-semibold tabular-nums">{dt.getDate()}</span>
                      {busyDays.has(d) && <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: on ? 'var(--crm-accent)' : 'var(--crm-primary)' }} />}
                    </button>
                  );
                })}
              </div>
              {agenda.length ? (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {agenda.map((i) => (
                    <li key={i.id}>
                      <button onClick={() => onOpen(i.record)} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:brightness-95" style={{ background: i.kind === 'cita' ? 'var(--crm-soft)' : 'var(--crm-bg)' }}>
                        <span className="w-11 shrink-0 text-[0.86em] font-semibold tabular-nums" style={{ color: 'var(--crm-primary)' }}>{i.time || '—'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{i.title}</span>
                          <span className="block truncate text-[0.82em]" style={{ color: 'var(--crm-muted)' }}>{DAY_KIND[i.kind]}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 px-1 text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>Día libre.</p>}
            </Panel>
          )}
        </div>
      )}

      {(hot.length > 0 || stages.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-12">
          {hot.length > 0 && (
            <Panel title="Contactos para llamar hoy" icon={Flame} count={hot.length} className={stages.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {hot.map((c) => {
                  const nm = [titleOfRecord(contacto, c.data), str(c.data.apellidos)].filter(Boolean).join(' ');
                  const phone = str(c.data.telefono);
                  const temp = opt(contacto, 'temperatura', c.data.temperatura);
                  return (
                    <li key={c.id} className="min-w-0 rounded-2xl p-3" style={{ background: 'var(--crm-bg)' }}>
                      <button onClick={() => onOpen(c)} className="flex w-full min-w-0 items-center gap-3 text-left">
                        <Avatar name={nm} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{nm}</span>
                          <span className="block truncate text-[0.84em]" style={{ color: 'var(--crm-muted)' }}>
                            {[opt(contacto, 'tipo', c.data.tipo)?.label, num(c.data.presupuesto) ? short(num(c.data.presupuesto)) : '', str(c.data.zonas)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {temp && <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.76em] font-medium" style={chipStyle(temp.color, false)}>{temp.label}</span>}
                      </button>
                      {str(c.data.proxima_accion) && <p className="mt-2 truncate text-[0.86em]">{str(c.data.proxima_accion)}</p>}
                      {phone && (
                        <div className="mt-2.5 flex gap-2">
                          <a href={`tel:${phone.replace(/\s/g, '')}`} aria-label={`Llamar a ${nm}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[0.84em] font-medium text-white" style={{ background: 'var(--crm-primary)' }}><Phone className="h-3.5 w-3.5" /> Llamar</a>
                          <a href={whatsappUrl(phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${nm}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[0.84em] font-medium" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          {stages.length > 0 && ops.funnel && (
            <Panel title="Operaciones por etapa" icon={ArrowUpRight} count={ops.pipeline?.count} className={hot.length ? 'lg:col-span-5' : 'lg:col-span-12'}>
              <div className="flex h-48 items-end gap-2 px-1" role="list" aria-label="Importe por etapa">
                {stages.map((s) => {
                  const top = s.value === topStage;
                  return (
                    <div key={s.value} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${s.label}: ${plural(s.count, 'operación', 'operaciones')} · ${money(s.amount)}`}>
                      <span className="text-[0.76em] font-semibold tabular-nums" style={{ color: top ? 'var(--crm-primary)' : 'var(--crm-muted)' }}>{s.amount ? short(s.amount) : '0'}</span>
                      <div className="w-full max-w-[44px] rounded-2xl" style={{ height: `${s.amount ? Math.max(8, (s.amount / maxStage) * 72) : 4}%`, background: top ? 'var(--crm-primary)' : 'var(--crm-soft)' }} />
                      <span className="w-full truncate text-center text-[0.74em]" style={{ color: 'var(--crm-muted)' }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 px-1 text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>
                {plural(ops.funnel.won, 'cerrada', 'cerradas')} · {plural(ops.funnel.lost, 'perdida', 'perdidas')}
                {ops.funnel.active[0] && <> · siguiente cierre: <button className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--crm-text)' }} onClick={() => onOpen(ops.funnel!.active[0])}>{titleOfRecord(operacion, ops.funnel.active[0].data)}</button></>}
              </p>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

// «Esta noche por Instagram»: what the assistant left done while everyone slept.
function NightCard({ night, blueprint, onOpen }: { night: NightInstagram; blueprint: Blueprint; onOpen: (r: AppRecord) => void }) {
  const conv = blueprint.entities.find((e) => e.key === 'conversacion');
  const estado = conv?.fields.find((f) => f.key === 'estado');
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const parts = [n(night.qualified, 'cualificado', 'cualificados'), n(night.booked, 'agendado', 'agendados'), ...(night.reserved ? [n(night.reserved, 'reserva', 'reservas')] : [])];
  return (
    <section aria-label="Esta noche por Instagram" className="relative overflow-hidden" style={{ ...card, padding: '16px 16px 14px' }}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(180deg, var(--crm-primary), var(--crm-accent))' }} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--crm-primary)', color: 'var(--crm-accent)' }}><Moon className="h-[18px] w-[18px]" /></span>
        <h2 className="min-w-0 flex-1 text-[1.08em] font-semibold leading-snug">
          {night.leads
            ? <>Esta noche por Instagram: {n(night.leads, 'lead', 'leads')}, {parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]}.</>
            : 'Esta noche no ha entrado nadie por Instagram.'}
        </h2>
        {night.human > 0 && <span className="rounded-full px-2 py-0.5 text-[0.82em] font-medium" style={chipStyle('amber', false)}>{n(night.human, 'espera', 'esperan')} a una persona</span>}
      </div>
      {night.top.length > 0 && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {night.top.map((r) => {
            const o = estado?.options?.find((x) => x.value === r.data.estado);
            const user = String(r.data.usuario ?? '');
            return (
              <li key={r.id} className="min-w-0">
                <button onClick={() => onOpen(r)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-[color:var(--crm-bg)]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.85em] font-semibold" style={{ background: 'var(--crm-soft)', color: 'var(--crm-primary)' }}>{(String(r.data.nombre || user.slice(1)) || '?').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-medium">{user}</span>{o && <span className="shrink-0 rounded-full px-1.5 text-[0.78em] font-medium" style={chipStyle(o.color, false)}>{o.label}</span>}</span>
                    <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{String(r.data.resumen ?? '')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 flex items-center gap-1.5 pl-1 text-[0.82em]" style={{ color: 'var(--crm-muted)' }}><MessagesSquare className="h-3.5 w-3.5" /> Las ves todas en la Bandeja de Instagram.</p>
    </section>
  );
}
