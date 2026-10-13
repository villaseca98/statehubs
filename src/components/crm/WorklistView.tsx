import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mail, MessageCircle, Phone, ArrowRight, ExternalLink, AlertTriangle, ListPlus, Zap } from 'lucide-react';
import type { AppRecord, Field, ViewAction } from '@shared/blueprint/types.ts';
import { buildSlots, isoDay } from '@shared/blueprint/slots.ts';
import type { BusyInterval } from '@shared/blueprint/slots.ts';
import { chipStyle, formatValue, titleOfRecord } from './theme';
import { Cell, Chip } from './views';
import { actionsFor, whatsappUrl } from './actions';
import type { ViewProps } from './views';
import { useRuntime } from './runtimeContext';
import { useGoogleCalendar } from './googleCalendarContext';

// A list to work through (leads, pending orders…). Each row offers only the
// actions that fit its current stage; the side panel shows the selected one
// with its actions and, for booking actions, the free time slots.

const ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail, move: ArrowRight, schedule: CalendarClock, launch: ListPlus, webhook: Zap, link: ExternalLink };
const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;

function actionHref(a: ViewAction, r: AppRecord): string | null {
  const v = a.field ? r.data[a.field] : undefined;
  if (!v) return null;
  if (a.kind === 'call') return `tel:${String(v).replace(/\s/g, '')}`;
  if (a.kind === 'whatsapp') return whatsappUrl(String(v));
  if (a.kind === 'email') return `mailto:${v}`;
  // [SECURITY] Only web addresses: a javascript: or data: URL in a record must never become a link.
  if (a.kind === 'link') return /^https?:\/\//i.test(String(v)) ? String(v) : null;
  return null;
}

