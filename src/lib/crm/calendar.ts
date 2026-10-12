// Google Calendar helpers for the app. The rules live in the shared blueprint
// folder so the crm-google function builds exactly the same event.
export { addMinutes, compactDate, datetimeFields, eventFor, googleCalendarUrl, isLocalDateTime, localToUtc, slotMinutesFor, utcToLocal, TIME_ZONE } from '@shared/blueprint/calendar.ts';
export type { CalendarEvent } from '@shared/blueprint/calendar.ts';
import type { AppRecord, Blueprint, RecordData } from '@shared/blueprint/types.ts';
import { datetimeFields } from '@shared/blueprint/calendar.ts';

// Whether a save should reach Google Calendar: the entity has a datetime field
// and the record has (or had) a date in one of them.
export function touchesCalendar(bp: Blueprint, record: AppRecord, before: RecordData | null): boolean {
  const fields = datetimeFields(bp.entities.find((e) => e.key === record.entity));
  return fields.some((f) => !!record.data[f.key] || !!before?.[f.key]);
}
