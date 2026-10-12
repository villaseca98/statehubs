import type { AppRecord, Entity } from '@shared/blueprint/types.ts';
import { Building2, MapPin, Ruler, BedDouble, UserRound, Tag } from 'lucide-react';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const txt = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function PropertyOverview({ record, entity, records, titleOf }: { record: AppRecord; entity: Entity; records: AppRecord[]; titleOf: (id: string) => string | undefined }) {
  const d = record.data;
  const price = number(d.precio) ?? number(d.precio_noche);
  const ownerId = txt(d.propietario);
  const owner = ownerId ? records.find((r) => r.id === ownerId) : undefined;
  const location = [txt(d.direccion), txt(d.zona), txt(d.ciudad)].filter(Boolean).join(' · ');
  const features: { icon: typeof BedDouble; label: string; value: number | null; unit?: string }[] = [
    { icon: BedDouble, label: 'Habitaciones', value: number(d.habitaciones) },
    { icon: Ruler, label: 'Superficie', value: number(d.metros) ?? number(d.superficie), unit: 'm²' },
    { icon: Building2, label: 'Baños', value: number(d.banos) },
  ].filter((x) => x.value !== null);
  const status = txt(d.estado) || txt(d.etapa);
  const hasInfo = price !== null || location || owner || status || features.length;
  if (!hasInfo) return null;
  return <section aria-label="Resumen del inmueble" className="mb-5 space-y-3">
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-bg)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{entity.label}</p>
          {price !== null && <p className="mt-1 text-2xl font-semibold tabular-nums">{euros.format(price)}{d.operacion === 'turistico' ? ' / noche' : d.operacion === 'alquiler' ? ' / mes' : ''}</p>}
          {location && <p className="mt-2 flex items-start gap-1 text-sm"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>{location}</p>}
        </div>
        {status && <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: 'var(--crm-border)' }}><Tag className="h-3.5 w-3.5" aria-hidden="true"/>{status}</span>}
      </div>
      {features.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{features.map(({ icon: Icon, label, value, unit }) => <div key={label} className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden="true"/><div><dt className="text-xs" style={{ color: 'var(--crm-muted)' }}>{label}</dt><dd className="text-sm font-semibold">{value}{unit ? ` ${unit}` : ''}</dd></div></div>)}</dl>}
      {owner && <p className="mt-4 flex items-center gap-2 text-sm"><UserRound aria-hidden="true" className="h-4 w-4"/> Propietario: <span className="font-medium">{titleOf(owner.id) ?? 'Registro relacionado'}</span></p>}
    </div>
  </section>;
}
