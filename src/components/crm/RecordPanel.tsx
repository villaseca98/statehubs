import { Check, Trash2, X, ArrowLeft } from 'lucide-react';
import type { AppRecord, Blueprint, Field, RecordData } from '@shared/blueprint/types.ts';
import { chipStyle, titleOfRecord, stageField, isNumeric } from './theme';
import { Cell } from './views';
import { RecordCalendar } from './RecordCalendar';
import { PropertyMedia } from './PropertyMedia';
import { PropertyOverview } from './PropertyOverview';

interface Props {
  blueprint: Blueprint;
  appId?: string;
  record: AppRecord;
  records: AppRecord[];
  groupBy?: string;
  dark?: boolean;
  titleOf: (id: string) => string | undefined;
  onUpdate: (id: string, data: RecordData) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const input = 'w-full rounded px-2 py-1.5 outline-none focus:ring-2';
const inputStyle = { background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)', borderRadius: 'calc(var(--crm-radius) * 0.75)' };

function FieldInput({ field, value, records, titleOf, onChange }: { field: Field; value: unknown; records: AppRecord[]; titleOf: Props['titleOf']; onChange: (v: unknown) => void }) {
  const str = value === undefined || value === null ? '' : String(value);
  switch (field.type) {
    case 'longtext':
      return <textarea className={input} style={inputStyle} rows={3} defaultValue={str} onBlur={(e) => e.target.value !== str && onChange(e.target.value)} />;
    case 'boolean':
      return <input type="checkbox" className="h-4 w-4" style={{ accentColor: 'var(--crm-primary)' }} checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case 'select':
      return (
        <select className={input} style={inputStyle} value={str} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {str && !field.options?.some((o) => o.value === str) && <option value={str}>{str} (ya no existe)</option>}
        </select>
      );
    case 'relation':
      return (
        <select className={input} style={inputStyle} value={str} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {records.filter((r) => r.entity === field.relation).map((r) => <option key={r.id} value={r.id}>{titleOf(r.id)}</option>)}
        </select>
      );
    case 'number': case 'money': case 'percent':
      return (
        <input type="number" step="any" className={input} style={{ ...inputStyle, fontFamily: 'var(--crm-number-font)' }} defaultValue={str}
          onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== value) onChange(v); }} />
      );
    case 'date':
      return <input type="date" className={input} style={inputStyle} defaultValue={str} onChange={(e) => onChange(e.target.value || null)} />;
    case 'datetime':
      return <input type="datetime-local" className={input} style={inputStyle} defaultValue={str.slice(0, 16)} onBlur={(e) => e.target.value !== str && onChange(e.target.value || null)} />;
    default: {
      const type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text';
      return <input type={type} className={input} style={inputStyle} defaultValue={str} onBlur={(e) => e.target.value !== str && onChange(e.target.value)} />;
    }
  }
}

