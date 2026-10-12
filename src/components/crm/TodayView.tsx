import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Home, MessageCircle, Phone, Sun, TrendingUp, Users, Building2, Clock3, Sparkles } from 'lucide-react';
import type { AppRecord, Blueprint, DashboardWidget, Entity } from '@shared/blueprint/types.ts';
import { computeToday } from '@/lib/crm/today';
import type { TodayItem } from '@/lib/crm/today';
import { chipStyle, formatMoney, formatValue } from './theme';
import { whatsappUrl } from './actions';

// The home screen is a work queue first. The real-estate template gets a
// purpose-built, premium overview instead of a generic CRM dashboard.

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

function Row({ item, onOpen }: { item: TodayItem; onOpen: (r: AppRecord) => void }) {
  const tone = item.bucket === 'atrasado' ? '#c2410c' : item.bucket === 'hoy' ? 'var(--crm-primary)' : 'var(--crm-border)';
  return (
    <li className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[color:var(--crm-bg)]">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: tone }} />
      <button onClick={() => onOpen(item.record)} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{item.title}</span>
          <span className="hidden shrink-0 rounded-full px-2 py-px text-[0.78em] sm:inline" style={chipStyle(item.stage?.color ?? 'gray', false)}>
            {item.stage?.label ?? item.entity.label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[0.9em]" style={{ color: item.bucket === 'atrasado' ? '#c2410c' : 'var(--crm-muted)' }}>
          {item.reason.startsWith(item.entity.label) ? item.reason : `${item.entity.label} · ${item.reason}`}
        </span>
      </button>
      {item.phone && (
        <span className="flex shrink-0 gap-1">
          <a href={whatsappUrl(item.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${item.title}`} className="rounded-full p-2 hover:bg-[color:var(--crm-bg)]" style={{ color: '#15803d' }}><MessageCircle className="h-4 w-4" /></a>
          <a href={`tel:${item.phone.replace(/\s/g, '')}`} aria-label={`Llamar a ${item.title}`} className="hidden rounded-full p-2 hover:bg-[color:var(--crm-bg)] sm:block" style={{ color: 'var(--crm-muted)' }}><Phone className="h-4 w-4" /></a>
        </span>
      )}
      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
    </li>
  );
}

function Group({ title, icon: Icon, items, empty, onOpen, accent }: { title: string; icon: typeof Sun; items: TodayItem[]; empty: string; onOpen: (r: AppRecord) => void; accent?: string }) {
  return (
    <section aria-label={title} style={{ ...card, padding: '14px 10px' }}>
      <h2 className="mb-1 flex items-center gap-2 px-3 text-[1.02em] font-semibold">
        <Icon className="h-4 w-4" style={{ color: accent ?? 'var(--crm-muted)' }} /> {title}
        <span className="ml-auto rounded-full px-2 text-[0.8em] font-medium" style={{ background: 'var(--crm-bg)', color: 'var(--crm-muted)' }}>{items.length}</span>
      </h2>
      {items.length ? (
        <ul className="flex flex-col">{items.map((i) => <Row key={i.id} item={i} onOpen={onOpen} />)}</ul>
      ) : (
        <p className="px-3 py-3 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>{empty}</p>
      )}
    </section>
  );
}

function recordTitle(record: AppRecord, entity?: Entity): string {
  const key = entity?.titleField;
  const value = key ? record.data[key] : undefined;
  return String(value || record.data.nombre || record.data.titulo || record.data.referencia || record.data.direccion || entity?.label || 'Sin título');
}

function RealEstateOverview({ blueprint, records, today, onOpen, date }: {
  blueprint: Blueprint; records: AppRecord[]; today: ReturnType<typeof computeToday>;
  onOpen: (r: AppRecord) => void; date: string;
}) {
  const entity = (key: string) => blueprint.entities.find((e) => e.key === key);
  const leads = records.filter((r) => r.entity === 'lead');
  const homes = records.filter((r) => r.entity === 'inmueble');
  const visits = records.filter((r) => r.entity === 'visita' || (r.entity === 'lead' && !!r.data.visita));
  const deals = records.filter((r) => r.entity === 'oportunidad' || r.entity === 'operacion');
  const overdue = today.atrasado.length;
  const followUps = today.hoy.length + overdue;
  const socialLeads = leads.filter((r) => ['instagram', 'meta_ads'].includes(String(r.data.fuente_lead ?? r.data.origen ?? '')));
  const qualifiedLeads = leads.filter((r) => (r.data.estado_cualificacion ?? r.data.estado) === 'cualificado');
  const leadEntity = entity('lead');
  const homeEntity = entity('inmueble');
  const visitEntity = entity('visita');
  const featured = homes.slice(0, 3);
  const urgent = [...today.atrasado, ...today.hoy].slice(0, 5);

  const stats = [
    { label: 'Leads en cartera', value: leads.length, icon: Users, note: 'Compradores y propietarios', tint: '#dce9e5', ink: '#315f52' },
    { label: 'Inmuebles activos', value: homes.length, icon: Home, note: 'En cartera comercial', tint: '#e8e3f6', ink: '#65538c' },
    { label: 'Visitas registradas', value: visits.length, icon: CalendarClock, note: 'Actividad del equipo', tint: '#f5e8d6', ink: '#986b35' },
    { label: 'Leads desde redes', value: socialLeads.length, icon: MessageCircle, note: 'Instagram y Meta Ads', tint: '#f8e1eb', ink: '#9c3f68' },
    { label: 'Leads cualificados', value: qualifiedLeads.length, icon: CheckCircle2, note: 'Con datos suficientes para priorizar', tint: '#dce9e5', ink: '#315f52' },
    { label: 'Seguimientos pendientes', value: followUps, icon: Clock3, note: overdue ? `${overdue} fuera de plazo` : 'Sin retrasos acumulados', tint: overdue ? '#fae1dc' : '#dce9e5', ink: overdue ? '#a84232' : '#315f52' },
  ];

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 pb-8">
      <section className="relative isolate overflow-hidden rounded-[26px] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9 lg:px-10" style={{ background: 'linear-gradient(112deg, #142c2b 0%, #1e4140 55%, #2a5752 100%)' }}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 h-80 w-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute right-8 top-8 -z-10 h-52 w-52 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute right-24 top-24 -z-10 h-24 w-24 rounded-full" style={{ background: 'radial-gradient(circle, rgba(201,220,190,.25), rgba(201,220,190,0))' }} />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-wide text-white/85">
            <Sparkles className="h-3.5 w-3.5 text-[#c7d8ad]" /> CENTRO DE OPERACIONES INMOBILIARIAS
          </div>
          <p className="text-sm text-white/65">{date}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[2.8rem]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>
            Cada oportunidad merece<br className="hidden sm:block" /> un siguiente paso.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
            Tu equipo, tus propiedades y tus próximos cierres en un solo lugar. Detecta qué necesita atención antes de que se enfríe.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-[#d2dfbd] px-4 py-2 text-sm font-semibold text-[#18352f]">
              <TrendingUp className="h-4 w-4" /> {deals.length} operaciones en seguimiento
            </div>
            <span className="text-sm text-white/65">{overdue ? `${overdue} seguimientos requieren atención` : 'Tu actividad comercial, bajo control'}</span>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 hidden h-full w-[34%] items-end justify-center overflow-hidden lg:flex" aria-hidden="true">
          <div className="mb-[-36px] mr-[-22px] flex h-[245px] w-[245px] items-center justify-center rounded-t-full border border-white/15 bg-white/[0.035]">
            <Building2 className="mb-5 h-28 w-28 stroke-[0.8] text-white/25" />
          </div>
        </div>
      </section>

      <section aria-label="Resumen comercial" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl p-4 sm:p-5" style={{ ...card, boxShadow: '0 5px 20px rgba(24,39,36,.025)' }}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm leading-5" style={{ color: 'var(--crm-muted)' }}>{s.label}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: s.tint, color: s.ink }}><s.icon className="h-[18px] w-[18px]" /></span>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: 'var(--crm-text)' }}>{s.value}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>{s.note}</div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="overflow-hidden rounded-2xl" style={card}>
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--crm-border)' }}>
            <div>
              <h3 className="font-semibold">Radar comercial</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Lo que conviene mover primero</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: overdue ? '#fae1dc' : '#dce9e5', color: overdue ? '#a84232' : '#315f52' }}>{urgent.length} por atender</span>
          </div>
          {urgent.length ? <ul className="flex flex-col p-2">{urgent.map((item) => <Row key={item.id} item={item} onOpen={onOpen} />)}</ul> : (
            <div className="flex items-center gap-3 px-5 py-7">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <div><p className="text-sm font-medium">Sin seguimientos urgentes</p><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Cuando una llamada, visita o seguimiento toque, aparecerá aquí.</p></div>
            </div>
          )}
          <div className="border-t px-5 py-3 text-xs" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>
            {today.proximo.length} tareas previstas para los próximos días
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl" style={card}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--crm-border)' }}>
            <div><h3 className="font-semibold">Cartera de propiedades</h3><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Una vista rápida del inventario</p></div>
            <Home className="h-5 w-5" style={{ color: 'var(--crm-muted)' }} />
          </div>
          {featured.length ? <div className="divide-y" style={{ borderColor: 'var(--crm-border)' }}>
            {featured.map((r) => {
              const price = r.data.precio ?? r.data.precio_venta ?? r.data.importe;
              const zone = r.data.zona ?? r.data.direccion ?? r.data.localidad;
              return <button key={r.id} onClick={() => onOpen(r)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-black/[0.025]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: '#e9eee6', color: '#48634d' }}><Building2 className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{recordTitle(r, homeEntity)}</span><span className="mt-1 block truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{String(zone || 'Zona por confirmar')}</span></span>
                <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{price != null && price !== '' ? formatMoney(Number(price) || 0) : 'Precio pendiente'}</span><span className="mt-1 flex items-center justify-end gap-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Ver ficha <ArrowRight className="h-3 w-3" /></span></span>
              </button>;
            })}
          </div> : <p className="px-5 py-7 text-sm" style={{ color: 'var(--crm-muted)' }}>Añade el primer inmueble para empezar a organizar tu cartera.</p>}
          <div className="border-t px-5 py-3 text-xs" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>{homes.length} propiedades en total · {visits.length} visitas registradas</div>
        </section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-2xl p-5" style={card}>
          <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#e8e3f6', color: '#65538c' }}><Users className="h-5 w-5" /></span><div><h3 className="font-semibold">Compradores y propietarios</h3><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Prioriza el contacto, no solo el registro</p></div></div>
          {leads.slice(0, 4).map((r) => {
            const next = r.data.siguiente_paso;
            const budget = r.data.presupuesto_max ?? r.data.presupuesto;
            return <button key={r.id} onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-black/[0.025]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: '#e8e3f6', color: '#65538c' }}>{recordTitle(r, leadEntity).split(/\s+/).map((v) => v[0]).slice(0, 2).join('').toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{recordTitle(r, leadEntity)}</span><span className="mt-1 block truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{String(next || 'Definir siguiente paso')}</span></span>
              <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--crm-muted)' }}>{budget ? formatMoney(Number(budget)) : String(r.data.operacion_busca || 'Lead')}</span>
            </button>;
          })}
          {!leads.length && <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>Los nuevos leads aparecerán aquí para que el equipo pueda actuar.</p>}
        </section>

        <section className="rounded-2xl p-5" style={card}>
          <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#f5e8d6', color: '#986b35' }}><CalendarClock className="h-5 w-5" /></span><div><h3 className="font-semibold">Actividad y visitas</h3><p className="mt-1 text-xs" style={{ color: 'var(--crm-muted)' }}>Cada visita debe terminar con un siguiente paso</p></div></div>
          {visits.slice(0, 4).map((r) => <button key={r.id} onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-black/[0.025]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: '#f5e8d6', color: '#986b35' }}><CalendarClock className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{recordTitle(r, visitEntity ?? entity(String(r.entity)))}</span><span className="mt-1 block truncate text-xs" style={{ color: 'var(--crm-muted)' }}>{String(r.data.siguiente_paso || (r.data.visita ? `Visita: ${String(r.data.visita).replace('T', ' ')}` : 'Registrar resultado y seguimiento'))}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--crm-muted)' }} />
          </button>)}
          {!visits.length && <p className="text-sm" style={{ color: 'var(--crm-muted)' }}>Registra las visitas y su resultado para no dejar oportunidades sin seguimiento.</p>}
        </section>
      </div>
    </div>
  );
}

export function TodayView({ blueprint, records, onOpen, now }: { blueprint: Blueprint; records: AppRecord[]; onOpen: (r: AppRecord) => void; now?: Date }) {
  const today = useMemo(() => computeToday(blueprint, records, now), [blueprint, records, now]);
  const isRealEstate = blueprint.name.toLocaleLowerCase('es').includes('inmobiliaria')
    && blueprint.entities.some((e) => e.key === 'inmueble')
    && blueprint.entities.some((e) => e.key === 'lead');
  const metrics = (blueprint.views.find((v) => v.type === 'dashboard')?.widgets ?? []).filter((w) => w.kind === 'metric').slice(0, 4);
  const raw = (now ?? new Date()).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = raw.charAt(0).toUpperCase() + raw.slice(1);
  const pending = today.hoy.length + today.atrasado.length;
  const line = pending === 0
    ? 'Nada pendiente para hoy. Buen momento para mirar lo que viene.'
    : `${today.hoy.length ? `${today.hoy.length} ${today.hoy.length === 1 ? 'cosa' : 'cosas'} para hoy` : 'Hoy está despejado'}${today.atrasado.length ? ` y ${today.atrasado.length} ${today.atrasado.length === 1 ? 'atrasada' : 'atrasadas'}` : ''}.`;

  if (isRealEstate) return <RealEstateOverview blueprint={blueprint} records={records} today={today} onOpen={onOpen} date={date} />;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
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

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {today.atrasado.length > 0 && <Group title="Atrasado" icon={AlertTriangle} accent="#c2410c" items={today.atrasado} empty="" onOpen={onOpen} />}
          <Group title="Para hoy" icon={Sun} accent="var(--crm-primary)" items={today.hoy} empty="Nada para hoy." onOpen={onOpen} />
        </div>
        <Group title="Próximos días" icon={CalendarClock} items={today.proximo} empty="Nada en los próximos días." onOpen={onOpen} />
      </div>

      {today.total === 0 && (
        <p className="flex items-center gap-2 text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>
          <CheckCircle2 className="h-4 w-4" /> Cuando apuntes citas, fechas de entrega o vencimientos, aparecerán aquí solos.
        </p>
      )}
    </div>
  );
}