export function WorklistView({ blueprint, view, records, dark, solid, titleOf, onOpen, onCreate, onUpdate }: ViewProps) {
  const entity = blueprint.entities.find((e) => e.key === view.entity)!;
  const stage = entity.fields.find((f) => f.key === view.groupBy && f.type === 'select');
  const actions = view.actions ?? [];
  const columns = (view.columns ?? []).map((k) => entity.fields.find((f) => f.key === k)).filter((f): f is Field => !!f && f.key !== entity.titleField && f.key !== stage?.key);
  const mine = records.filter((r) => r.entity === entity.key);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booking, setBooking] = useState<ViewAction | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const runtime = useRuntime();
  const google = useGoogleCalendar();

  const rows = filter === null ? mine : mine.filter((r) => r.data[stage?.key ?? ''] === filter);
  const selected = mine.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  useEffect(() => { setBooking(null); setPick(null); setNotice(null); }, [selected?.id]);

  const now = new Date();
  const today = isoDay(now);
  const nowLocal = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const scheduleFields = [...new Set(actions.filter((a) => a.kind === 'schedule' && a.field).map((a) => a.field as string))];
  const nextDate = (r: AppRecord) => scheduleFields.map((k) => r.data[k]).find((v) => typeof v === 'string' && v) as string | undefined;

  const run = (a: ViewAction, r: AppRecord) => {
    if (runtime?.canEdit === false) return;
    if (a.kind === 'move' && stage && a.to) onUpdate(r.id, { [stage.key]: a.to });
    if (a.kind === 'schedule') { setSelectedId(r.id); setBooking(a); setPick(null); }
    if (a.kind === 'launch') launch(a, r);
    if (a.kind === 'webhook') {
      setSelectedId(r.id);
      if (!runtime?.sendWebhook) { setNotice('Aquí no se envía nada: es una vista previa.'); return; }
      setNotice('Enviando…');
      Promise.resolve(runtime.sendWebhook(r)).then((m) => setNotice(m || 'Enviado.'), (e) => setNotice((e as Error).message));
    }
  };

  // Each line of the text becomes a record of the target entity, linked back here.
  const launch = (a: ViewAction, r: AppRecord) => {
    const target = blueprint.entities.find((x) => x.key === a.entity);
    const link = target?.fields.find((f) => f.type === 'relation' && f.relation === entity.key);
    const steps = String(r.data[a.field ?? ''] ?? '').split('\n').map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 50);
    setSelectedId(r.id);
    if (!target || !link || steps.length === 0) { setNotice('Este proceso aún no tiene pasos. Escríbelos en su ficha, uno por línea.'); return; }
    const defaults: Record<string, unknown> = {};
    for (const f of target.fields) if (f.type === 'select' && f.required && f.options?.length) defaults[f.key] = f.options[0].value;
    for (const step of steps) (runtime?.createQuietly ?? onCreate)(target.key, { ...defaults, [target.titleField]: step, [link.key]: r.id });
    if (a.to && stage) onUpdate(r.id, { [stage.key]: a.to });
    setNotice(`${steps.length} ${steps.length === 1 ? target.label.toLowerCase() : target.labelPlural.toLowerCase()} creadas a partir de «${titleOfRecord(entity, r.data)}».`);
  };

  const ActionButton = ({ a, r, big }: { a: ViewAction; r: AppRecord; big?: boolean }) => {
    const Icon = ICONS[a.kind];
    const href = actionHref(a, r);
    const missing = ['call', 'whatsapp', 'email', 'link'].includes(a.kind) && !href;
    const style = big
      ? { ...card, padding: '8px 12px', color: 'var(--crm-text)' }
      : { border: '1px solid var(--crm-border)', borderRadius: 'calc(var(--crm-radius) * 0.75)', padding: '3px 8px', color: 'var(--crm-text)' };
    const active = booking === a && selected?.id === r.id;
    const content = <><Icon className="h-3.5 w-3.5 shrink-0" style={{ color: a.kind === 'whatsapp' ? '#25d366' : 'var(--crm-primary)' }} />{a.label}</>;
    const cls = `inline-flex items-center gap-1.5 whitespace-nowrap ${big ? 'w-full' : ''} ${missing ? 'pointer-events-none opacity-40' : ''}`;
    if (href) return <a href={href} target={a.kind === 'whatsapp' || a.kind === 'link' ? '_blank' : undefined} rel="noreferrer" onClick={(e) => e.stopPropagation()} className={cls} style={style}>{content}</a>;
    return (
      <button disabled={runtime?.canEdit === false} title={missing ? 'Falta el dato de contacto' : undefined} onClick={(e) => { e.stopPropagation(); run(a, r); }} className={cls}
        style={active ? { ...style, borderColor: 'var(--crm-primary)', background: 'color-mix(in srgb, var(--crm-primary) 10%, transparent)' } : style}>
        {content}
      </button>
    );
  };

  const counts = new Map<string, number>();
  for (const r of mine) counts.set(String(r.data[stage?.key ?? ''] ?? ''), (counts.get(String(r.data[stage?.key ?? ''] ?? '')) ?? 0) + 1);

  return (
    <div className="flex flex-col" style={{ gap: 'var(--crm-gap)' }}>
      {stage && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={stage.label}>
          {[{ value: null as string | null, label: 'Todos', n: mine.length, color: undefined }, ...(stage.options ?? []).map((o) => ({ value: o.value, label: o.label, n: counts.get(o.value) ?? 0, color: o.color }))].map((t) => (
            <button key={t.label} role="tab" aria-selected={filter === t.value} onClick={() => setFilter(t.value)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={filter === t.value ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { border: '1px solid var(--crm-border)', background: 'var(--crm-surface)' }}>
              {t.color && <span className="h-2 w-2 rounded-full" style={chipStyle(t.color, dark, true)} />}
              {t.label}<span style={{ opacity: 0.7 }}>{t.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ul className="flex flex-col overflow-hidden" style={card} aria-label={entity.labelPlural}>
          {rows.map((r) => {
            const when = nextDate(r);
            const late = when && when < nowLocal && actions.some((a) => a.kind === 'schedule' && a.to && r.data[stage?.key ?? ''] === a.to);
            const isToday = when?.slice(0, 10) === today;
            return (
              <li key={r.id}>
                <div role="button" tabIndex={0} onClick={() => setSelectedId(r.id)} onKeyDown={(e) => e.key === 'Enter' && setSelectedId(r.id)}
                  className="flex cursor-pointer flex-col gap-1.5 md:flex-row md:items-center md:justify-between"
                  style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', background: selected?.id === r.id ? 'color-mix(in srgb, var(--crm-primary) 8%, transparent)' : undefined }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{titleOfRecord(entity, r.data)}</span>
                      {stage && <Chip field={stage} value={r.data[stage.key]} dark={dark} solid={solid} />}
                      {late && <span className="inline-flex items-center gap-1 rounded px-1.5 text-[0.8em]" style={chipStyle('red', dark)}><AlertTriangle className="h-3 w-3" /> Ya pasó: actualiza el estado</span>}
                      {!late && isToday && <span className="rounded px-1.5 text-[0.8em]" style={chipStyle('green', dark)}>Hoy</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>
                      {columns.map((f) => r.data[f.key] !== undefined && r.data[f.key] !== '' && r.data[f.key] !== null && (
                        <span key={f.key}><Cell field={f} value={r.data[f.key]} dark={dark} titleOf={titleOf} /></span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:justify-end">
                    {actionsFor(actions, stage ? r.data[stage.key] : undefined).slice(0, 3).map((a) => <ActionButton key={a.label} a={a} r={r} />)}
                  </div>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && <li style={{ padding: 'var(--crm-pad)', color: 'var(--crm-muted)' }}>Nada por aquí.</li>}
        </ul>

        {selected && (
          <aside className="flex flex-col gap-3 lg:sticky lg:top-0" style={{ ...card, padding: 'var(--crm-pad)' }} aria-label="Detalle">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[1.2em] font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{titleOfRecord(entity, selected.data)}</div>
                {stage && <div className="mt-1"><Chip field={stage} value={selected.data[stage.key]} dark={dark} solid={solid} /></div>}
              </div>
              <button onClick={() => onOpen(selected)} className="inline-flex shrink-0 items-center gap-1 text-[0.9em]" style={{ color: 'var(--crm-primary)' }}>Ficha <ExternalLink className="h-3.5 w-3.5" /></button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95em]">
              {entity.fields.filter((f) => f.key !== entity.titleField && f.key !== stage?.key && f.type !== 'longtext' && selected.data[f.key] !== undefined && selected.data[f.key] !== '' && selected.data[f.key] !== null).slice(0, 6).map((f) => (
                <div key={f.key} className="contents">
                  <dt style={{ color: 'var(--crm-muted)' }}>{f.label}</dt>
                  <dd className="truncate"><Cell field={f} value={selected.data[f.key]} dark={dark} titleOf={titleOf} /></dd>
                </div>
              ))}
            </dl>
            {[...new Set(actions.filter((a) => a.kind === 'launch' && a.field).map((a) => a.field as string))].map((k) => {
              const steps = String(selected.data[k] ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
              return steps.length > 0 && (
                <div key={k}>
                  <div className="mb-1.5 text-[0.85em] font-semibold uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>Pasos</div>
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-[0.95em]">{steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                </div>
              );
            })}
            <div>
              <div className="mb-1.5 text-[0.85em] font-semibold uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>Qué hacer ahora</div>
              <div className="flex flex-col gap-1.5">
                {actionsFor(actions, stage ? selected.data[stage.key] : undefined).map((a) => <ActionButton key={a.label} a={a} r={selected} big />)}
              </div>
              {notice && <p role="status" className="mt-2 rounded px-2 py-1.5 text-[0.9em]" style={{ background: 'color-mix(in srgb, var(--crm-primary) 10%, transparent)' }}>{notice}</p>}
            </div>
            {booking && view.availability && (
              <SlotPicker
                label={booking.label}
                field={entity.fields.find((f) => f.key === booking.field)!}
                current={selected.data[booking.field ?? '']}
                taken={mine.filter((r) => r.id !== selected.id).map((r) => r.data[booking.field ?? '']).filter((v): v is string => typeof v === 'string')}
                availability={view.availability}
                busy={google?.busy}
                pick={pick}
                onPick={setPick}
                onConfirm={() => {
                  if (!pick || !booking.field) return;
                  onUpdate(selected.id, { [booking.field]: pick, ...(booking.to && stage ? { [stage.key]: booking.to } : {}) });
                  setBooking(null);
                  setPick(null);
                }}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function SlotPicker({ label, field, current, taken, availability, busy, pick, onPick, onConfirm }: {
  label: string; field: Field; current: unknown; taken: string[]; availability: NonNullable<ViewProps['view']['availability']>; busy?: BusyInterval[];
  pick: string | null; onPick: (v: string) => void; onConfirm: () => void;
}) {
  const days = useMemo(() => buildSlots(availability, taken, new Date(), 5, busy), [availability, taken, busy]);
  const [day, setDay] = useState(0);
  const shown = days[day];
  return (
    <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--crm-border)', paddingTop: 'var(--crm-gap)' }}>
      <div className="text-[0.85em] font-semibold uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>Horarios disponibles</div>
      {typeof current === 'string' && current && <div className="text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>Ahora: {formatValue(field, current)}</div>}
      {days.length === 0 ? <div style={{ color: 'var(--crm-muted)' }}>No hay huecos en los próximos días.</div> : (
        <>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Días">
            {days.map((d, i) => {
              const date = new Date(`${d.date}T00:00:00`);
              return (
                <button key={d.date} role="tab" aria-selected={i === day} onClick={() => setDay(i)} className="flex min-w-[52px] flex-col items-center rounded px-2 py-1 text-[0.85em]"
                  style={i === day ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { border: '1px solid var(--crm-border)' }}>
                  <span className="capitalize">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="font-semibold">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5" aria-label="Horas">
            {shown?.slots.map((s) => (
              <button key={s.value} disabled={s.taken} onClick={() => onPick(s.value)} title={s.google ? 'Ocupado en tu Google Calendar' : s.taken ? 'Ocupado' : undefined} aria-label={s.google ? `${s.time}, ocupado en tu Google Calendar` : undefined}
                className="rounded py-1.5 text-[0.9em] disabled:cursor-not-allowed disabled:line-through"
                style={pick === s.value
                  ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }
                  : { border: '1px solid var(--crm-border)', opacity: s.taken ? 0.45 : 1, fontFamily: 'var(--crm-number-font)' }}>
                {s.time}
              </button>
            ))}
          </div>
          {busy && busy.length > 0 && <div className="text-[0.8em]" style={{ color: 'var(--crm-muted)' }}>Las horas tachadas ya están ocupadas aquí o en tu Google Calendar.</div>}
          <button disabled={!pick} onClick={onConfirm} className="mt-1 rounded py-2 font-medium disabled:opacity-40"
            style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)', borderRadius: 'var(--crm-radius)' }}>
            {pick ? `${label}: ${formatValue(field, pick)}` : 'Elige una hora'}
          </button>
        </>
      )}
    </div>
  );
}
