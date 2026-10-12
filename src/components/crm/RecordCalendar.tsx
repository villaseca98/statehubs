import { useState } from 'react';
import { CalendarCheck, CalendarPlus, Download, ExternalLink, Loader2 } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { downloadIcs, eventFor, googleCalendarUrl } from '@/lib/crm/calendar';
import { useGoogleCalendar } from './googleCalendarContext';

// Calendar actions of a record with a date (an appointment, a follow-up, a
// cleaning, a stay). Always: open it in Google Calendar ready to save, or
// download a .ics. With Google connected, also save it straight away.

const PUSHED: Record<string, string> = {
  creado: 'Guardada en tu Google Calendar.',
  actualizado: 'Actualizada en tu Google Calendar.',
  quitado: 'Quitada de tu Google Calendar.',
  sin_fecha: 'No tiene fecha: no hay nada que guardar.',
};

const button = 'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[0.92em] font-medium disabled:opacity-50';
const outline = { border: '1px solid var(--crm-border)', color: 'var(--crm-primary)', borderRadius: 'calc(var(--crm-radius) * 0.75)' };

export function RecordCalendar({ blueprint, record, records }: { blueprint: Blueprint; record: AppRecord; records: AppRecord[] }) {
  const google = useGoogleCalendar();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; link?: string; error?: boolean } | null>(null);
  const event = eventFor(blueprint, record, records);
  if (!event) return null;

  const save = async () => {
    if (!google?.push) return;
    setBusy(true); setDone(null);
    try {
      const res = await google.push(record);
      setDone({ text: PUSHED[res.estado] ?? 'Hecho.', link: res.enlace });
    } catch (e) {
      setDone({ text: (e as Error).message, error: true });
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="Calendario" className="mb-4 flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={button} style={outline}>
          <CalendarPlus className="h-4 w-4" /> Añadir a Google Calendar
        </a>
        <button type="button" onClick={() => downloadIcs(event, record.id)} className={button} style={outline} title="Para Apple Calendar, Outlook o cualquier calendario">
          <Download className="h-4 w-4" /> Descargar .ics
        </button>
        {google?.connected && google.push && (
          <button type="button" onClick={save} disabled={busy} className={button} style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)', borderRadius: 'calc(var(--crm-radius) * 0.75)' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Guardar en mi Google Calendar
          </button>
        )}
      </div>
      {done && (
        <div role="status" className={`text-[0.85em] ${done.error ? 'font-medium' : ''}`} style={{ color: done.error ? 'var(--crm-text)' : 'var(--crm-muted)' }}>
          {done.text}
          {done.link && <> <a href={done.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline" style={{ color: 'var(--crm-primary)' }}>Abrir <ExternalLink className="h-3 w-3" /></a></>}
        </div>
      )}
    </section>
  );
}
