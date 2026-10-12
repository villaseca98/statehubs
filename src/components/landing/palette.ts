import type { CSSProperties } from 'react';

// The estate palette of the public web: warm cream, white surfaces, deep
// forest green and a soft lime/sun accent. The logo («Capas de estado»)
// keeps its own colours. Same values as `estate` in tailwind.config.ts.

export const E = {
 cream:'#ffffff',sand:'#f7f7f7',white:'#ffffff',line:'#e6e6e6',
 ink:'#161616',muted:'#666666',forest:'#b41636',deep:'#810d25',
 moss:'#a51633',sage:'#e9a5b4',lime:'#ffffff',sun:'#f5f5f5'
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
