import { BrainCircuit, Check } from 'lucide-react';
import { ANALYSIS_LENSES } from '@shared/blueprint/types.ts';
import type { AnalysisConfig, AnalysisLens, Blueprint } from '@shared/blueprint/types.ts';
import { analysedSections, LENS_INFO, STALE_CHOICES } from '@shared/blueprint/analysis.ts';

// Set up the analysis while picking the pieces: what to look at, which
// sections, and after how many days an open record counts as going cold.

interface Props {
  blueprint: Blueprint;
  value: AnalysisConfig;
  onChange: (next: AnalysisConfig) => void;
}

export function AnalysisSetup({ blueprint, value, onChange }: Props) {
  const candidates = analysedSections(blueprint, { ...value, entities: undefined });
  const picked = value.entities?.length ? value.entities : candidates.map((s) => s.entity.key);
  const toggleLens = (l: AnalysisLens) => {
    const on = value.lenses.includes(l);
    if (on && value.lenses.length === 1) return;  // at least one way of looking
    onChange({ ...value, lenses: ANALYSIS_LENSES.filter((x) => (x === l ? !on : value.lenses.includes(x))) });
  };
  const toggleSection = (key: string) => {
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
    if (next.length === 0) return;
    // All of them = "whatever has stages or amounts", so new pieces join the analysis on their own.
    onChange({ ...value, entities: next.length === candidates.length ? undefined : next });
  };

  return (
    <section aria-label="Configurar el análisis" className="rounded-xl border border-primary/40 bg-primary/5 p-3">
      <h3 className="flex items-center gap-2 font-semibold"><BrainCircuit className="h-4 w-4 text-primary" /> Qué quieres que analice</h3>
      <ul className="mt-2 grid gap-1.5">
        {ANALYSIS_LENSES.map((l) => {
          const on = value.lenses.includes(l);
          return (
            <li key={l}>
              <button type="button" aria-pressed={on} onClick={() => toggleLens(l)}
                className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-sm transition ${on ? 'border-primary bg-background' : 'border-dashed bg-transparent text-muted-foreground'}`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${on ? 'bg-primary text-primary-foreground' : 'border'}`}>{on && <Check className="h-3 w-3" />}</span>
                <span>
                  <span className="block font-medium text-foreground">{LENS_INFO[l].name}</span>
                  <span className="block text-xs text-muted-foreground">{LENS_INFO[l].pitch}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {candidates.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Secciones</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {candidates.map((s) => {
              const on = picked.includes(s.entity.key);
              return (
                <button key={s.entity.key} type="button" aria-pressed={on} onClick={() => toggleSection(s.entity.key)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
                  {s.entity.labelPlural}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <label className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Dar por frío lo que lleve sin moverse</span>
        <select value={value.staleDays} onChange={(e) => onChange({ ...value, staleDays: Number(e.target.value) })} className="rounded-md border bg-background px-2 py-1">
          {STALE_CHOICES.map((d) => <option key={d} value={d}>{d} días</option>)}
        </select>
      </label>
    </section>
  );
}
