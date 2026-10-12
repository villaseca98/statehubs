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

// ops: the operations centre (no entity): today's arrivals, departures,
// cleanings, visits, deals and alerts, all read from the records.
// timeline: one row per record of rowField's entity (a property) with a bar
// per record from startField to endField (a reservation), overlaps flagged.
// cards: a gallery of records with a photo (imageField) and their key fields.
export type ViewType = 'table' | 'kanban' | 'calendar' | 'dashboard' | 'worklist' | 'analysis' | 'ops' | 'timeline' | 'cards';
export const VIEW_TYPES: ViewType[] = ['table', 'kanban', 'calendar', 'dashboard', 'worklist', 'analysis', 'ops', 'timeline', 'cards'];

// Worklist actions. Each is a button on a row, shown only in the stages
// listed in `when` (all stages if empty), so what you can do depends on
// where the lead or record is.
// launch: turns each line of a long text (the steps of a process) into a
// record of another entity (a task), linked back to this one.
// webhook: sends this record to the URL in one of its fields (to test an automation).
// link: opens the web address in one of its url fields (the Instagram chat, a listing…).
export type ActionKind = 'call' | 'whatsapp' | 'email' | 'move' | 'schedule' | 'launch' | 'webhook' | 'link';
export const ACTION_KINDS: ActionKind[] = ['call', 'whatsapp', 'email', 'move', 'schedule', 'launch', 'webhook', 'link'];

export interface ViewAction {
  kind: ActionKind;
  label: string;
  field?: string;    // call/whatsapp: phone; email: email; schedule: datetime; launch: longtext (one step per line); webhook/link: url
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
  entity?: string;      // all but dashboard, analysis and ops
  columns?: string[];   // table: field keys, in order; cards: fields shown under the title
  groupBy?: string;     // kanban: select field; timeline/cards: select that colours bars or badges
  dateField?: string;   // calendar: date or datetime field
  sumField?: string;    // kanban: money/number field summed per column
  widgets?: DashboardWidget[]; // dashboard
  actions?: ViewAction[];       // worklist (groupBy = stage select, optional)
  availability?: Availability;  // worklist with schedule actions
  analysis?: AnalysisConfig;    // analysis
  startField?: string;  // timeline: date or datetime where the bar starts
  endField?: string;    // timeline: date or datetime where it ends
  rowField?: string;    // timeline: relation whose target records are the rows
  imageField?: string;  // cards: url field with the photo
}

// The Instagram assistant («bot»). It lives in the blueprint, so it changes
// like everything else: as a proposal you see before applying, with history.
// The engine that runs it is bot.ts (pure: the browser simulator and the
// server webhook run exactly the same code).
// Answers are saved in a field of the contact (contacto_inmo) or of the
// conversation (conversacion); rules turn them into a 0–100 score.
export type BotTarget = 'contacto_inmo' | 'conversacion';
export const BOT_TARGETS: BotTarget[] = ['contacto_inmo', 'conversacion'];

export interface BotChoice {
  label: string;   // the quick-reply button (Instagram allows 20 characters)
  value: string;   // what is saved: an option value for selects, a number for amounts, else the text
}

export interface BotQuestion {
  key: string;          // stable id of the question (letters, numbers, _)
  text: string;
  entity: BotTarget;
  field: string;
  options?: BotChoice[];
  optional?: boolean;   // «prefiero no» moves on
}

// gte/lte compare numbers; eq compares the saved value; filled = has any answer.
export type BotRuleOp = 'gte' | 'lte' | 'eq' | 'filled';
export const BOT_RULE_OPS: BotRuleOp[] = ['gte', 'lte', 'eq', 'filled'];
export interface BotRule {
  entity: BotTarget;
  field: string;
  op: BotRuleOp;
  value?: string | number;
  points: number;       // −100…100
}

// agenda: offers free slots of the contacts' availability and books a cita_inmo.
// reserva: asks dates and guests, checks which tourist flats are free and
// leaves a «pendiente» booking for a person to confirm (it never charges).
// humano: thanks and hands over to the team.
export type BotFinishMode = 'agenda' | 'reserva' | 'humano';
export const BOT_FINISH_MODES: BotFinishMode[] = ['agenda', 'reserva', 'humano'];
export type BotTemplate = 'compradores' | 'vendedores' | 'reservas';

export interface BotConfig {
  enabled: boolean;
  template?: BotTemplate;   // the template it started from
  auto?: boolean;           // untouched template: it adapts to the pieces you add
  keywords: string[];       // words that start it from a comment («INFO», «PISO»…)
  anyDm: boolean;           // also answer a new direct message without a keyword
  commentReply?: string;    // public answer under the comment («¡Te escribo por privado!»)
  welcome: string;          // {nombre} and {negocio} are filled in
  questions: BotQuestion[];
  rules: BotRule[];
  hot: number;              // score ≥ hot → caliente
  warm: number;             // score ≥ warm → templado; below → frío
  qualify: number;          // score ≥ qualify → the finish; below → a person follows up
  finish: { mode: BotFinishMode; citaTipo?: string; text?: string };
  goodbye: string;
}

export interface Blueprint {
  version: 1;
  name: string;
  description?: string;
  kind?: 'crm' | 'erp';
  modules?: string[]; // module cards in use (see modules.ts)
  sector?: string;    // business template whose extra fields it carries (see sectors.ts)
  logo?: string;      // the app's own logo (small PNG/JPEG/WebP data URL); none = the StateHubs mark
  bot?: BotConfig;    // the Instagram assistant (piece «Leads de Instagram»)
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
