import { createContext, useContext } from 'react';
import type { AppRecord, RecordData } from '@shared/blueprint/types.ts';
import type { BusyInterval } from '@shared/blueprint/slots.ts';

// Things a view can ask the app around it to do, without threading props
// through every layout: create records quietly (a process launched as tasks)
// and send a record to a webhook (testing an automation). `busy` is what the
// person's Google Calendar already has, so booking avoids those hours.
export interface RuntimeActions {
  createQuietly: (entity: string, data: RecordData) => unknown;
  sendWebhook?: (record: AppRecord) => Promise<string> | string | void;
  busy?: BusyInterval[];
}

export const RuntimeContext = createContext<RuntimeActions | null>(null);
export const useRuntime = () => useContext(RuntimeContext);
