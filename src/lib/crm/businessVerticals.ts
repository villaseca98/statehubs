export type BusinessVertical = 'real-estate' | 'holiday-rentals';
export const BUSINESS_VERTICALS: readonly BusinessVertical[] = ['real-estate', 'holiday-rentals'];

export function parseBusinessVerticals(value: string | null, legacy: string | null = null): BusinessVertical[] {
  if (value !== null) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return BUSINESS_VERTICALS.filter((mode) => parsed.includes(mode));
    } catch { /* Malformed browser preference: restore defaults. */ }
  }
  if (legacy && BUSINESS_VERTICALS.some((mode) => mode === legacy)) return [legacy as BusinessVertical];
  // A combined agency should not have to choose one line of business over another.
  return [...BUSINESS_VERTICALS];
}

export function toggleBusinessVertical(selected: readonly BusinessVertical[], mode: BusinessVertical): BusinessVertical[] {
  return BUSINESS_VERTICALS.filter((item) => item === mode ? !selected.includes(item) : selected.includes(item));
}
