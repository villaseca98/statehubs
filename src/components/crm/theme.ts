import type { CSSProperties } from 'react';
import { LOOK, LOOK_DARK } from '@shared/blueprint/look.ts';
import type { Field, OptionColor, RecordData, AppRecord, Entity } from '@shared/blueprint/types.ts';

const FONTS = {
  sans: '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const DENSITY = {
  compact: { row: '4px 8px', font: '12.5px', gap: '8px', pad: '12px' },
  comfortable: { row: '8px 12px', font: '13.5px', gap: '12px', pad: '20px' },
  spacious: { row: '12px 14px', font: '14.5px', gap: '16px', pad: '24px' },
};

// Every runtime component reads colours and spacing from these variables,
// so the look lives in one place (_shared/blueprint/look.ts). `dark` swaps
// the colours for LOOK_DARK; everything else stays the same.
export type ThemeMode = 'light' | 'dark';

export function themeVars(mode: ThemeMode = 'light'): CSSProperties {
  const s = mode === 'dark' ? { ...LOOK, colors: LOOK_DARK } : LOOK;
  const warm = mode === 'light';
  const d = DENSITY[s.density];
  return {
    '--crm-bg': warm ? '#fdf9f6' : s.colors.bg,
    '--crm-surface': warm ? '#fffdfa' : s.colors.surface,
    '--crm-border': warm ? '#efdfd8' : s.colors.border,
    '--crm-text': s.colors.text,
    '--crm-muted': s.colors.muted,
    '--crm-primary': warm ? '#bf3025' : s.colors.primary,
    '--crm-primary-text': s.colors.primaryText,
    '--crm-nav-bg': warm ? '#fff7f2' : s.colors.navBg,
    '--crm-nav-text': s.colors.navText,
    '--crm-nav-active': s.colors.navActive,
    '--crm-soft': warm ? '#fce5de' : s.colors.soft,
    '--crm-accent': warm ? '#ffe4da' : s.colors.accent,
    '--crm-radius': `${s.radius}px`,
    '--crm-row': d.row,
    '--crm-font-size': d.font,
    '--crm-gap': d.gap,
    '--crm-pad': d.pad,
    '--crm-heading-font': FONTS.sans,
    '--crm-number-font': 'inherit',
    fontFamily: FONTS.sans,
    fontSize: d.font,
    color: s.colors.text,
    background: warm ? '#fdf9f6' : s.colors.bg,
    colorScheme: mode,
  } as CSSProperties;
}

const MODE_KEY = 'statehubs.tema';

// White/red is the default regardless of the device. Only an explicit choice overrides it.
export function initialMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage blocked */ }
  return 'light';
}

export function storeMode(mode: ThemeMode): void {
  try { window.localStorage.setItem(MODE_KEY, mode); } catch { /* storage blocked: lasts this visit */ }
}

const CHIP: Record<OptionColor, [string, string, string]> = {
  // light bg, light text, dark-mode text
  gray: ['#eef0f2', '#4b5563', '#c4c9d1'],
  blue: ['#e3efff', '#1d4ed8', '#8db8ff'],
  green: ['#dcf5e6', '#15803d', '#7ee2a8'],
  amber: ['#fdf0d5', '#a15c07', '#f8c45c'],
  red: ['#fde2e2', '#b91c1c', '#ff9b9b'],
  purple: ['#ede7fe', '#6d28d9', '#c2a8ff'],
  teal: ['#d5f5f2', '#0f766e', '#6fe0d4'],
  pink: ['#fde4f1', '#be185d', '#ff9fcf'],
};
export const SOLID: Record<OptionColor, string> = {
  gray: '#9ca3af', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#8b5cf6', teal: '#14b8a6', pink: '#ec4899',
};

export function chipStyle(color: OptionColor | undefined, dark: boolean, solid = false): CSSProperties {
  const c = color ?? 'gray';
  if (solid) return { background: SOLID[c], color: '#fff' };
  const [bg, fg, darkFg] = CHIP[c];
  return dark ? { background: `${SOLID[c]}26`, color: darkFg } : { background: bg, color: fg };
}

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export function formatMoney(v: number) {
  return money.format(v);
}

export function formatValue(field: Field, value: unknown, titleOf?: (id: string) => string | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  switch (field.type) {
    case 'money': return typeof value === 'number' ? money.format(value) : String(value);
    case 'number': return typeof value === 'number' ? num.format(value) : String(value);
    case 'percent': return typeof value === 'number' ? `${num.format(value)} %` : String(value);
    case 'boolean': return value ? 'Sí' : 'No';
    case 'date': {
      const d = new Date(`${value}T00:00:00`);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    case 'datetime': {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    case 'select': return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case 'relation': return titleOf?.(String(value)) ?? '';
    default: return String(value);
  }
}

export const isNumeric = (f?: Field) => !!f && (f.type === 'number' || f.type === 'money' || f.type === 'percent');

export function titleOfRecord(entity: Entity | undefined, data: RecordData): string {
  if (!entity) return '';
  const v = data[entity.titleField];
  return v === undefined || v === null || v === '' ? `${entity.label} sin nombre` : String(v);
}

export function makeTitleLookup(entities: Entity[], records: AppRecord[]) {
  const map = new Map<string, string>();
  for (const r of records) map.set(r.id, titleOfRecord(entities.find((e) => e.key === r.entity), r.data));
  return (id: string) => map.get(id);
}

// The select that drives the stage bar: the one a board groups by, else the first select.
export function stageField(entity: Entity, groupBy?: string): Field | undefined {
  return entity.fields.find((f) => f.key === groupBy && f.type === 'select') ?? entity.fields.find((f) => f.type === 'select');
}
