import { useEffect, useState } from 'react';
import { Check, Trash2, X, ArrowLeft } from 'lucide-react';
import type { AppRecord, Blueprint, Field, RecordData } from '@shared/blueprint/types.ts';
import { chipStyle, titleOfRecord, stageField, isNumeric } from './theme';
import { Cell } from './views';
import { RecordCalendar } from './RecordCalendar';
import { PropertyMedia } from './PropertyMedia';
import { PropertyOverview } from './PropertyOverview';
import { useRuntime } from './runtimeContext';
import { ContactLifecycle } from './ContactLifecycle';
import { MatchIntelligence } from './MatchIntelligence';
import { RecordActivity } from './RecordActivity';
import { linkedRecords } from '@/lib/crm/recordLinks';
import { useActivityText } from '@/i18n/activity';

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
  onOpen?: (id: string) => void;
  onBack?: () => void;
}

const input = 'w-full min-w-0 min-h-[44px] rounded px-3 py-2 outline-none focus-visible:ring-2';
const inputStyle = { background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)', borderRadius: 'calc(var(--crm-radius) * 0.75)' };

function FieldInput({ field, value, records, titleOf, onChange }: { field: Field; value: unknown; records: AppRecord[]; titleOf: Props['titleOf']; onChange: (v: unknown) => void }) {
  const str = value === undefined || value === null ? '' : String(value);
  const [draft, setDraft] = useState(str);
  useEffect(() => { setDraft(str); }, [str]);
  switch (field.type) {
    case 'longtext':
      return <textarea className={input} style={inputStyle} rows={3} value={draft} onChange={e => setDraft(e.target.value)} onBlur={(e) => e.target.value !== str && onChange(e.target.value)} />;
    case 'boolean':
      return <input type="checkbox" className="h-5 w-5" style={{ accentColor: 'var(--crm-primary)' }} checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
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
        <input type="number" step="any" className={input} style={{ ...inputStyle, fontFamily: 'var(--crm-number-font)' }} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== value) onChange(v); }} />
      );
    case 'date':
      return <input type="date" className={input} style={inputStyle} value={str} onChange={(e) => onChange(e.target.value || null)} />;
    case 'datetime':
      return <input type="datetime-local" className={input} style={inputStyle} value={draft.slice(0, 16)} onChange={e => setDraft(e.target.value)} onBlur={(e) => e.target.value !== str && onChange(e.target.value || null)} />;
    default: {
      const type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text';
      return <input type={type} className={input} style={inputStyle} value={draft} onChange={e => setDraft(e.target.value)} onBlur={(e) => e.target.value !== str && onChange(e.target.value)} />;
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

export function RecordPanel({ blueprint, appId, record, records, groupBy, dark = false, titleOf, onUpdate, onDelete, onClose, onOpen, onBack }: Props) {
  const activityText = useActivityText();
  const permissions = useRuntime();
  const readOnly = permissions?.canEdit === false;
  const entity = blueprint.entities.find((e) => e.key === record.entity)!;
  const stage = stageField(entity, groupBy);
  const highlights = entity.fields.filter((f) => f.key !== entity.titleField && f.key !== stage?.key && (isNumeric(f) || f.type === 'select' || f.type === 'date' || f.type === 'datetime' || f.type === 'relation')).slice(0, 4);
  const set = (key: string) => (v: unknown) => onUpdate(record.id, { [key]: v });
  const related = linkedRecords(blueprint,record,records);
  const page = false;

  return (
    <div className="flex h-full min-w-0 flex-col" style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)' }}>
      <div className="flex items-start justify-between gap-3" style={{ padding: 'var(--crm-pad)', borderBottom: '1px solid var(--crm-border)' }}>
        <div className="min-w-0">
          {onBack && (
            <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[0.9em]" style={{ color: 'var(--crm-primary)' }}>
              <ArrowLeft className="h-3.5 w-3.5" /> {activityText.back}
            </button>
          )}
          <div className="text-[0.85em] uppercase tracking-wide" style={{ color: 'var(--crm-muted)' }}>{entity.label}</div>
          <h2 className="truncate text-[1.45em] font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>{titleOfRecord(entity, record.data)}</h2>
          {record.is_sample && <span className="mt-1 inline-block rounded px-1.5 text-[0.8em]" style={chipStyle('amber', dark)}>Dato de ejemplo</span>}
        </div>
        <div className="flex shrink-0 gap-1">
          {!readOnly && permissions?.canDelete !== false && <button aria-label="Borrar" title="Borrar" onClick={() => { if (window.confirm(`¿Borrar «${titleOfRecord(entity, record.data)}»?`)) onDelete(record.id); }} className="sh-touch rounded p-2" style={{ color: 'var(--crm-muted)' }}>
            <Trash2 className="h-4 w-4" />
          </button>}
          {!page && <button aria-label="Cerrar" onClick={onClose} className="rounded p-1.5" style={{ color: 'var(--crm-muted)' }}><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--crm-pad)' }}>
        <MatchIntelligence key={`matching-${record.id}`} appId={appId} record={record} records={records} blueprint={blueprint} readOnly={readOnly} onUpdate={onUpdate} onOpen={onOpen} />
        {record.entity === 'contacto_inmo' && <ContactLifecycle record={record} readOnly={readOnly} onUpdate={onUpdate} />}
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
        {stage && <fieldset disabled={readOnly} className="mb-5"><StagePath field={stage} value={record.data[stage.key]} dark={dark} onPick={set(stage.key)} /></fieldset>}
        {(record.entity === 'inmueble' || record.entity === 'alojamiento') && <PropertyOverview record={record} entity={entity} records={records} titleOf={titleOf} />}
        {(record.entity === 'inmueble' || record.entity === 'alojamiento') && <PropertyMedia appId={appId} record={record} onUpdate={onUpdate} />}
        <RecordCalendar key={`calendar-${record.id}`} blueprint={blueprint} record={record} records={records} />

        <fieldset disabled={readOnly} className={`grid min-w-0 gap-x-4 gap-y-3 ${page ? 'md:grid-cols-2' : ''}`} key={`fields-${record.id}`}>
          {entity.fields.map((f) => (
            <label key={f.key} className={`flex flex-col gap-1 ${f.type === 'longtext' && page ? 'md:col-span-2' : ''}`}>
              <span className="text-[0.85em]" style={{ color: 'var(--crm-muted)' }}>{f.label}{f.required ? ' *' : ''}</span>
              <FieldInput field={f} value={record.data[f.key]} records={records} titleOf={titleOf} onChange={set(f.key)} />
              {f.help && <span className="text-[0.8em]" style={{ color: 'var(--crm-muted)' }}>{f.help}</span>}
            </label>
          ))}
        </fieldset>

        <section className="mt-6" aria-label={activityText.links}>
          <h3 className="font-semibold">{activityText.links}</h3>
          {!related.length && <p className="mt-2 text-sm" style={{color:'var(--crm-muted)'}}>{activityText.noLinks}</p>}
          {related.map(({entity: linkedEntity,records: items}) => <div key={linkedEntity.key} className="mt-4">
            <h4 className="text-sm font-semibold">{linkedEntity.labelPlural} ({items.length})</h4>
            <ul className="mt-2 space-y-1">{items.map(r=><li key={r.id}>
              <button disabled={!onOpen} onClick={()=>onOpen?.(r.id)} className="min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm" style={{borderColor:'var(--crm-border)',color:'var(--crm-primary)'}}>{titleOfRecord(linkedEntity,r.data)}</button>
            </li>)}</ul>
          </div>)}
        </section>
        <RecordActivity key={`activity-${record.id}`} appId={appId} record={record} entity={entity} readOnly={readOnly} />
      </div>
    </div>
  );
}
