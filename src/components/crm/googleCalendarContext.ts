import { createContext, useContext } from 'react';
import type { AppRecord } from '@shared/blueprint/types.ts';
import type { BusyInterval } from '@shared/blueprint/slots.ts';
import type { GooglePushResult } from '@/lib/crm/api';

// The person's Google Calendar, when the app around the workspace has one
// connected (AppPage). Views read it without new props through Workspace:
// booking marks `busy` hours as taken, and a record can be sent with `push`.
export interface GoogleCalendarActions {
  connected: boolean;
  busy: BusyInterval[];
  push?: (record: AppRecord) => Promise<GooglePushResult>;
}

export const GoogleCalendarContext = createContext<GoogleCalendarActions | null>(null);
export const useGoogleCalendar = () => useContext(GoogleCalendarContext);
