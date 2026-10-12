import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, MessageCircle, Phone, Sun } from 'lucide-react';
import type { AppRecord, Blueprint, DashboardWidget } from '@shared/blueprint/types.ts';
import { computeToday } from '@/lib/crm/today';
import type { TodayItem } from '@/lib/crm/today';
import { chipStyle, formatMoney, formatValue } from './theme';
import { whatsappUrl } from './actions';

// The home screen: what needs doing, not every table at once.

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;

function figure(w: DashboardWidget, bp: Blueprint, records: AppRecord[]): string {
  const rs = records.filter((r) => r.entity === w.entity);
  if (w.agg === 'count') return String(rs.length);
  const vals = rs.map((r) => Number(r.data[w.field ?? '']) || 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  const v = w.agg === 'avg' ? (vals.length ? sum / vals.length : 0) : sum;
  const f = bp.entities.find((e) => e.key === w.entity)?.fields.find((x) => x.key === w.field);
  return f?.type === 'money' ? formatMoney(v) : f ? formatValue(f, v) : String(Math.round(v));
}

function Row({ item, dark, onOpen }: { item: TodayItem; dark: boolean; onOpen: (r: AppRecord) => void }) {
  const late = dark ? '#fb923c' : '#c2410c';
  const tone = item.bucket === 'atrasado' ? late : item.bucket === 'hoy' ? 'var(--crm-primary)' : 'var(--crm-border)';
  return (
    <li className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[color:var(--crm-bg)]">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: tone }} />
      <button onClick={() => onOpen(item.record)} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{item.title}</span>
          <span className="hidden shrink-0 rounded-full px-2 py-px text-[0.78em] sm:inline" style={chipStyle(item.stage?.color ?? 'gray', dark)}>
            {item.stage?.label ?? item.entity.label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[0.9em]" style={{ color: item.bucket === 'atrasado' ? late : 'var(--crm-muted)' }}>
          {item.reason.startsWith(item.entity.label) ? item.reason : `${item.entity.label} · ${item.reason}`}
        </span>
      </button>
      {item.phone && (
        <span className="flex shrink-0 gap-1">
          <a href={whatsappUrl(item.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${item.title}`} className="rounded-full p-2 hover:bg-[color:var(--crm-bg)]" style={{ color: dark ? '#4ade80' : '#15803d' }}><MessageCircle className="h-4 w-4" /></a>
          <a href={`tel:${item.phone.replace(/\s/g, '')}`} aria-label={`Llamar a ${item.title}`} className="hidden rounded-full p-2 hover:bg-[color:var(--crm-bg)] sm:block" style={{ color: 'var(--crm-muted)' }}><Phone className="h-4 w-4" /></a>
        </span>
      )}
      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
    </li>
  );
}

function Group({ title, icon: Icon, items, empty, onOpen, accent, dark }: { title: string; icon: typeof Sun; items: TodayItem[]; empty: string; onOpen: (r: AppRecord) => void; accent?: string; dark: boolean }) {
  return (
    <section aria-label={title} className="min-w-0" style={{ ...card, padding: '14px 10px' }}>
      <h2 className="mb-1 flex items-center gap-2 px-3 text-[1.02em] font-semibold">
        <Icon className="h-4 w-4" style={{ color: accent ?? 'var(--crm-muted)' }} /> {title}
        <span className="ml-auto rounded-full px-2 text-[0.8em] font-medium" style={{ background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>{items.length}</span>
      </h2>
      {items.length ? (
        <ul className="flex flex-col">{items.map((i) => <Row key={i.id} item={i} dark={dark} onOpen={onOpen} />)}</ul>
      ) : (
        <p className="px-3 py-3 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>{empty}</p>
      )}
    </section>
  );
}

export function TodayView({ blueprint, records, onOpen, now, dark = false }: { blueprint: Blueprint; records: AppRecord[]; onOpen: (r: AppRecord) => void; now?: Date; dark?: boolean }) {
  const today = useMemo(() => computeToday(blueprint, records, now), [blueprint, records, now]);
  const metrics = (blueprint.views.find((v) => v.type === 'dashboard')?.widgets ?? []).filter((w) => w.kind === 'metric').slice(0, 4);
  const raw = (now ?? new Date()).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = raw.charAt(0).toUpperCase() + raw.slice(1);
  const pending = today.hoy.length + today.atrasado.length;
  const line = pending === 0
    ? 'Nada pendiente para hoy. Buen momento para mirar lo que viene.'
    : `${today.hoy.length ? `${today.hoy.length} ${today.hoy.length === 1 ? 'cosa' : 'cosas'} para hoy` : 'Hoy está despejado'}${today.atrasado.length ? ` y ${today.atrasado.length} ${today.atrasado.length === 1 ? 'atrasada' : 'atrasadas'}` : ''}.`;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>{date}</p>
        <h1 className="mt-1 text-[1.9em] font-semibold leading-tight tracking-tight" style={{ fontFamily: 'var(--crm-heading-font)' }}>{line}</h1>
      </header>

      {metrics.length > 0 && (
        <section aria-label="Cifras" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((w) => (
            <div key={w.label} style={{ ...card, padding: '12px 14px' }}>
              <div className="text-[0.85em]" style={{ color: 'var(--crm-muted)' }}>{w.label}</div>
              <div className="mt-0.5 text-[1.55em] font-semibold leading-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{figure(w, blueprint, records)}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {today.atrasado.length > 0 && <Group title="Atrasado" icon={AlertTriangle} accent={dark ? '#fb923c' : '#c2410c'} dark={dark} items={today.atrasado} empty="" onOpen={onOpen} />}
          <Group title="Para hoy" icon={Sun} dark={dark} accent="var(--crm-primary)" items={today.hoy} empty="Nada para hoy." onOpen={onOpen} />
        </div>
        <Group title="Próximos días" icon={CalendarClock} dark={dark} items={today.proximo} empty="Nada en los próximos días." onOpen={onOpen} />
      </div>

      {today.total === 0 && (
        <p className="flex items-center gap-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>
          <CheckCircle2 className="h-4 w-4" /> Cuando apuntes citas, fechas de entrega o vencimientos, aparecerán aquí solos.
        </p>
      )}
    </div>
  );
}
