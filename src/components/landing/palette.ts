import type { CSSProperties } from 'react';

// The estate palette of the public web: warm cream, white surfaces, deep
// forest green and a soft lime/sun accent. The logo («Capas de estado»)
// keeps its own colours. Same values as `estate` in tailwind.config.ts.

export const E = {
  cream: '#f4f2ec',
  sand: '#e9e5da',
  white: '#ffffff',
  line: '#e2ded2',
  ink: '#17231b',
  muted: '#5f6a61',
  forest: '#1e3a2b',
  deep: '#132a1e',
  moss: '#2f5a41',
  sage: '#8fae8b',
  lime: '#d4ec7a',
  sun: '#f2cf63',
} as const;

/** Colours of the app as the mockups draw it (light and dark). */
export const APP = { bg: E.cream, surface: E.white, border: E.line, text: E.ink, muted: E.muted, primary: E.forest } as const;
export const APP_DARK = { bg: '#0f1a14', surface: '#16261d', border: '#26392d', text: '#e9eee6', muted: '#a3b3a6', primary: E.lime } as const;
export type AppColors = { bg: string; surface: string; border: string; text: string; muted: string; primary: string };

/** Booking channels keep the colours of the real calendar. */
export const CHANNEL = { airbnb: '#ef4444', booking: '#3b82f6', directa: '#22c55e' } as const;

export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif';

/** Figures in tabular Space Grotesk. */
export const NUM: CSSProperties = { fontFamily: '"Space Grotesk", ui-sans-serif, sans-serif', fontVariantNumeric: 'tabular-nums' };
