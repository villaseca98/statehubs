// The blueprint ("plano") of a generated CRM/ERP app. The AI only ever writes
// this structure; the runtime renders it and the database stores records as
// JSON keyed by field key. No generated code runs.

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'money'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'relation'
  | 'nif';

export const FIELD_TYPES: FieldType[] = [
  'text', 'longtext', 'number', 'money', 'percent', 'date', 'datetime', 'boolean',
  'email', 'phone', 'url', 'select', 'relation', 'nif',
];

export type OptionColor = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'pink';
export const OPTION_COLORS: OptionColor[] = ['gray', 'blue', 'green', 'amber', 'red', 'purple', 'teal', 'pink'];

export interface SelectOption {
  value: string;
  label: string;
  color?: OptionColor;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: SelectOption[];   // select
  relation?: string;          // relation: target entity key
  help?: string;
}

export interface Entity {
  key: string;
  label: string;        // singular, e.g. "Cliente"
  labelPlural: string;  // e.g. "Clientes"
  titleField: string;   // field key shown as the record's name
  fields: Field[];
}

export type ViewType = 'table' | 'kanban' | 'calendar' | 'dashboard' | 'worklist' | 'analysis';
export const VIEW_TYPES: ViewType[] = ['table', 'kanban', 'calendar', 'dashboard', 'worklist', 'analysis'];

// Worklist actions. Each is a button on a row, shown only in the stages
// listed in `when` (all stages if empty), so what you can do depends on
// where the lead or record is.
// launch: turns each line of a long text (the steps of a process) into a
// record of another entity (a task), linked back to this one.
// webhook: sends this record to the URL in one of its fields (to test an automation).
export type ActionKind = 'call' | 'whatsapp' | 'email' | 'move' | 'schedule' | 'launch' | 'webhook';
export const ACTION_KINDS: ActionKind[] = ['call', 'whatsapp', 'email', 'move', 'schedule', 'launch', 'webhook'];

export interface ViewAction {
  kind: ActionKind;
  label: string;
  field?: string;    // call/whatsapp: phone; email: email; schedule: datetime; launch: longtext (one step per line); webhook: url
  to?: string;       // move: stage to set; schedule/launch: stage to set afterwards (optional)
  when?: string[];   // stage values where the action is offered
  entity?: string;   // launch: entity the steps become (needs a relation back to this one)
}

// Bookable hours for `schedule` actions. Taken slots are the ones already
// used by another record of the same entity in the same datetime field.
export interface Availability {
  days: number[];       // 1 = lunes … 7 = domingo
  from: string;         // "09:00"
  to: string;           // "14:00" (last slot ends here)
  slotMinutes: number;  // 15–240
  breakFrom?: string;   // optional pause, e.g. lunch
  breakTo?: string;
}

export type MetricAgg = 'count' | 'sum' | 'avg';

export interface DashboardWidget {
  kind: 'metric' | 'bars';
  label: string;
  entity: string;
  agg: MetricAgg;
  field?: string;    // numeric field for sum/avg
  groupBy?: string;  // select field, for bars
}

// The analysis screen reads the records of the sections it is pointed at.
// oportunidades: open value, forecast, win rate and where the funnel sticks.
// leads: every open record scored 0–100 with its reasons, and the ones going cold.
// casuisticas: which origin, client or reason wins or loses more than average.
// datos: the database behind it: how much of each, what is missing, CSV export.
export type AnalysisLens = 'oportunidades' | 'leads' | 'casuisticas' | 'datos';
export const ANALYSIS_LENSES: AnalysisLens[] = ['oportunidades', 'leads', 'casuisticas', 'datos'];

export interface AnalysisConfig {
  lenses: AnalysisLens[];
  staleDays: number;     // open and untouched for longer than this = going cold
  entities?: string[];   // sections to analyse; empty = every section with stages or amounts
}

export interface View {
  key: string;
  label: string;
  type: ViewType;
  entity?: string;      // all but dashboard
  columns?: string[];   // table: field keys, in order
  groupBy?: string;     // kanban: select field
  dateField?: string;   // calendar: date or datetime field
  sumField?: string;    // kanban: money/number field summed per column
  widgets?: DashboardWidget[]; // dashboard
  actions?: ViewAction[];       // worklist (groupBy = stage select, optional)
  availability?: Availability;  // worklist with schedule actions
  analysis?: AnalysisConfig;    // analysis
}

export interface Blueprint {
  version: 1;
  name: string;
  description?: string;
  kind?: 'crm' | 'erp';
  modules?: string[]; // module cards in use (see modules.ts)
  sector?: string;    // business template whose extra fields it carries (see sectors.ts)
  logo?: string;      // the app's own logo (small PNG/JPEG/WebP data URL); none = the StateHubs mark
  entities: Entity[];
  views: View[];      // navigation order = array order
}

export type RecordData = Record<string, unknown>;

export interface AppRecord {
  id: string;
  entity: string;
  data: RecordData;
  is_sample?: boolean;
  created_at?: string;
  updated_at?: string;
}
