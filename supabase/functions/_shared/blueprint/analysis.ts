import { ANALYSIS_LENSES } from './types.ts';
import type { AnalysisConfig, AnalysisLens, AppRecord, Blueprint, Entity, Field, SelectOption } from './types.ts';

// The data analyst inside every app. It reads the records the person already
// has (no AI, no extra tables) and answers four questions: how much is open
// and how much will close, who to work on today, what kind of case wins or
// loses, and what the database holds. Pure functions, so the browser, tests
// and any server code get the same numbers.

export const LENS_INFO: Record<AnalysisLens, { name: string; pitch: string }> = {
  oportunidades: { name: 'Embudo y previsión', pitch: 'Cuánto tienes abierto, cuánto vas a cerrar y en qué paso se atasca.' },
  leads: { name: 'A quién atacar hoy', pitch: 'Cada registro abierto puntuado del 0 al 100, con el porqué, y los que se están enfriando.' },
  casuisticas: { name: 'Casuísticas', pitch: 'Qué origen, cliente o motivo gana y cuál pierde más que la media.' },
  datos: { name: 'Base de datos', pitch: 'Cuánto tienes de cada cosa, qué falta por rellenar y descarga en CSV.' },
};

export const DEFAULT_ANALYSIS: AnalysisConfig = { lenses: [...ANALYSIS_LENSES], staleDays: 7 };
export const STALE_CHOICES = [3, 7, 14, 30];

export type Outcome = 'won' | 'lost' | 'open';

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const WON = /^(ganad|aceptad|cobrad|hech|entregad|resuelt|pagad|completad|firmad|cerrad|vendid|alquilad)/;
const LOST = /^(perdid|rechazad|cancelad|descartad|anulad|retirad|no[ _]interesa)/;

export function outcomeOf(o: SelectOption | undefined): Outcome {
  if (!o) return 'open';
  if ([o.value, o.label].some((x) => LOST.test(norm(x)))) return 'lost';
  if ([o.value, o.label].some((x) => WON.test(norm(x)))) return 'won';
  return 'open';
}

// What a section's fields mean for the analysis.
export interface Section {
  entity: Entity;
  stage?: Field;        // where each record is (the select a board or list groups by)
  value?: Field;        // the amount to add up
  probability?: Field;  // percent the person sets by hand
  due?: Field;          // when it should happen (close date, due date, appointment)
  since?: Field;        // when it came in
}

const DUE = ['cierre', 'vence', 'limite', 'entrega', 'cita', 'cuando', 'caduca'];
const SINCE = ['entrada', 'alta', 'abierta', 'captado', 'fecha', 'creado'];

export function sectionOf(bp: Blueprint, key: string): Section | undefined {
  const entity = bp.entities.find((e) => e.key === key);
  if (!entity) return undefined;
  const field = (k?: string) => entity.fields.find((f) => f.key === k);
  const grouped = bp.views.filter((v) => v.entity === key && v.groupBy).map((v) => field(v.groupBy)).find((f) => f?.type === 'select');
  const stage = grouped ?? entity.fields.find((f) => f.type === 'select' && f.options?.some((o) => outcomeOf(o) !== 'open'));
  const summed = bp.views.filter((v) => v.entity === key && v.sumField).map((v) => field(v.sumField)).find(Boolean);
  const value = summed ?? entity.fields.find((f) => f.type === 'money');
  const probability = entity.fields.find((f) => f.type === 'percent' && /probab/.test(norm(`${f.key} ${f.label}`)));
  const dated = (keys: string[]) => keys.map((k) => entity.fields.find((f) => f.key === k && (f.type === 'date' || f.type === 'datetime'))).find(Boolean);
  return { entity, stage, value, probability, due: dated(DUE), since: dated(SINCE) };
}

// Sections worth analysing: the ones the person picked, else those with an
// outcome (won/lost) or an amount to follow.
export function analysedSections(bp: Blueprint, config?: AnalysisConfig): Section[] {
  const keys = config?.entities?.length ? config.entities : bp.entities.map((e) => e.key);
  return keys.map((k) => sectionOf(bp, k)).filter((s): s is Section => {
    if (!s) return false;
    if (config?.entities?.length) return true;
    return !!s.stage?.options?.some((o) => outcomeOf(o) !== 'open') || (!!s.value && !!s.stage);
  }).slice(0, 8);
}

