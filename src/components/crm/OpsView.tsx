import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, BedDouble, Building2, CalendarDays, CheckCircle2, Coins, Flame, KeyRound, LogIn, LogOut, Sparkles, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { BRAND } from '@shared/blueprint/look.ts';
import { computeOps } from '@/lib/crm/ops';
import type { AlertKind, OpsKind, OpsLine } from '@/lib/crm/ops';
import { dayOf } from '@/lib/crm/today';
import { chipStyle, titleOfRecord } from './theme';

// Centro de operaciones: today's arrivals, departures, cleanings and visits,
// the open deals and what needs a look, all read from the records.

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money = (v: number) => eur.format(Math.round(v));

const KIND: Record<OpsKind, { label: string; icon: LucideIcon; color: string }> = {
  llegada: { label: 'Llegada', icon: LogIn, color: '#15803d' },
  salida: { label: 'Salida', icon: LogOut, color: '#a15c07' },
  servicio: { label: 'Servicio', icon: Sparkles, color: '#0f766e' },
  cita: { label: 'Cita', icon: CalendarDays, color: '#6d28d9' },
};
const ALERT: Record<AlertKind, { icon: LucideIcon; color: string }> = {
  solape: { icon: AlertTriangle, color: '#b91c1c' },
  sin_limpieza: { icon: Sparkles, color: '#a15c07' },
  incidencia: { icon: AlertTriangle, color: '#b91c1c' },
  cobro: { icon: Coins, color: '#a15c07' },
  seguimiento: { icon: Flame, color: '#c2410c' },
};

function Panel({ title, icon: Icon, count, children, className = '' }: { title: string; icon: LucideIcon; count?: number; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`min-w-0 ${className}`} style={{ ...card, padding: '16px 14px' }}>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[1.02em] font-semibold">
        <Icon className="h-4 w-4" style={{ color: 'var(--crm-muted)' }} /> {title}
        {count !== undefined && <span className="ml-auto rounded-full px-2 text-[0.8em] font-medium" style={{ background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, icon: Icon, bar }: { label: string; value: string; sub: string; icon: LucideIcon; bar?: number }) {
  return (
    <div className="min-w-0" style={{ ...card, padding: '14px 16px' }}>
      <div className="flex items-center gap-2 text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--crm-bg)' }}><Icon className="h-4 w-4" /></span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-[1.85em] font-semibold leading-tight tracking-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{value}</div>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--crm-bg)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, bar))}%`, background: `linear-gradient(90deg, ${BRAND.from}, ${BRAND.to})` }} />
        </div>
      )}
      <div className="mt-1.5 truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>{sub}</div>
    </div>
  );
}

