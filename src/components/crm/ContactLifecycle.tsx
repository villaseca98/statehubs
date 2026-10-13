import type { AppRecord, RecordData } from '@shared/blueprint/types';
import { CONTACT_ROLES, contactRoles, contactStage, contactStagePatch } from '@/lib/crm/contactLifecycle';
import { useContactText } from '@/i18n/contacts';

export function ContactLifecycle({ record, readOnly, onUpdate }: { record: AppRecord; readOnly: boolean; onUpdate: (id: string, patch: RecordData) => void }) {
 const text = useContactText();
 const stage = contactStage(record.data);
 const roles = contactRoles(record.data);
 const update = (patch: RecordData) => { if (!readOnly) onUpdate(record.id, patch); };
 const button = 'min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50';
 return <section aria-label={text.title} className="mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--crm-border)' }}>
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{text.title}</h3><span role="status" className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--crm-soft)', color: 'var(--crm-text)' }}>{text[stage]}</span></div>
  <p className="mt-3 text-sm" style={{ color: 'var(--crm-muted)' }}>{stage === 'unclassified' ? text.legacy : text.help}</p>
  {!readOnly && <div className="mt-4 flex flex-wrap gap-2">
   {stage === 'archived' ? <button className={button} onClick={() => update({ crm_archived: false })}>{text.restore}</button> : <>
    {stage !== 'client' && <button className={button} style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }} onClick={() => update(contactStagePatch('client'))}>{text.convert}</button>}
    {stage === 'unclassified' && <button className={button} onClick={() => update(contactStagePatch('lead'))}>{text.qualify}</button>}
    <button className={button} onClick={() => update(contactStagePatch('archived'))}>{text.archive}</button>
   </>}
  </div>}
  <fieldset disabled={readOnly || stage === 'archived'} className="mt-5"><legend className="text-sm font-semibold">{text.roles}</legend><div className="mt-2 grid grid-cols-2 gap-2">
   {CONTACT_ROLES.map(role => <label key={role} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(role)} disabled={record.data.tipo === role} onChange={e => update({ [`crm_role_${role}`]: e.target.checked })} style={{ accentColor: 'var(--crm-primary)' }} />{text[role]}</label>)}
  </div><p className="mt-2 text-xs" style={{ color: 'var(--crm-muted)' }}>{text.primary}</p></fieldset>
 </section>;
}
