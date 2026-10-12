import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Bookmark, Check, ListFilter, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { AppRecord, Field } from '@shared/blueprint/types.ts';
import { NO_VALUE, describeFilter, kindOf, newFilter, opsFor } from '@/lib/crm/filters';
import type { Filter, FilterOp } from '@/lib/crm/filters';
import { chipStyle } from './theme';
import { ALL_TAB } from './useViewFilters';
import type { ViewFilters } from './useViewFilters';

// The bar above a section: tabs (Todo, presets, saved views), a search box,
// a rule builder like Notion's, the active rules as chips, sort and "N de M".

const control = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)', borderRadius: 'calc(var(--crm-radius) * 0.7)' } as const;
const pop = { background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius)', boxShadow: '0 12px 32px rgba(0,0,0,.18)' } as const;

interface Props {
  filters: ViewFilters;
  records: AppRecord[];
  titleOf: (id: string) => string | undefined;
  dark?: boolean;
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

export function FilterBar({ filters, records, titleOf, dark = false }: Props) {
  const { entity, state, setState, filtered, total, presets, saved, activeTab, selectTab, saveAs, rename, remove } = filters;
  const builder = usePopover();
  const sorter = usePopover();
  const [naming, setNaming] = useState<string | null>(null); // 'new' or a saved id
  const [name, setName] = useState('');
  if (!entity) return null;

  const fieldOf = (k: string) => entity.fields.find((f) => f.key === k);
  const rules = state.filters.filter((f) => fieldOf(f.field));
  const setRules = (list: Filter[]) => setState({ ...state, filters: list });
  const dirty = activeTab === null;
  const startNaming = (id: string, current = '') => { setNaming(id); setName(current); };
  const finishNaming = () => {
    if (naming === 'new') saveAs(name);
    else if (naming) rename(naming, name);
    setNaming(null);
  };
  const nameInput = (
    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la vista" aria-label="Nombre de la vista" maxLength={40}
      onKeyDown={(e) => { if (e.key === 'Enter') finishNaming(); if (e.key === 'Escape') setNaming(null); }} onBlur={finishNaming}
      className="w-40 bg-transparent px-2 py-1 outline-none" style={{ ...control, borderColor: 'var(--crm-primary)' }} />
  );

  const tabs: { key: string; label: string; savedId?: string }[] = [
    { key: ALL_TAB, label: 'Todo' },
    ...presets.map((p) => ({ key: p.key, label: p.label })),
    ...saved.map((s) => ({ key: s.id, label: s.name, savedId: s.id })),
  ];

  return (
    <div className="flex flex-col gap-2" data-filterbar>
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Vistas">
        {tabs.map((t) => {
          const on = activeTab === t.key;
          if (naming === t.savedId && t.savedId) return <span key={t.key}>{nameInput}</span>;
          return (
            <span key={t.key} className="inline-flex shrink-0 items-center rounded-full" style={on ? { background: 'var(--crm-text)', color: 'var(--crm-bg)' } : { color: 'var(--crm-muted)' }}>
              <button role="tab" aria-selected={on} onClick={() => selectTab(t.key)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-medium">
                {t.savedId && <Bookmark className="h-3 w-3" />}{t.label}
              </button>
              {on && t.savedId && (
                <>
                  <button aria-label={`Renombrar ${t.label}`} title="Renombrar" onClick={() => startNaming(t.savedId!, t.label)} className="rounded-full p-1 opacity-70 hover:opacity-100"><Pencil className="h-3 w-3" /></button>
                  <button aria-label={`Borrar ${t.label}`} title="Borrar vista" onClick={() => { remove(t.savedId!); selectTab(ALL_TAB); }} className="mr-1 rounded-full p-1 opacity-70 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </span>
          );
        })}
        {naming === 'new' ? nameInput : dirty && (
          <button onClick={() => startNaming('new')} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1" style={{ color: 'var(--crm-primary)' }}>
            <Plus className="h-3.5 w-3.5" /> Guardar vista
          </button>
        )}
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-[1_1_220px] items-center gap-2 px-2.5 py-1.5" style={control}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--crm-muted)' }} />
          <input value={state.query} onChange={(e) => setState({ ...state, query: e.target.value })} placeholder={`Buscar en ${entity.labelPlural.toLowerCase()}`}
            aria-label={`Buscar en ${entity.labelPlural.toLowerCase()}`} className="w-full min-w-0 bg-transparent outline-none" style={{ color: 'var(--crm-text)' }} />
          {state.query && <button aria-label="Borrar búsqueda" onClick={() => setState({ ...state, query: '' })}><X className="h-3.5 w-3.5" style={{ color: 'var(--crm-muted)' }} /></button>}
        </label>

        <div className="flex items-center gap-2">
          <div ref={builder.ref} className="sm:relative">
            <ToolbarButton onClick={() => builder.setOpen(!builder.open)} active={builder.open || rules.length > 0} expanded={builder.open}>
              <ListFilter className="h-3.5 w-3.5" /> Filtro{rules.length > 0 && <span className="rounded-full px-1.5 text-[0.8em]" style={{ background: 'var(--crm-primary)', color: 'var(--crm-primary-text)' }}>{rules.length}</span>}
            </ToolbarButton>
            {builder.open && (
              <div role="dialog" aria-label="Filtros" className="absolute left-0 right-0 top-full z-20 mt-2 flex flex-col gap-2 p-3 sm:left-auto sm:right-0 sm:w-[min(560px,90vw)]" style={pop}>
                {rules.length === 0 && <p className="text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>Sin filtros. Añade una regla: campo, condición y valor.</p>}
                {rules.map((f, i) => (
                  <RuleRow key={i} index={i} rule={f} mode={state.mode} fields={entity.fields} records={records} titleOf={titleOf} dark={dark}
                    onMode={(mode) => setState({ ...state, mode })}
                    onChange={(next) => setRules(rules.map((x, j) => (j === i ? next : x)))}
                    onRemove={() => setRules(rules.filter((_, j) => j !== i))} />
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button onClick={() => setRules([...rules, newFilter(entity.fields[0])])} className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--crm-primary)' }}>
                    <Plus className="h-3.5 w-3.5" /> Añadir regla
                  </button>
                  {rules.length > 0 && <button onClick={() => setRules([])} className="text-[0.92em]" style={{ color: 'var(--crm-muted)' }}>Quitar todos</button>}
                </div>
              </div>
            )}
          </div>

          <div ref={sorter.ref} className="sm:relative">
            <ToolbarButton onClick={() => sorter.setOpen(!sorter.open)} active={sorter.open || !!state.sort} expanded={sorter.open}>
              {state.sort?.dir === 'desc' ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" />} Ordenar
            </ToolbarButton>
            {sorter.open && (
              <div role="dialog" aria-label="Ordenar" className="absolute left-0 right-0 top-full z-20 mt-2 flex flex-col gap-2 p-3 sm:left-auto sm:right-0 sm:w-72" style={pop}>
                <select aria-label="Ordenar por" value={state.sort?.field ?? ''} className="px-2 py-1.5" style={control}
                  onChange={(e) => setState({ ...state, sort: e.target.value ? { field: e.target.value, dir: state.sort?.dir ?? 'asc' } : null })}>
                  <option value="">Sin ordenar</option>
                  {entity.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                {state.sort && (
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Sentido">
                    {(['asc', 'desc'] as const).map((d) => (
                      <button key={d} role="radio" aria-checked={state.sort?.dir === d} onClick={() => setState({ ...state, sort: { field: state.sort!.field, dir: d } })}
                        className="rounded px-2 py-1.5" style={state.sort?.dir === d ? { background: 'var(--crm-primary)', color: 'var(--crm-primary-text)', borderRadius: 'calc(var(--crm-radius) * 0.7)' } : control}>
                        {sortLabel(fieldOf(state.sort!.field), d)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <span className="ml-auto whitespace-nowrap text-[0.92em]" style={{ color: 'var(--crm-muted)', fontFamily: 'var(--crm-number-font)' }} aria-live="polite">
          {filtered.length} de {total}
        </span>
      </div>

      {(rules.length > 0 || state.sort) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {rules.map((f, i) => (
            <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-[0.9em]" style={{ background: 'color-mix(in srgb, var(--crm-primary) 12%, var(--crm-surface))', border: '1px solid color-mix(in srgb, var(--crm-primary) 30%, transparent)' }}>
              {i > 0 && <span className="mr-0.5 font-semibold" style={{ color: 'var(--crm-primary)' }}>{state.mode === 'or' ? 'O' : 'Y'}</span>}
              <button className="truncate" onClick={() => builder.setOpen(true)}>{describeFilter(fieldOf(f.field)!, f, titleOf)}</button>
              <button aria-label="Quitar filtro" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {state.sort && fieldOf(state.sort.field) && (
            <span className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-[0.9em]" style={control}>
              {fieldOf(state.sort.field)!.label}: {sortLabel(fieldOf(state.sort.field), state.sort.dir)}
              <button aria-label="Quitar orden" onClick={() => setState({ ...state, sort: null })} className="rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function sortLabel(f: Field | undefined, dir: 'asc' | 'desc') {
  const k = f ? kindOf(f) : 'text';
  if (k === 'number') return dir === 'asc' ? 'menor a mayor' : 'mayor a menor';
  if (k === 'date') return dir === 'asc' ? 'más antiguo antes' : 'más reciente antes';
  if (k === 'select') return dir === 'asc' ? 'en orden' : 'al revés';
  return dir === 'asc' ? 'A → Z' : 'Z → A';
}

function ToolbarButton({ children, onClick, active, expanded }: { children: ReactNode; onClick: () => void; active?: boolean; expanded?: boolean }) {
  return (
    <button onClick={onClick} aria-expanded={expanded} className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 font-medium"
      style={{ ...control, ...(active ? { borderColor: 'color-mix(in srgb, var(--crm-primary) 55%, var(--crm-border))', color: 'var(--crm-primary)' } : {}) }}>
      {children}
    </button>
  );
}

function RuleRow({ index, rule, mode, fields, records, titleOf, dark, onMode, onChange, onRemove }: {
  index: number; rule: Filter; mode: 'and' | 'or'; fields: Field[]; records: AppRecord[]; titleOf: (id: string) => string | undefined; dark: boolean;
  onMode: (m: 'and' | 'or') => void; onChange: (f: Filter) => void; onRemove: () => void;
}) {
  const field = fields.find((f) => f.key === rule.field)!;
  const kind = kindOf(field);
  const pair = Array.isArray(rule.value) ? rule.value : ['', ''];
  const inputType = kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text';
  const valueInput = (value: unknown, set: (v: unknown) => void, label: string) => (
    <input type={inputType} step={kind === 'number' ? 'any' : undefined} aria-label={label} value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => set(e.target.value)} className="min-w-0 flex-1 px-2 py-1.5" style={control} placeholder={kind === 'text' ? 'Valor' : undefined} />
  );

  let value: ReactNode = null;
  if (!NO_VALUE.includes(rule.op)) {
    if (kind === 'select') {
      const list = Array.isArray(rule.value) ? rule.value.map(String) : [];
      value = (
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Valores de ${field.label}`}>
          {(field.options ?? []).map((o) => {
            const on = list.includes(o.value);
            return (
              <button key={o.value} aria-pressed={on} onClick={() => onChange({ ...rule, value: on ? list.filter((v) => v !== o.value) : [...list, o.value] })}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.9em]" style={on ? chipStyle(o.color, dark) : { border: '1px solid var(--crm-border)', color: 'var(--crm-muted)' }}>
                {on && <Check className="h-3 w-3" />}{o.label}
              </button>
            );
          })}
        </div>
      );
    } else if (kind === 'relation') {
      value = (
        <select aria-label="Valor" value={String(rule.value ?? '')} onChange={(e) => onChange({ ...rule, value: e.target.value || undefined })} className="min-w-0 flex-1 px-2 py-1.5" style={control}>
          <option value="">Elige…</option>
          {records.filter((r) => r.entity === field.relation).map((r) => <option key={r.id} value={r.id}>{titleOf(r.id)}</option>)}
        </select>
      );
    } else if (rule.op === 'between') {
      value = (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {valueInput(pair[0], (v) => onChange({ ...rule, value: [v, pair[1]] }), 'Desde')}
          <span style={{ color: 'var(--crm-muted)' }}>y</span>
          {valueInput(pair[1], (v) => onChange({ ...rule, value: [pair[0], v] }), 'Hasta')}
        </span>
      );
    } else if (rule.op === 'last_days') {
      value = (
        <input type="number" min={1} aria-label="Días" value={rule.value === undefined ? '' : String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value })}
          className="w-20 px-2 py-1.5" style={control} placeholder="30" />
      );
    } else {
      value = valueInput(rule.value, (v) => onChange({ ...rule, value: v }), 'Valor');
    }
  }

  return (
    <div className="flex flex-col gap-1.5 pb-2" style={{ borderBottom: '1px dashed var(--crm-border)' }} aria-label={`Regla ${index + 1}`} role="group">
      <div className="flex items-center gap-1.5">
        <span className="w-12 shrink-0 text-[0.9em]" style={{ color: 'var(--crm-muted)' }}>
          {index === 0 ? 'Donde' : index === 1 ? (
            <select aria-label="Cómo se combinan" value={mode} onChange={(e) => onMode(e.target.value as 'and' | 'or')} className="w-full bg-transparent font-semibold" style={{ color: 'var(--crm-primary)' }}>
              <option value="and">Y</option><option value="or">O</option>
            </select>
          ) : <span className="font-semibold" style={{ color: 'var(--crm-primary)' }}>{mode === 'or' ? 'O' : 'Y'}</span>}
        </span>
        <select aria-label="Campo" value={field.key} onChange={(e) => onChange(newFilter(fields.find((f) => f.key === e.target.value)!))} className="min-w-0 flex-1 px-2 py-1.5" style={control}>
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select aria-label="Condición" value={rule.op} className="min-w-0 flex-1 px-2 py-1.5" style={control}
          onChange={(e) => {
            const op = e.target.value as FilterOp;
            const keep = (op === 'between') === (rule.op === 'between') && op !== 'last_days' && rule.op !== 'last_days';
            onChange({ ...rule, op, value: keep ? rule.value : op === 'between' ? ['', ''] : undefined });
          }}>
          {opsFor(field).map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
        </select>
        <button aria-label="Quitar regla" onClick={onRemove} className="shrink-0 rounded p-1" style={{ color: 'var(--crm-muted)' }}><X className="h-4 w-4" /></button>
      </div>
      {value && <div className="flex min-w-0 items-center gap-1.5 pl-[3.375rem] pr-8">{value}</div>}
    </div>
  );
}
