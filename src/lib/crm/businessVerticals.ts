/** Presentation preferences only. These never enable permissions or remove modules. */
export const BUSINESS_VERTICALS = ['real-estate', 'holiday-rentals'] as const;
export type BusinessVertical = typeof BUSINESS_VERTICALS[number];

export function readBusinessVerticals(storage: Pick<Storage, 'getItem'>, workspaceId: string): BusinessVertical[] {
  try {
    const value = storage.getItem(`statehubs:business-verticals:${workspaceId}`);
    if (value !== null) {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? BUSINESS_VERTICALS.filter((vertical) => parsed.includes(vertical))
        : [];
    }
    // Preserve an earlier single-mode selection when upgrading to multi-select.
    const legacy = storage.getItem(`statehubs:business-mode:${workspaceId}`);
    return BUSINESS_VERTICALS.filter((vertical) => vertical === legacy);
  } catch {
    return [];
  }
}

export function toggleBusinessVertical(current: readonly BusinessVertical[], vertical: BusinessVertical): BusinessVertical[] {
  return BUSINESS_VERTICALS.filter((candidate) =>
    candidate === vertical ? !current.includes(candidate) : current.includes(candidate),
  );
}
