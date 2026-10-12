import { useMemo, useState } from 'react';
import { ArrowUpRight, Building2, ImageOff } from 'lucide-react';
import type { AppRecord, Blueprint, Field, View } from '@shared/blueprint/types.ts';
import { chipStyle, formatValue, titleOfRecord } from './theme';
import { Cell } from './views';
import { photoOf } from '@/lib/crm/estate';
import { PropertyCover } from './PropertyCover';

// Fichas: a gallery of records with a cover photo (imageField), a status badge
// (groupBy), the title, the price and the fields in `columns`. Made for the
// property portfolio, but works for any entity.

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface Props {
  blueprint: Blueprint;
  view: View;
  records: AppRecord[];
  titleOf: (id: string) => string | undefined;
  onOpen: (r: AppRecord) => void;
}

// The price line: per night for tourist flats, per month for rentals.
function priceOf(fields: Field[], data: AppRecord['data']): string | undefined {
  const has = (k: string) => fields.some((f) => f.key === k);
  if (data.operacion === 'turistico' && has('precio_noche') && typeof data.precio_noche === 'number') return `${eur.format(data.precio_noche)} / noche`;
  const money = fields.find((f) => f.key === 'precio' && f.type === 'money') ?? fields.find((f) => f.type === 'money');
  const v = money ? data[money.key] : undefined;
  if (typeof v !== 'number') return undefined;
  return `${eur.format(v)}${data.operacion === 'alquiler' ? ' / mes' : ''}`;
}

function Cover({ src, label, sub }: { src?: string; label: string; sub?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />;
  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden p-4 text-white" style={{ background: 'linear-gradient(135deg, var(--crm-primary) 0%, #0f2e22 100%)' }}>
      <svg aria-hidden viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-[.16]">
        <path d="M0 95 L40 70 L70 82 L110 48 L150 66 L200 34 L200 120 L0 120 Z" fill="#fff" />
        <circle cx="160" cy="28" r="14" fill="#fff" />
      </svg>
      {src && broken ? <ImageOff className="absolute right-3 top-3 h-4 w-4 opacity-70" /> : <Building2 className="absolute right-3 top-3 h-4 w-4 opacity-70" />}
      <span className="relative text-[1.45em] font-semibold leading-none tracking-tight">{label}</span>
      {sub && <span className="relative mt-1 text-[0.85em] opacity-90">{sub}</span>}
    </div>
  );
}

