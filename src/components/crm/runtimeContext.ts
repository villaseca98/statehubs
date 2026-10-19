import { createContext, useContext } from 'react';
import type { AppRecord, RecordData } from '@shared/blueprint/types.ts';

// Things a view can ask the app around it to do, without threading props
// through every layout: create records quietly (a process launched as tasks)
// and send a record to a webhook (testing an automation).
export interface RuntimeActions {
  canEdit?: boolean;
  canDelete?: boolean;
  createQuietly: (entity: string, data: RecordData) => unknown;
  sendWebhook?: (record: AppRecord) => Promise<string> | string | void;
  /** Open the Matcher for a property or contact, and the mini-CRM of a property. */
  openMatcher?: (id: string) => void;
  openPropertyHub?: (id: string) => void;
}

export const RuntimeContext = createContext<RuntimeActions | null>(null);
export const useRuntime = () => useContext(RuntimeContext);
