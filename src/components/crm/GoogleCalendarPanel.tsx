import { AlertTriangle, CalendarCheck, CalendarPlus, Loader2 } from 'lucide-react';
import { GOOGLE_NOT_CONFIGURED } from '@/lib/crm/api';
import type { GoogleStatus } from '@/lib/crm/api';

// What the "Google Calendar" panel of an app shows: guest mode (needs an
// account), server not set up (says so plainly), not connected, or connected.
// It never pretends: without the Google secrets on the server there is no
// connect button, only the links that work without an account.

interface Props {
  status: GoogleStatus | null;
  working: boolean;
  busyCount: number;
  onConnect: () => void;
  onDisconnect: () => void;
}

function Always() {
  return (
    <div className="rounded-xl border bg-card p-3 text-sm">
      <p className="flex items-center gap-2 font-medium"><CalendarPlus className="h-4 w-4 text-primary" /> Sin conectar nada</p>
      <p className="mt-1 text-muted-foreground">Cada cita, visita, seguimiento, limpieza o reserva tiene en su ficha «Añadir a Google Calendar» (se abre ya rellena) y «Descargar .ics» para Apple Calendar u Outlook.</p>
    </div>
  );
}

export function GoogleCalendarPanel({ status, working, busyCount, onConnect, onDisconnect }: Props) {
  if (!status) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Mirando tu conexión con Google…</p>;

  let main;
  if (!status.available) {
    main = <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{status.mensaje}</p>;
  } else if (!status.configured) {
    main = (
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {GOOGLE_NOT_CONFIGURED}</p>
        <p className="mt-1">Todavía no se puede conectar ninguna cuenta de Google. Quien administre StateHubs tiene que crear las credenciales en Google Cloud y ponerlas como secretos de la función crm-google.</p>
        {status.mensaje && <p className="mt-1 text-xs opacity-80">{status.mensaje}</p>}
      </div>
    );
  } else if (!status.connected) {
    main = (
      <div className="rounded-xl border bg-card p-3 text-sm">
        <p className="font-medium">Conecta tu Google Calendar</p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          <li>Cuando agendas una cita o la mueves, aparece sola en tu calendario.</li>
          <li>Al elegir hora, las que ya tienes ocupadas en Google salen tachadas.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Solo pedimos ver tus horas ocupadas y crear o cambiar los eventos que mande StateHubs. Puedes desconectarlo cuando quieras.</p>
        <button onClick={onConnect} disabled={working} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Conectar Google Calendar
        </button>
      </div>
    );
  } else {
    main = (
      <div className="rounded-xl border bg-card p-3 text-sm">
        <p className="flex items-center gap-2 font-medium"><CalendarCheck className="h-4 w-4 text-emerald-600" /> Conectado{status.email ? ` como ${status.email}` : ''}</p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          <li>Las citas que agendes o muevas se guardan solas en tu calendario principal.</li>
          <li>Las reservas y lo demás, con «Guardar en mi Google Calendar» en su ficha.</li>
          <li>{busyCount > 0 ? `${busyCount} ${busyCount === 1 ? 'rato ocupado' : 'ratos ocupados'} en las próximas semanas: esas horas salen tachadas al agendar.` : 'No tienes nada ocupado en las próximas semanas.'}</li>
        </ul>
        <button onClick={onDisconnect} disabled={working} className="mt-3 w-full rounded-lg border px-3 py-2 disabled:opacity-50">Desconectar</button>
      </div>
    );
  }
  return <div className="flex flex-col gap-3">{main}<Always /></div>;
}
