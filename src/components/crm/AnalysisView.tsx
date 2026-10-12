import { useEffect, useMemo, useState } from 'react';
import { Database, Download, Flame, PieChart, Snowflake, TrendingDown, TrendingUp } from 'lucide-react';
import type { AnalysisLens, AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { analyse, analysedSections, DEFAULT_ANALYSIS, duplicatesOf, gapsOf, LENS_INFO, sectionOf, toCsv } from '@shared/blueprint/analysis.ts';
import type { Analysis, Pattern } from '@shared/blueprint/analysis.ts';
import { chipStyle, titleOfRecord } from './theme';
import { Chip } from './views';
import type { ViewProps } from './views';

// The analysis screen: the same records, read as a data analyst would.
// Which lenses show and how many days make a record "cold" come from the
// blueprint (chosen when the app is put together).

const card = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' } as const;
const muted = { color: 'var(--crm-muted)' } as const;
const eur = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const pct = (x: number) => `${Math.round(x * 100)} %`;
// "teléfono", but "NIF/CIF" stays as it is.
const lowerFirst = (s: string) => (/^\p{Lu}{2}/u.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export function AnalysisView({ blueprint, view, records, dark, solid, titleOf, onOpen }: ViewProps) {
  const config = view.analysis ?? DEFAULT_ANALYSIS;
  const lenses = config.lenses.length ? config.lenses : DEFAULT_ANALYSIS.lenses;
  const sections = useMemo(() => analysedSections(blueprint, config), [blueprint, config]);
  // With nothing to measure yet (a contacts database), open on the database itself.
  const [lens, setLens] = useState<AnalysisLens>(sections.length === 0 && lenses.includes('datos') ? 'datos' : lenses[0]);
  const [sectionKey, setSectionKey] = useState<string | undefined>(sections[0]?.entity.key);
  useEffect(() => { if (!lenses.includes(lens)) setLens(lenses[0]); }, [lenses, lens]);
  const section = sections.find((s) => s.entity.key === sectionKey) ?? sections[0];
  const result = useMemo(() => (section ? analyse(blueprint, records, section, config, new Date(), titleOf) : null), [blueprint, records, section, config, titleOf]);

  return (
    <div className="flex flex-col" style={{ gap: 'var(--crm-gap)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Enfoques" className="flex max-w-full gap-1 overflow-x-auto p-1" style={{ background: 'color-mix(in srgb, var(--crm-border) 45%, transparent)', borderRadius: 'var(--crm-radius)' }}>
          {lenses.map((l) => (
            <button key={l} role="tab" aria-selected={l === lens} onClick={() => setLens(l)} className="whitespace-nowrap px-3 py-1.5 text-[0.92em]"
              style={{ borderRadius: 'var(--crm-radius)', background: l === lens ? 'var(--crm-surface)' : undefined, fontWeight: l === lens ? 600 : 400, boxShadow: l === lens ? '0 1px 2px rgba(0,0,0,0.08)' : undefined }}>
              {LENS_INFO[l].name}
            </button>
          ))}
        </div>
        {lens !== 'datos' && sections.length > 1 && (
          <div role="group" aria-label="Sección analizada" className="flex flex-wrap gap-1">
            {sections.map((s) => {
              const on = s.entity.key === section?.entity.key;
              return (
                <button key={s.entity.key} aria-pressed={on} onClick={() => setSectionKey(s.entity.key)} className="rounded-full px-2.5 py-1 text-[0.88em]"
                  style={on ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' } : { border: '1px solid var(--crm-border)' }}>
                  {s.entity.labelPlural}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[0.9em]" style={muted}>{LENS_INFO[lens].pitch}</p>

      {lens === 'datos' ? (
        <DataBase blueprint={blueprint} records={records} titleOf={titleOf} dark={dark} />
      ) : !result ? (
        <div style={{ ...card, padding: 'var(--crm-pad)', ...muted }}>Pon alguna pieza con etapas o importes (leads, embudo, presupuestos, facturas…) y aquí verás el análisis.</div>
      ) : lens === 'oportunidades' ? (
        <Funnel a={result} dark={dark} />
      ) : lens === 'leads' ? (
        <Priorities a={result} dark={dark} solid={solid} onOpen={onOpen} />
      ) : (
        <Patterns a={result} />
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ ...card, padding: 'var(--crm-pad)' }}>
      <div className="text-[0.9em]" style={muted}>{label}</div>
      <div className="mt-1 text-[1.6em] font-semibold leading-tight" style={{ fontFamily: 'var(--crm-number-font)' }}>{value}</div>
      {hint && <div className="mt-0.5 text-[0.8em]" style={muted}>{hint}</div>}
    </div>
  );
}

function Funnel({ a, dark }: { a: Analysis; dark: boolean }) {
  const { section: s } = a;
  const plural = s.entity.labelPlural.toLowerCase();
  const closed = a.won.length + a.lost.length;
  const steps = a.funnel.filter((f) => f.outcome !== 'lost');
  const lost = a.funnel.filter((f) => f.outcome === 'lost');
  const max = Math.max(1, ...steps.map((f) => (f.outcome === 'open' ? f.reached : f.count)));
  return (
    <>
      <section aria-label="Cifras del análisis" className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--crm-gap)' }}>
        <Tile label="Abierto" value={s.value ? eur(a.openValue) : String(a.open.length)} hint={`${a.open.length} ${plural} en marcha`} />
        <Tile label="Previsión de cierre" value={a.forecast !== null ? eur(a.forecast) : '—'} hint={a.forecast !== null ? (s.probability ? 'importe × probabilidad' : 'importe × tu tasa, por etapa y origen') : 'Hace falta un importe'} />
        <Tile label="Tasa de cierre" value={a.winRate !== null ? pct(a.winRate) : '—'} hint={closed ? `${a.won.length} de ${closed} cerrados` : 'Aún no hay cerrados'} />
        <Tile label="Ticket medio ganado" value={a.avgWon !== null ? eur(a.avgWon) : '—'} hint={a.won.length ? `${eur(a.wonValue)} ganados` : undefined} />
      </section>
      {s.stage && (
        <section aria-label="Por dónde pasan" style={{ ...card, padding: 'var(--crm-pad)' }}>
          <h3 className="mb-1 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}>Por dónde pasan</h3>
          <p className="mb-3 text-[0.85em]" style={muted}>Cuántos han llegado a cada paso (según dónde está cada uno ahora) y cuántos pasan al siguiente.</p>
          <ol className="flex flex-col gap-2">
            {steps.map((f, i) => {
              const n = f.outcome === 'open' ? f.reached : f.count;
              const next = steps[i + 1];
              const nextN = next ? (next.outcome === 'open' ? next.reached : next.count) : 0;
              return (
                <li key={f.option.value} className="grid grid-cols-[minmax(80px,130px)_1fr_auto] items-center gap-2 text-[0.92em]">
                  <span className="truncate">{f.option.label}</span>
                  <span className="h-6 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--crm-border) 50%, transparent)', borderRadius: 'var(--crm-radius)' }}>
                    <span className="flex h-full items-center px-2 text-[0.8em] font-semibold" style={{ width: `${Math.max(6, (n / max) * 100)}%`, ...chipStyle(f.option.color, dark, true), borderRadius: 'var(--crm-radius)' }}>{n}</span>
                  </span>
                  <span className="whitespace-nowrap text-right text-[0.85em]" style={{ ...muted, fontFamily: 'var(--crm-number-font)' }}>
                    {s.value && f.count ? `${eur(f.value)} · ` : ''}{next && n ? `${pct(nextN / n)} pasa` : f.outcome === 'won' ? 'ganados' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
          {lost.some((f) => f.count) && (
            <p className="mt-3 text-[0.88em]" style={muted}>
              {lost.map((f) => `${f.option.label}: ${f.count}${s.value && f.value ? ` (${eur(f.value)})` : ''}`).join(' · ')}
            </p>
          )}
        </section>
      )}
    </>
  );
}

function Priorities({ a, dark, solid, onOpen }: { a: Analysis; dark: boolean; solid?: boolean; onOpen: (r: AppRecord) => void }) {
  const { entity, stage } = a.section;
  const tone = (n: number) => (n >= 70 ? 'green' : n >= 40 ? 'amber' : 'gray');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" style={{ gap: 'var(--crm-gap)' }}>
      <section aria-label="Prioridad de hoy" style={{ ...card, padding: 'var(--crm-pad)' }}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}><Flame className="h-4 w-4" style={{ color: '#ea580c' }} /> Prioridad de hoy</h3>
        {a.ranking.length === 0 && <p style={muted}>No hay nada abierto en {entity.labelPlural.toLowerCase()}.</p>}
        <ol className="flex flex-col gap-1.5">
          {a.ranking.slice(0, 8).map((x) => (
            <li key={x.record.id}>
              <button onClick={() => onOpen(x.record)} className="flex w-full items-center gap-3 px-2 py-1.5 text-left" style={{ border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' }}>
                <span aria-label={`Puntuación ${x.score}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.9em] font-bold" style={{ ...chipStyle(tone(x.score), dark, true), fontFamily: 'var(--crm-number-font)' }}>{x.score}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{titleOfRecord(entity, x.record.data)}</span>
                    {stage && <Chip field={stage} value={x.record.data[stage.key]} dark={dark} solid={solid} />}
                  </span>
                  {x.reasons.length > 0 && <span className="block text-[0.85em]" style={muted}>{x.reasons.join(' · ')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Se están enfriando" style={{ ...card, padding: 'var(--crm-pad)' }}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}><Snowflake className="h-4 w-4" style={{ color: '#0284c7' }} /> Se están enfriando</h3>
        {a.cooling.length === 0 && <p style={muted}>Nada parado. Bien.</p>}
        <ul className="flex flex-col gap-1.5">
          {a.cooling.slice(0, 6).map((c) => (
            <li key={c.record.id}>
              <button onClick={() => onOpen(c.record)} className="w-full px-2 py-1.5 text-left" style={{ border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)' }}>
                <span className="block truncate font-medium">{titleOfRecord(entity, c.record.data)}</span>
                <span className="block text-[0.85em]" style={muted}>{c.reason}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const PATTERN_ICON: Record<Pattern['tone'], [typeof TrendingUp, string]> = {
  good: [TrendingUp, '#16a34a'],
  bad: [TrendingDown, '#dc2626'],
  info: [PieChart, '#2563eb'],
};

function Patterns({ a }: { a: Analysis }) {
  if (a.patterns.length === 0) {
    return (
      <div style={{ ...card, padding: 'var(--crm-pad)', ...muted }}>
        Con unos cuantos {a.section.entity.labelPlural.toLowerCase()} ganados y perdidos, aquí verás qué tipo de caso sale mejor y cuál peor. Ayuda rellenar el origen, el cliente y el motivo de pérdida.
      </div>
    );
  }
  return (
    <ul aria-label="Casuísticas" className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--crm-gap)' }}>
      {a.patterns.map((p) => {
        const [Icon, color] = PATTERN_ICON[p.tone];
        return (
          <li key={p.text} className="flex items-start gap-3" style={{ ...card, padding: 'var(--crm-pad)' }}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color }} />
            <span>{p.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function download(name: string, text: string) {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataBase({ blueprint, records, titleOf, dark }: { blueprint: Blueprint; records: AppRecord[]; titleOf: (id: string) => string | undefined; dark: boolean }) {
  return (
    <section aria-label="Base de datos" style={{ ...card, padding: 'var(--crm-pad)' }}>
      <h3 className="mb-1 flex items-center gap-2 font-semibold" style={{ fontFamily: 'var(--crm-heading-font)' }}><Database className="h-4 w-4" /> Tu base de datos</h3>
      <p className="mb-3 text-[0.85em]" style={muted}>Todo lo que apuntas queda guardado sección a sección. Descárgalo cuando quieras en CSV: se abre en Excel.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>{['Sección', 'Registros', 'Falta por rellenar', ''].map((h) => <th key={h} className="whitespace-nowrap font-medium" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', ...muted }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {blueprint.entities.map((e) => {
              const n = records.filter((r) => r.entity === e.key).length;
              const gaps = gapsOf(e, records, sectionOf(blueprint, e.key)?.stage);
              const twins = duplicatesOf(e, records);
              return (
                <tr key={e.key}>
                  <td className="whitespace-nowrap font-medium" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)' }}>{e.labelPlural}</td>
                  <td style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', fontFamily: 'var(--crm-number-font)' }}>{n}</td>
                  <td className="text-[0.88em]" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)', ...muted }}>
                    {twins > 0 && <span className="mr-1.5 rounded px-1.5 font-medium" style={chipStyle('amber', dark)}>{twins} posibles duplicados</span>}
                    {n === 0 ? '—' : gaps.length ? gaps.map((g) => `${g.missing} sin ${lowerFirst(g.field.label)}`).join(' · ') : 'Todo relleno'}
                  </td>
                  <td className="text-right" style={{ padding: 'var(--crm-row)', borderBottom: '1px solid var(--crm-border)' }}>
                    <button onClick={() => download(e.labelPlural, toCsv(e, records, titleOf))} disabled={n === 0} aria-label={`Descargar ${e.labelPlural} en CSV`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.85em] disabled:opacity-40" style={{ border: '1px solid var(--crm-border)' }}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