export function CardsView({ blueprint, view, records, titleOf, onOpen }: Props) {
  const entity = blueprint.entities.find((e) => e.key === view.entity);
  const fields = entity?.fields ?? [];
  const opField = fields.find((f) => f.key === 'operacion' && f.type === 'select');
  const statusField = fields.find((f) => f.key === view.groupBy && f.type === 'select');
  const [op, setOp] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const all = useMemo(() => records.filter((r) => r.entity === view.entity), [records, view.entity]);
  const shown = all.filter((r) => (!op || r.data[opField?.key ?? ''] === op) && (!status || r.data[statusField?.key ?? ''] === status));
  if (!entity) return null;

  const skip = new Set([entity.titleField, opField?.key, 'precio', 'precio_noche', view.imageField, statusField?.key].filter(Boolean) as string[]);
  const extra = (view.columns ?? []).map((k) => fields.find((f) => f.key === k)).filter((f): f is Field => !!f && !skip.has(f.key));
  const typeField = fields.find((f) => f.key === 'tipo' && f.type === 'select');
  const pill = (active: boolean) => (active ? { background: 'var(--crm-primary)', color: '#fff', borderColor: 'var(--crm-primary)' } : { background: 'var(--crm-surface)', color: 'var(--crm-text)', borderColor: 'var(--crm-border)' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {opField?.options && (
          <div role="group" aria-label="Operación" className="flex flex-wrap gap-1.5">
            {[{ value: '', label: 'Todos' }, ...opField.options.map((o) => ({ value: o.value, label: o.value === 'turistico' ? 'Turístico' : o.label }))].map((o) => (
              <button key={o.value || 'todos'} aria-pressed={op === o.value} onClick={() => setOp(o.value)}
                className="rounded-full border px-3 py-1 text-[0.9em] font-medium transition" style={pill(op === o.value)}>
                {o.label}
                <span className="ml-1.5 opacity-60">{o.value ? all.filter((r) => r.data[opField.key] === o.value).length : all.length}</span>
              </button>
            ))}
          </div>
        )}
        {statusField?.options && (
          <select aria-label={statusField.label} value={status} onChange={(e) => setStatus(e.target.value)}
            className="ml-auto rounded-full border px-3 py-1 text-[0.9em] outline-none" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', color: 'var(--crm-text)' }}>
            <option value="">{`${statusField.label}: todos`}</option>
            {statusField.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[0.95em]" style={{ ...card, color: 'var(--crm-muted)' }}>
          {all.length ? 'Ningún registro con estos filtros.' : `Todavía no hay ${entity.labelPlural.toLowerCase()}.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={entity.labelPlural}>
          {shown.map((r) => {
            const img = view.imageField ? r.data[view.imageField] : undefined;
            const badge = statusField?.options?.find((o) => o.value === r.data[statusField.key]);
            const opOpt = opField?.options?.find((o) => o.value === r.data[opField.key]);
            const ref = typeof r.data.referencia === 'string' ? r.data.referencia : '';
            const type = typeField ? formatValue(typeField, r.data[typeField.key]) : '';
            const price = priceOf(fields, r.data);
            const title = titleOfRecord(entity, r.data);
            return (
              <li key={r.id} className="min-w-0">
                <button onClick={() => onOpen(r)} aria-label={title}
                  className="group flex h-full w-full flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-lg" style={card}>
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <PropertyCover value={r.data.statehubs_media} alt={title} fallback={<Cover src={photoOf(img) || undefined} label={ref || type || entity.label} sub={ref ? type : undefined} />} />
                    {badge && <span className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[0.8em] font-semibold shadow-sm" style={chipStyle(badge.color, false)}>{badge.label}</span>}
                    {price && photoOf(img) && <span className="absolute bottom-3 left-3 rounded-full px-3 py-1 text-[0.95em] font-semibold tabular-nums shadow-sm" style={{ background: 'rgba(255,255,255,.92)', color: '#15231b' }}>{price}</span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[0.82em]" style={{ color: 'var(--crm-muted)' }}>
                        {opOpt && <span className="rounded-full px-2 py-px font-medium" style={chipStyle(opOpt.color, false)}>{opOpt.label}</span>}
                        {ref && photoOf(img) && <span className="truncate">{ref}</span>}
                      </div>
                      <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug">{title}</h3>
                    </div>
                    {price && !photoOf(img) && <div className="text-[1.35em] font-semibold tracking-tight tabular-nums">{price}</div>}
                    {extra.length > 0 && (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-[0.88em]" style={{ borderColor: 'var(--crm-border)' }}>
                        {extra.map((f) => {
                          const v = r.data[f.key];
                          if (v === undefined || v === null || v === '') return null;
                          return (
                            <div key={f.key} className="min-w-0">
                              <dt className="truncate text-[0.88em]" style={{ color: 'var(--crm-muted)' }}>{f.label}</dt>
                              <dd className="truncate"><Cell field={f} value={v} dark={false} titleOf={titleOf} /></dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                    <span className="mt-auto flex items-center justify-between pt-1 text-[0.88em] font-medium" style={{ color: 'var(--crm-primary)' }}>
                      Ver ficha
                      <span className="grid h-8 w-8 place-items-center rounded-full transition group-hover:translate-x-0.5" style={{ background: 'var(--crm-primary)', color: '#fff' }}><ArrowUpRight className="h-4 w-4" /></span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