export function StagePath({ field, value, dark, onPick }: { field: Field; value: unknown; dark: boolean; onPick: (v: string) => void }) {
  const opts = field.options ?? [];
  const at = opts.findIndex((o) => o.value === value);
  return (
    <div className="flex w-full overflow-x-auto" role="list" aria-label={field.label}>
      {opts.map((o, i) => {
        const done = at >= 0 && i < at;
        const current = i === at;
        const style = current
          ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }
          : done ? { ...chipStyle('green', dark), } : { background: 'color-mix(in srgb, var(--crm-border) 55%, var(--crm-surface))', color: 'var(--crm-muted)' };
        return (
          <button key={o.value} role="listitem" onClick={() => onPick(o.value)} title={`Pasar a ${o.label}`}
            className="relative flex min-w-[96px] flex-1 items-center justify-center gap-1 whitespace-nowrap px-4 py-1.5 font-medium"
            style={{ ...style, clipPath: i === 0 ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)', marginLeft: i === 0 ? 0 : -6, borderRadius: i === 0 ? '999px 0 0 999px' : undefined }}>
            {done && <Check className="h-3.5 w-3.5" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RecordPanel({ blueprint, appId, record, records, groupBy, dark = false, titleOf, onUpdate, onDelete, onClose }: Props) {
  const entity = blueprint.entities.find((e) => e.key === record.entity)!;
  const stage = stageField(entity, groupBy);
  const highlights = entity.fields.filter((f) => f.key !== entity.titleField && f.key !== stage?.key && (isNumeric(f) || f.type === 'select' || f.type === 'date' || f.type === 'datetime' || f.type === 'relation')).slice(0, 4);
  const set = (key: string) => (v: unknown) => onUpdate(record.id, { [key]: v });
  const related = blueprint.entities.flatMap((e) => e.fields.filter((f) => f.type === 'relation' && f.relation === entity.key).map((f) => ({ e, f })));
  const page = false;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)' }}>
      <div className="flex items-start justify-between gap-3" style={{ padding: 'var(--crm-pad)', borderBottom: '1px solid var(--crm-border)' }}>
        <div className="min-w-0">
          {page && (
            <button onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-[0.9em]" style={{ color: 'var(--crm-primary)' }}>
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </button>
          )}
          <div className="text-[0.85em] uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>{entity.label}</div>
          <h2 className="truncate text-[1.45em] font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{titleOfRecord(entity, record.data)}</h2>
          {record.is_sample && <span className="mt-1 inline-block rounded px-1.5 text-[0.8em]" style={chipStyle('amber', dark)}>Dato de ejemplo</span>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button aria-label="Borrar" title="Borrar" onClick={() => { if (window.confirm(`¿Borrar «${titleOfRecord(entity, record.data)}»?`)) onDelete(record.id); }} className="rounded p-1.5" style={{ color: 'var(--crm-muted)' }}>
            <Trash2 className="h-4 w-4" />
          </button>
          {!page && <button aria-label="Cerrar" onClick={onClose} className="rounded p-1.5" style={{ color: 'var(--crm-muted)' }}><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--crm-pad)' }}>
        {highlights.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {highlights.map((f) => (
              <div key={f.key}>
                <div className="text-[0.85em]" style={{ color: 'var(--crm-muted)' }}>{f.label}</div>
                <div className="font-medium"><Cell field={f} value={record.data[f.key]} dark={dark} titleOf={titleOf} /></div>
              </div>
            ))}
          </div>
        )}
        {stage && <div className="mb-5"><StagePath field={stage} value={record.data[stage.key]} dark={dark} onPick={set(stage.key)} /></div>}
        {(record.entity === 'inmueble' || record.entity === 'alojamiento') && <PropertyOverview record={record} entity={entity} records={records} titleOf={titleOf} />}
        {(record.entity === 'inmueble' || record.entity === 'alojamiento') && <PropertyMedia appId={appId} record={record} onUpdate={onUpdate} />}
        <RecordCalendar key={record.id} blueprint={blueprint} record={record} records={records} />

        <div className={`grid gap-x-4 gap-y-3 ${page ? 'md:grid-cols-2' : ''}`} key={record.id}>
          {entity.fields.map((f) => (
            <label key={f.key} className={`flex flex-col gap-1 ${f.type === 'longtext' && page ? 'md:col-span-2' : ''}`}>
              <span className="text-[0.85em]" style={{ color: 'var(--crm-muted)' }}>{f.label}{f.required ? ' *' : ''}</span>
              <FieldInput field={f} value={record.data[f.key]} records={records} titleOf={titleOf} onChange={set(f.key)} />
              {f.help && <span className="text-[0.8em]" style={{ color: 'var(--crm-muted)' }}>{f.help}</span>}
            </label>
          ))}
        </div>

        {related.map(({ e, f }) => {
          const items = records.filter((r) => r.entity === e.key && r.data[f.key] === record.id);
          if (!items.length) return null;
          return (
            <div key={`${e.key}.${f.key}`} className="mt-6">
              <div className="mb-2 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{e.labelPlural} <span style={{ color: 'var(--crm-muted)' }}>({items.length})</span></div>
              <ul className="flex flex-col gap-1">
                {items.map((r) => <li key={r.id} className="rounded px-2 py-1" style={{ border: '1px solid var(--crm-border)' }}>{titleOfRecord(e, r.data)}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