function Line({ line, onOpen, showTime = true }: { line: OpsLine; onOpen: (r: AppRecord) => void; showTime?: boolean }) {
  const k = KIND[line.kind];
  return (
    <li>
      <button onClick={() => onOpen(line.record)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--crm-bg)]" style={line.done ? { opacity: 0.55 } : undefined}>
        {showTime && <span className="w-11 shrink-0 text-[0.88em] tabular-nums" style={{ color: 'var(--crm-muted)' }}>{line.time ?? '—'}</span>}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${k.color}14`, color: k.color }}><k.icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{line.title}</span>
            {line.done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#15803d' }} aria-label="Hecho" />}
          </span>
          <span className="block truncate text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>
            {[k.label, line.place, line.detail].filter(Boolean).join(' · ')}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
      </button>
    </li>
  );
}

const weekday = (day: string, today: string) => {
  const d = new Date(`${day}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  if (Math.round((d.getTime() - t.getTime()) / 864e5) === 1) return 'Mañana';
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function OpsView({ blueprint, records, onOpen, now }: { blueprint: Blueprint; records: AppRecord[]; onOpen: (r: AppRecord) => void; now?: Date }) {
  const ops = useMemo(() => computeOps(blueprint, records, now), [blueprint, records, now]);
  const today = dayOf(now ?? new Date());
  const ent = (k: string) => blueprint.entities.find((e) => e.key === k);
  const inmueble = ent('inmueble');
  const operacion = ent('operacion');
  const raw = (now ?? new Date()).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = raw.charAt(0).toUpperCase() + raw.slice(1);
  const monthName = (now ?? new Date()).toLocaleDateString('es-ES', { month: 'long' });

  const count = (k: OpsKind) => ops.today.filter((l) => l.kind === k).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    count('llegada') ? plural(count('llegada'), 'llegada', 'llegadas') : '',
    count('salida') ? plural(count('salida'), 'salida', 'salidas') : '',
    count('servicio') ? plural(count('servicio'), 'servicio', 'servicios') : '',
    count('cita') ? plural(count('cita'), 'cita', 'citas') : '',
  ].filter(Boolean);
  const headline = parts.length
    ? `Hoy: ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]}.`
    : 'Hoy no hay entradas, salidas ni citas.';

  const hasToday = !!(ent('reserva') || ent('servicio') || ent('cita_inmo'));
  const hasWeek = !!(ent('reserva') || ent('cita_inmo'));
  const maxStage = Math.max(1, ...(ops.funnel?.stages.map((s) => s.amount) ?? [0]));
  const stageOpt = (r: AppRecord) => operacion?.fields.find((f) => f.key === 'etapa')?.options?.find((o) => o.value === r.data.etapa);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>{date}</p>
        <h2 className="mt-0.5 text-[1.2em] font-medium leading-snug md:text-[1.3em]" style={{ fontFamily: 'var(--crm-heading-font)' }}>{headline}</h2>
        {ops.alerts.length > 0 && <p className="mt-1 text-[0.95em]" style={{ color: '#b91c1c' }}>{plural(ops.alerts.length, 'aviso necesita', 'avisos necesitan')} que lo mires.</p>}
      </header>

      <section aria-label="Cifras del día" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ops.occupancy && (
          <Kpi icon={BedDouble} label="Ocupación hoy" value={ops.occupancy.total ? `${Math.round((ops.occupancy.busy / ops.occupancy.total) * 100)} %` : '—'}
            bar={ops.occupancy.total ? (ops.occupancy.busy / ops.occupancy.total) * 100 : 0}
            sub={ops.occupancy.total ? `${ops.occupancy.busy} de ${plural(ops.occupancy.total, 'alojamiento', 'alojamientos')}` : 'Sin alojamientos turísticos'} />
        )}
        {ops.income && (
          <Kpi icon={Wallet} label={`Ingresos netos de ${monthName}`} value={money(ops.income.net)}
            sub={`${money(ops.income.gross)} brutos · ${plural(ops.income.bookings, 'reserva', 'reservas')}`} />
        )}
        {ops.pipeline && <Kpi icon={KeyRound} label="Embudo abierto" value={money(ops.pipeline.open)} sub={plural(ops.pipeline.count, 'operación abierta', 'operaciones abiertas')} />}
        {ops.pipeline && <Kpi icon={Coins} label="Comisión prevista" value={money(ops.pipeline.commission)} sub="Ponderada por probabilidad" />}
        {ops.hot && <Kpi icon={Flame} label="Contactos calientes" value={String(ops.hot.hot)} sub={`de ${plural(ops.hot.active, 'contacto activo', 'contactos activos')}`} />}
      </section>

      {(hasToday || ops.alerts.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {hasToday && (
            <Panel title="Hoy" icon={CalendarDays} count={ops.today.length} className={ops.alerts.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
              {ops.today.length
                ? <ul className="flex flex-col">{ops.today.map((l) => <Line key={l.id} line={l} onOpen={onOpen} />)}</ul>
                : <p className="px-1 py-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>Nada programado para hoy.</p>}
            </Panel>
          )}
          {ops.alerts.length > 0 && (
            <Panel title="Avisos" icon={AlertTriangle} count={ops.alerts.length} className={hasToday ? '' : 'lg:col-span-3'}>
              <ul className="flex flex-col gap-1">
                {ops.alerts.map((a) => {
                  const k = ALERT[a.kind];
                  return (
                    <li key={a.id}>
                      <button onClick={() => onOpen(a.record)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--crm-bg)]">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${k.color}14`, color: k.color }}><k.icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug">{a.title}</span>
                          <span className="block truncate text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>{a.detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {ops.funnel && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel title="Embudo" icon={KeyRound} count={ops.pipeline?.count}>
            <ul className="flex flex-col gap-2.5 px-1" aria-label="Importe por etapa">
              {ops.funnel.stages.map((s) => (
                <li key={s.value} title={`${s.label}: ${plural(s.count, 'operación', 'operaciones')} · ${money(s.amount)}`}>
                  <div className="flex items-baseline justify-between gap-2 text-[0.9em]">
                    <span className="truncate">{s.label} <span style={{ color: 'var(--crm-muted)' }}>· {s.count}</span></span>
                    <span className="shrink-0 tabular-nums font-medium">{money(s.amount)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: 'var(--crm-bg)' }}>
                    <div className="h-full rounded-full" style={{ width: `${s.amount ? Math.max(3, (s.amount / maxStage) * 100) : 0}%`, background: 'var(--crm-primary)' }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 px-1 text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>
              {plural(ops.funnel.won, 'cerrada', 'cerradas')} · {plural(ops.funnel.lost, 'perdida', 'perdidas')}
            </p>
          </Panel>
          <Panel title="Operaciones activas" icon={ArrowRight} className="lg:col-span-2">
            {ops.funnel.active.length ? (
              <ul className="flex flex-col">
                {ops.funnel.active.map((r) => {
                  const o = stageOpt(r);
                  return (
                    <li key={r.id}>
                      <button onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--crm-bg)]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{titleOfRecord(operacion, r.data)}</span>
                          <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>
                            {[typeof r.data.probabilidad === 'number' ? `${r.data.probabilidad} %` : '', typeof r.data.cierre === 'string' ? `cierre ${new Date(`${r.data.cierre}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {o && <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[0.8em] font-medium sm:inline" style={chipStyle(o.color, false)}>{o.label}</span>}
                        <span className="w-24 shrink-0 text-right font-medium tabular-nums">{typeof r.data.importe === 'number' ? money(r.data.importe) : '—'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-1 py-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>No hay operaciones abiertas.</p>}
          </Panel>
        </div>
      )}

      {(hasWeek || ops.featured.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {hasWeek && (
            <Panel title="Esta semana" icon={CalendarDays} count={ops.week.reduce((s, d) => s + d.items.length, 0)} className={ops.featured.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
              {ops.week.some((d) => d.items.length) ? (
                <div className="flex flex-col gap-3">
                  {ops.week.filter((d) => d.items.length).map((d) => (
                    <div key={d.day}>
                      <h3 className="px-1 text-[0.82em] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-muted)' }}>{weekday(d.day, today)}</h3>
                      <ul className="flex flex-col">{d.items.map((l) => <Line key={l.id} line={l} onOpen={onOpen} />)}</ul>
                    </div>
                  ))}
                </div>
              ) : <p className="px-1 py-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>Nada en los próximos 7 días.</p>}
            </Panel>
          )}
          {ops.featured.length > 0 && (
            <Panel title="Inmuebles destacados" icon={Building2} className={hasWeek ? '' : 'lg:col-span-3'}>
              <ul className="flex flex-col gap-2.5">
                {ops.featured.map((r) => {
                  const tourist = r.data.operacion === 'turistico';
                  const price = tourist ? r.data.precio_noche : r.data.precio;
                  const op = inmueble?.fields.find((f) => f.key === 'operacion')?.options?.find((o) => o.value === r.data.operacion);
                  return (
                    <li key={r.id}>
                      <button onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-[color:var(--crm-bg)]">
                        <Thumb record={r} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{titleOfRecord(inmueble, r.data)}</span>
                          <span className="block truncate text-[0.86em]" style={{ color: 'var(--crm-muted)' }}>
                            {[op?.label, typeof r.data.zona === 'string' ? r.data.zona : '', r.data.exclusiva ? 'En exclusiva' : ''].filter(Boolean).join(' · ')}
                          </span>
                          {typeof price === 'number' && <span className="block font-semibold tabular-nums">{money(price)}{tourist ? ' / noche' : r.data.operacion === 'alquiler' ? ' / mes' : ''}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({ record }: { record: AppRecord }) {
  const src = typeof record.data.foto === 'string' && /^https?:\/\//.test(record.data.foto) ? record.data.foto : '';
  const ref = typeof record.data.referencia === 'string' ? record.data.referencia : '';
  return src
    ? <img src={src} alt="" loading="lazy" className="h-14 w-16 shrink-0 rounded-lg object-cover" />
    : (
      <span className="grid h-14 w-16 shrink-0 place-items-center rounded-lg text-[0.8em] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})` }}>
        {ref || <Building2 className="h-5 w-5" />}
      </span>
    );
}
