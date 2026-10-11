import type { Blueprint } from '@shared/blueprint/types.ts';

// Shared by the 3D showcase, the presentation and the reels.

export interface ShowcaseLayer { key: string; label: string }

/** Pieces of a blueprint in the order they stack: bar, figures, then panels. */
export function showcaseLayers(bp: Blueprint, max = 6): ShowcaseLayer[] {
  const panels = bp.views.filter((v) => v.type !== 'dashboard').slice(0, Math.max(0, max - 2));
  const hasFigures = bp.views.some((v) => v.type === 'dashboard' && v.widgets?.some((w) => w.kind === 'metric'));
  return [
    { key: 'base', label: 'Tu página' },
    ...(hasFigures ? [{ key: 'cifras', label: 'Cifras clave' }] : []),
    ...panels.map((v) => ({ key: v.key, label: v.label })),
  ];
}

export interface ShowcaseMotion {
  /** 0 = assembled, 1 = fully apart. */
  explode: (v: number) => number;
  /** 0 = front-on and flat, 1 = isometric. */
  tilt: (v: number) => number;
  /** Extra turn around the vertical axis, in degrees (only while tilted). */
  spin?: (v: number) => number;
  /** 0 = layer absent, 1 = in place. Lets pieces arrive one by one. */
  reveal?: (v: number, index: number, count: number) => number;
  /** Pull one piece out towards the viewer: [layer key, 0..1]. */
  focus?: (v: number) => [string, number] | null;
  /** Overall size multiplier. */
  zoom?: (v: number) => number;
}

// ---- timing helpers shared by the scroll hero, the presentation and the reels ----
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
export const ease = (x: number) => x * x * (3 - 2 * x);
/** Rises over [a, b], falls over [c, d]. */
export const win = (v: number, a: number, b: number, c = Infinity, d = Infinity) => ease(seg(v, a, b)) * (1 - ease(seg(v, c, d)));