export interface Scored { record: AppRecord; score: number; chance: number; reasons: string[] }
export interface Cooling { record: AppRecord; days: number; reason: string }
export interface Pattern { tone: 'good' | 'bad' | 'info'; text: string; weight: number }
export interface FunnelStep { option: SelectOption; outcome: Outcome; count: number; value: number; reached: number }

export interface Analysis {
  section: Section;
  total: number;
  open: AppRecord[];
  won: AppRecord[];
  lost: AppRecord[];
  winRate: number | null;      // 0–1, over closed records
  openValue: number;
  wonValue: number;
  avgWon: number | null;
  forecast: number | null;     // open value × chance of each
  funnel: FunnelStep[];
  ranking: Scored[];
  cooling: Cooling[];
  patterns: Pattern[];
}

const DAY = 864e5;
const dayOf = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const eur = (v: number) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v)} €`;
const num = (r: AppRecord, f?: Field) => (f ? Number(r.data[f.key]) || 0 : 0);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// Fields that split records into groups worth comparing.
function segmentFields(s: Section): Field[] {
  return s.entity.fields.filter((f) => f.key !== s.stage?.key && (f.type === 'select' || f.type === 'relation' || f.type === 'boolean'));
}

function segmentLabel(f: Field, v: unknown, titleOf: (id: string) => string | undefined): string {
  if (f.type === 'select') return f.options?.find((o) => o.value === v)?.label ?? String(v);
  if (f.type === 'relation') return titleOf(String(v)) ?? 'sin nombre';
  return v ? 'Sí' : 'No';
}

export function analyse(bp: Blueprint, records: AppRecord[], s: Section, config: AnalysisConfig = DEFAULT_ANALYSIS, now = new Date(), titleOf: (id: string) => string | undefined = () => undefined): Analysis {
  const today = localDay(now);
  const mine = records.filter((r) => r.entity === s.entity.key);
  const options = s.stage?.options ?? [];
  const optionOf = (r: AppRecord) => options.find((o) => o.value === r.data[s.stage?.key ?? '']);
  const outcome = (r: AppRecord) => outcomeOf(optionOf(r));
  const open = mine.filter((r) => outcome(r) === 'open');
  const won = mine.filter((r) => outcome(r) === 'won');
  const lost = mine.filter((r) => outcome(r) === 'lost');
  const closed = won.length + lost.length;
  const winRate = closed ? won.length / closed : null;
  const sum = (rs: AppRecord[]) => rs.reduce((t, r) => t + num(r, s.value), 0);
  const openValue = sum(open);
  const wonValue = sum(won);

  // Funnel in the order of the options. "reached" counts everything at this
  // open step or further along (won included), so drop-off between steps shows.
  // Lost ones count only for the first step: we don't know where they dropped.
  const openSteps = options.filter((o) => outcomeOf(o) === 'open');
  const funnel: FunnelStep[] = options.map((o) => {
    const at = mine.filter((r) => r.data[s.stage!.key] === o.value);
    const i = openSteps.indexOf(o);
    const reached = i < 0 ? at.length : mine.filter((r) => { const j = openSteps.findIndex((x) => x.value === r.data[s.stage!.key]); return j >= i || outcome(r) === 'won' || (i === 0 && outcome(r) === 'lost'); }).length;
    return { option: o, outcome: outcomeOf(o), count: at.length, value: sum(at), reached };
  });

  // The group (origin, client…) that best tells won from lost, used to score open ones.
  const segRate = new Map<string, { field: Field; rates: Map<string, [number, number]> }>();
  for (const f of segmentFields(s)) {
    const rates = new Map<string, [number, number]>();
    for (const r of [...won, ...lost]) {
      const v = r.data[f.key];
      if (v === undefined || v === null || v === '') continue;
      const [w, n] = rates.get(String(v)) ?? [0, 0];
      rates.set(String(v), [w + (outcome(r) === 'won' ? 1 : 0), n + 1]);
    }
    segRate.set(f.key, { field: f, rates });
  }

  const openValues = open.map((r) => num(r, s.value)).filter((v) => v > 0).sort((a, b) => a - b);
  const maxOpen = openValues[openValues.length - 1] ?? 0;
  const highValue = openValues[Math.floor(openValues.length * 0.66)] ?? Infinity;
  const ageOf = (r: AppRecord) => {
    const d = dayOf(s.since ? r.data[s.since.key] : undefined) ?? dayOf(r.created_at);
    return d ? daysBetween(d, today) : null;
  };

  const ranking: Scored[] = open.map((r) => {
    const reasons: string[] = [];
    const o = optionOf(r);
    const step = o ? openSteps.indexOf(o) : -1;
    const progress = openSteps.length > 1 && step >= 0 ? step / (openSteps.length - 1) : 0.5;
    let chance = clamp((winRate ?? 0.3) * (0.6 + 0.8 * progress), 0.02, 0.95);
    const typed = s.probability ? Number(r.data[s.probability.key]) : NaN;
    if (Number.isFinite(typed) && s.probability && r.data[s.probability.key] !== undefined && r.data[s.probability.key] !== '') {
      chance = clamp(typed / 100, 0, 1);
      reasons.push(`Probabilidad ${Math.round(typed)} %`);
    } else {
      // Blend in the history of its group when there is some.
      let best: { label: string; rate: number; w: number; n: number } | null = null;
      for (const { field, rates } of segRate.values()) {
        const v = r.data[field.key];
        const hit = v === undefined || v === null || v === '' ? undefined : rates.get(String(v));
        if (!hit || hit[1] < 2) continue;
        const rate = hit[0] / hit[1];
        if (!best || Math.abs(rate - (winRate ?? 0.5)) > Math.abs(best.rate - (winRate ?? 0.5))) best = { label: `${field.label} ${segmentLabel(field, v, titleOf)}`, rate, w: hit[0], n: hit[1] };
      }
      if (best) {
        chance = clamp((chance + best.rate) / 2, 0.02, 0.95);
        reasons.push(best.rate >= (winRate ?? 0.5) ? `${best.label}: ganas ${best.w} de ${best.n}` : `${best.label}: solo ${best.w} de ${best.n} salen`);
      } else if (step > 0 && o) reasons.push(`Ya está en «${o.label}»`);
    }
    const v = num(r, s.value);
    if (s.value && v > 0 && v >= highValue) reasons.push(`${eur(v)}, de los más altos`);
    const age = ageOf(r);
    const fresh = age === null ? 0.5 : age <= config.staleDays ? 1 : clamp(1 - (age - config.staleDays) / (3 * config.staleDays), 0, 1);
    if (age !== null && age <= 2) reasons.push(age === 0 ? 'Entró hoy' : `Entró hace ${age} ${age === 1 ? 'día' : 'días'}`);
    const due = dayOf(s.due ? r.data[s.due.key] : undefined);
    if (due === today) reasons.push(`${s.due!.label} hoy`);
    const parts: [number, number][] = [[chance, 45], [fresh, 20]];
    if (s.value && maxOpen > 0) parts.push([v / maxOpen, 35]);
    const score = Math.round((parts.reduce((t, [x, w]) => t + x * w, 0) / parts.reduce((t, [, w]) => t + w, 0)) * 100);
    return { record: r, score, chance, reasons: reasons.slice(0, 3) };
  }).sort((a, b) => b.score - a.score);

  const forecast = s.value && open.length ? ranking.reduce((t, x) => t + num(x.record, s.value) * x.chance, 0) : null;

  const cooling: Cooling[] = [];
  for (const r of open) {
    const o = optionOf(r);
    const where = o ? ` y sigue en «${o.label}»` : '';
    const due = dayOf(s.due ? r.data[s.due.key] : undefined);
    const age = ageOf(r);
    const touched = dayOf(r.updated_at);
    if (due && due < today) {
      const d = daysBetween(due, today);
      cooling.push({ record: r, days: d, reason: `${s.due!.label}: hace ${d} ${d === 1 ? 'día' : 'días'}${where}` });
    } else if (touched && daysBetween(touched, today) > config.staleDays) {
      const d = daysBetween(touched, today);
      cooling.push({ record: r, days: d, reason: `Sin cambios desde hace ${d} días${where}` });
    } else if (age !== null && age > config.staleDays && (!o || openSteps.indexOf(o) <= 1)) {
      cooling.push({ record: r, days: age, reason: `Entró hace ${age} días${where}` });
    }
  }
  cooling.sort((a, b) => b.days - a.days);

  return {
    section: s, total: mine.length, open, won, lost, winRate, openValue, wonValue,
    avgWon: won.length && s.value ? wonValue / won.length : null,
    forecast, funnel, ranking, cooling,
    patterns: patternsOf(s, mine, { won, lost, winRate, openValue, optionOf, outcome }, titleOf),
  };
}

interface Facts {
  won: AppRecord[]; lost: AppRecord[]; winRate: number | null; openValue: number;
  optionOf: (r: AppRecord) => SelectOption | undefined; outcome: (r: AppRecord) => Outcome;
}

// "Casuísticas": groups that win or lose clearly more than average, what the
// lost ones have in common, and where the money piles up.
function patternsOf(s: Section, mine: AppRecord[], f: Facts, titleOf: (id: string) => string | undefined): Pattern[] {
  const out: Pattern[] = [];
  const closed = f.won.length + f.lost.length;
  const lostLabel = [...new Set(f.lost.map((r) => f.optionOf(r)?.label).filter(Boolean))].join(' o ');
  const filled = (field: Field, r: AppRecord) => r.data[field.key] !== undefined && r.data[field.key] !== null && r.data[field.key] !== '';
  for (const field of segmentFields(s)) {
    // A field only ever filled on lost ones (the reason for losing) says nothing about winning.
    const lossOnly = f.lost.some((r) => filled(field, r)) && !mine.some((r) => f.outcome(r) !== 'lost' && filled(field, r));
    const groups = new Map<string, AppRecord[]>();
    for (const r of mine) {
      const v = r.data[field.key];
      if (v === undefined || v === null || v === '' || (field.type === 'boolean' && typeof v !== 'boolean')) continue;
      groups.set(String(v), [...(groups.get(String(v)) ?? []), r]);
    }
    if (groups.size < 2 && field.type !== 'select') continue;
    for (const [v, rs] of groups) {
      const label = `${field.label} «${segmentLabel(field, field.type === 'boolean' ? v === 'true' : v, titleOf)}»`;
      const w = rs.filter((r) => f.outcome(r) === 'won').length;
      const l = rs.filter((r) => f.outcome(r) === 'lost').length;
      let flagged = false;  // already said this group loses; don't say it twice
      if (!lossOnly && f.winRate !== null && closed >= 3 && w + l >= 2) {
        const rate = w / (w + l);
        const diff = rate - f.winRate;
        if (diff >= 0.2) out.push({ tone: 'good', weight: diff * (w + l), text: `${label}: ganas ${w} de ${w + l} (${pct(rate)}), frente al ${pct(f.winRate)} de media.` });
        else if (diff <= -0.2) {
          flagged = true;
          out.push({ tone: 'bad', weight: -diff * (w + l), text: `${label}: ganas ${w} de ${w + l}${rate > 0 ? ` (${pct(rate)})` : ''}; la media es ${pct(f.winRate)}.` });
        }
      }
      if (!flagged && f.lost.length >= 2 && l >= 2 && l / f.lost.length >= 0.5) {
        out.push({ tone: 'bad', weight: (l / f.lost.length) * 1.5, text: `De ${f.lost.length} en ${lostLabel}, ${l} tienen ${label}.` });
      }
    }
    // Where the money is: one client or group holding a big share.
    if (s.value && groups.size >= 2) {
      const total = mine.reduce((t, r) => t + num(r, s.value), 0);
      const top = [...groups].map(([v, rs]) => ({ v, value: rs.reduce((t, r) => t + num(r, s.value), 0) })).sort((a, b) => b.value - a.value)[0];
      if (total > 0 && top.value / total >= 0.4) {
        out.push({ tone: 'info', weight: top.value / total, text: `${field.label} «${segmentLabel(field, field.type === 'boolean' ? top.v === 'true' : top.v, titleOf)}» reúne el ${pct(top.value / total)} del importe (${eur(top.value)} de ${eur(total)}).` });
      }
    }
  }
  // Open money stuck in one step.
  if (s.stage && s.value && f.openValue > 0) {
    const byStep = new Map<string, number>();
    for (const r of mine) if (f.outcome(r) === 'open') { const o = f.optionOf(r); if (o) byStep.set(o.label, (byStep.get(o.label) ?? 0) + num(r, s.value)); }
    const [step, v] = [...byStep].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (byStep.size > 1 && v / f.openValue >= 0.5) out.push({ tone: 'info', weight: v / f.openValue, text: `El ${pct(v / f.openValue)} de lo abierto (${eur(v)}) está en «${step}».` });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

// ---- The database behind it ----

export interface Gap { field: Field; missing: number }

// Fields left empty most often (long notes and yes/no don't count). A field
// only ever filled in one stage (the appointment, the reason for losing) is
// only counted in that stage.
export function gapsOf(e: Entity, records: AppRecord[], stage?: Field): Gap[] {
  const mine = records.filter((r) => r.entity === e.key);
  if (!mine.length) return [];
  const empty = (r: AppRecord, k: string) => r.data[k] === undefined || r.data[k] === null || r.data[k] === '';
  const where = (f: Field) => {
    if (!stage || f.key === stage.key) return mine;
    const stages = new Set(mine.filter((r) => !empty(r, f.key)).map((r) => r.data[stage.key]));
    return stages.size === 1 ? mine.filter((r) => stages.has(r.data[stage.key])) : mine;
  };
  return e.fields.filter((f) => f.type !== 'longtext' && f.type !== 'boolean')
    .map((f) => ({ field: f, missing: where(f).filter((r) => empty(r, f.key)).length }))
    .filter((g) => g.missing > 0).sort((a, b) => b.missing - a.missing).slice(0, 3);
}

// Records that look like the same person or company: same email, same phone
// (last nine digits) or same NIF. Returns how many records are involved.
export function duplicatesOf(e: Entity, records: AppRecord[]): number {
  const keys = e.fields.filter((f) => f.type === 'email' || f.type === 'phone' || f.type === 'nif');
  const seen = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.entity !== e.key) continue;
    for (const f of keys) {
      const raw = String(r.data[f.key] ?? '');
      const v = f.type === 'phone' ? raw.replace(/\D/g, '').slice(-9) : raw.trim().toLowerCase().replace(/[\s.-]/g, '');
      if (v.length < (f.type === 'phone' ? 9 : 5)) continue;
      const k = `${f.type}:${v}`;
      seen.set(k, new Set([...(seen.get(k) ?? []), r.id]));
    }
  }
  const dup = new Set<string>();
  for (const ids of seen.values()) if (ids.size > 1) ids.forEach((id) => dup.add(id));
  return dup.size;
}

// Spanish spreadsheet CSV: semicolons, readable values, a BOM so accents survive.
export function toCsv(e: Entity, records: AppRecord[], titleOf: (id: string) => string | undefined = () => undefined): string {
  const cell = (v: unknown) => {
    let s = v === undefined || v === null ? '' : String(v);
    // [SECURITY] A cell starting with = + - @ would run as a formula in Excel; prefix it so it stays text.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const value = (f: Field, v: unknown) => {
    if (v === undefined || v === null || v === '') return '';
    if (f.type === 'select') return f.options?.find((o) => o.value === v)?.label ?? v;
    if (f.type === 'relation') return titleOf(String(v)) ?? '';
    if (f.type === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'number') return String(v).replace('.', ',');
    return v;
  };
  const rows = records.filter((r) => r.entity === e.key).map((r) => e.fields.map((f) => cell(value(f, r.data[f.key]))).join(';'));
  return `\uFEFF${[e.fields.map((f) => cell(f.label)).join(';'), ...rows].join('\r\n')}\r\n`;
}

// Keep an analysis view pointing only at sections that still exist.
export function tidyAnalysis(bp: Blueprint) {
  for (const v of bp.views) {
    if (v.type !== 'analysis' || !v.analysis?.entities) continue;
    const kept = v.analysis.entities.filter((k) => bp.entities.some((e) => e.key === k));
    if (kept.length) v.analysis.entities = kept; else delete v.analysis.entities;
  }
}

export function withAnalysis(bp: Blueprint, config: AnalysisConfig): Blueprint {
  const analysis: AnalysisConfig = { lenses: [...config.lenses], staleDays: config.staleDays };
  if (config.entities?.length) analysis.entities = [...config.entities];
  return { ...bp, views: bp.views.map((v) => (v.type === 'analysis' ? { ...v, analysis } : v)) };
}
