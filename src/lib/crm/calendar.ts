// Google Calendar helpers for the app. The rules live in the shared blueprint
// folder so the crm-google function builds exactly the same event.
export { addDays, addMinutes, compactDate, dateRangeFields, datetimeFields, eventFieldKeys, eventFor, googleCalendarUrl, icsFor, isLocalDateTime, localToUtc, slotMinutesFor, utcToLocal, TIME_ZONE } from '@shared/blueprint/calendar.ts';
export type { CalendarEvent } from '@shared/blueprint/calendar.ts';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import { datetimeFields, icsFor } from '@shared/blueprint/calendar.ts';
import type { CalendarEvent } from '@shared/blueprint/calendar.ts';

// Whether a save should reach Google Calendar: the entity has a datetime field
// and the record has (or had) a date in one of them.
export function touchesCalendar(bp: Blueprint, record: AppRecord, before: RecordData | null): boolean {
  const fields = datetimeFields(bp.entities.find((e) => e.key === record.entity));
  return fields.some((f) => !!record.data[f.key] || !!before?.[f.key]);
}

// Whether a change (the fields it sets) moves an appointment: what triggers the
// automatic sync when Google is connected. Stays (bookings) are only sent by
// hand, so a calendar import doesn't flood the person's Google Calendar.
export function patchMovesAppointment(bp: Blueprint, entity: string, patch: RecordData): boolean {
  return datetimeFields(bp.entities.find((e) => e.key === entity)).some((f) => f.key in patch);
}

// Safe file name for the .ics download.
export function icsFileName(e: CalendarEvent): string {
  const base = e.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cita';
  return `${base}-${e.start.slice(0, 10)}.ics`;
}

// Saves the event as a .ics file (any calendar app opens it, no account needed).
export function downloadIcs(e: CalendarEvent, uid: string) {
  const blob = new Blob([icsFor(e, uid)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(e);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
