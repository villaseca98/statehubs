import { useState } from 'react';
import { ChevronDown, Mail, Phone, Sparkles } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { explicitlyQualified, propertyContacts, recordLabel } from '@/lib/crm/propertyFeed';
import { usePropertyFeedText } from '@/i18n/propertyFeed';

const value = (r: AppRecord, keys: string[]) => keys.map(k => r.data[k]).find(v => typeof v === 'string' && v.trim()) as string | undefined;

// Workspace supplies only records accessible through the app membership/RLS boundary.
export function PropertyLeads({ property, records, blueprint, onOpen, onMatch }: {
 property: AppRecord; records: AppRecord[]; blueprint: Blueprint; onOpen: (r: AppRecord) => void; onMatch?: () => void;
}) {
 const t = usePropertyFeedText();
 const [section, setSection] = useState<'qualified' | 'potential'>('qualified');
 const [limit, setLimit] = useState(10);
 const leads = propertyContacts(property, records, blueprint);
 const groups = { qualified: leads.filter(explicitlyQualified), potential: leads.filter(r => !explicitlyQualified(r)) };
 const shown = groups[section];
 return <div className="space-y-3">
  <div className="flex gap-2 rounded-xl p-1" style={{ background: 'var(--crm-bg)' }} role="group" aria-label={t.qualification}>
   {(['qualified', 'potential'] as const).map(key => <button type="button" key={key} aria-pressed={section === key}
    onClick={() => { setSection(key); setLimit(10); }} className="min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold"
    style={{ background: section === key ? 'var(--crm-surface)' : 'transparent' }}>{t[key]} ({groups[key].length})</button>)}
  </div>
  {onMatch && <button type="button" onClick={onMatch} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: 'var(--crm-border)' }}><Sparkles className="h-4 w-4" />{t.match}</button>}
  {shown.slice(0, limit).map(r => {
   const email = value(r, ['email', 'correo', 'correo_electronico']);
   const phone = value(r, ['phone', 'telefono', 'mobile', 'whatsapp']);
   const source = value(r, ['source', 'origen', 'lead_source']);
   return <details key={r.id} className="group rounded-xl border p-3" style={{ borderColor: 'var(--crm-border)' }}>
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
     <span className="min-w-0 break-words">{recordLabel(r, blueprint, t.unnamed)}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 group-open:rotate-180" />
    </summary>
    <div className="mt-2 space-y-2 border-t pt-3 text-sm" style={{ borderColor: 'var(--crm-border)' }}>
     <p>{section === 'qualified' ? t.qualificationRecorded : t.pending}</p>
     {source && <p className="break-words">{source}</p>}
     {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? <a className="flex min-h-11 items-center gap-2 break-all underline" href={`mailto:${encodeURIComponent(email)}`}><Mail className="h-4 w-4 shrink-0" />{email}</a> : <p>{t.emailMissing}</p>}
     {phone && /\d{3}/.test(phone.replace(/\D/g, '')) ? <a className="flex min-h-11 items-center gap-2 underline" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone className="h-4 w-4" />{phone}</a> : <p>{t.phoneMissing}</p>}
     <button type="button" onClick={() => onOpen(r)} className="min-h-11 font-semibold underline">{t.openLead}</button>
    </div>
   </details>;
  })}
  {!shown.length && <p className="rounded-xl p-4 text-sm" style={{ background: 'var(--crm-bg)' }}>{t.noLeads}</p>}
  {shown.length > limit && <button type="button" className="min-h-11 underline" onClick={() => setLimit(n => n + 10)}>{t.more}</button>}
  <p className="text-xs" style={{ color: 'var(--crm-muted)' }}>{t.leadHelp}</p>
 </div>;
}
