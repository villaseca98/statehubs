import { useId, useMemo } from 'react';
import { motion, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { LOOK } from '@shared/blueprint/look.ts';
import { makeTitleLookup, themeVars } from './theme';
import { OnePage } from './OnePage';
import { showcaseLayers } from './showcase';
import type { ShowcaseMotion } from './showcase';

// Shows any app (any blueprint, any of the styles) as a 3D object made of its
// own pieces: the bar, the key figures and every panel are separate layers
// that can come apart, swap or arrive one by one. Each layer is the real
// one-page app with everything but its piece hidden, so what you see is
// exactly what the customer gets, with their data and their colours.
//
// Everything is driven by one MotionValue (scroll progress, seconds of a reel,
// a looping clock), so it never re-renders per frame.

interface Props extends ShowcaseMotion {
  blueprint: Blueprint;
  records: AppRecord[];
  p: MotionValue<number>;
  width: number;
  height: number;
  maxLayers?: number;
  gap?: number;
  /** Panels are cut to this height so more of them fit in the window. */
  panelMax?: number;
}

const noop = () => undefined;

export function AppShowcase({ blueprint, records, p, width, height, maxLayers = 6, gap = 90, panelMax = 250, explode, tilt, spin, reveal, focus, zoom }: Props) {
  const style = LOOK;
  const titleOf = useMemo(() => makeTitleLookup(blueprint.entities, records), [blueprint.entities, records]);
  const layers = useMemo(() => showcaseLayers(blueprint, maxLayers), [blueprint, maxLayers]);
  const uid = `sx${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const object = useTransform(p, (v) => {
    const t = tilt(v);
    const z = zoom ? zoom(v) : 1;
    return `rotateX(${54 * t}deg) rotateZ(${(-32 + (spin ? spin(v) : 0)) * t}deg) scale(${z * (0.84 + 0.16 * (1 - t))})`;
  });

  // While apart, the empty base turns to glass so the pieces carry the picture.
  const baseBg = useTransform(p, (v) => `color-mix(in srgb, ${style.colors.bg} ${Math.round(100 - 93 * explode(v))}%, transparent)`);

  // Each layer copy hides everything except its own piece.
  const css = layers.map((l, i) => {
    const sel = `.${uid}-${i}`;
    const show = l.key === 'base' ? `${sel} header`
      : l.key === 'cifras' ? `${sel} main section[aria-label="Cifras"], ${sel} main > div > section:not([id])`
      : `${sel} #panel-${CSS.escape(l.key)}`;
    return `${sel} header, ${sel} main section { visibility: hidden; } ${show} { visibility: visible; }`;
  }).join('\n') + `
    .${uid} main { overflow: hidden !important; }
    .${uid} main section { max-height: ${panelMax}px; overflow: hidden; }
    .${uid} main section[aria-label="Cifras"] { max-height: none; }
    @media (min-width: 1024px) { .${uid} main > div > section[id] { grid-column: span 6 / span 6 !important; } }`;

  return (
    <div style={{ width, height, transformStyle: 'preserve-3d' }} aria-hidden>
      <style>{css}</style>
      <motion.div className="relative h-full w-full" style={{ transform: object, transformStyle: 'preserve-3d' }}>
        {layers.map((l, i) => (
          <Layer key={l.key} p={p} index={i} count={layers.length} layerKey={l.key} gap={gap} explode={explode} reveal={reveal} focus={focus} primary={style.colors.primary}>
            <motion.div className={`${uid} ${uid}-${i} pointer-events-none flex h-full w-full overflow-hidden`} {...({ inert: "" } as object)}
              style={{ ...themeVars(), borderRadius: Math.max(10, style.radius), background: i === 0 ? baseBg : 'transparent', boxShadow: i === 0 ? '0 40px 90px rgba(0,0,0,.5)' : undefined }}>
              <OnePage blueprint={blueprint} records={records} titleOf={titleOf} openId={null} onOpen={noop} onCreate={noop} onUpdate={noop} />
            </motion.div>
          </Layer>
        ))}
      </motion.div>
    </div>
  );
}

function Layer({ p, index, count, layerKey, gap, explode, reveal, focus, primary, children }: {
  p: MotionValue<number>; index: number; count: number; layerKey: string; gap: number; primary: string;
  explode: ShowcaseMotion['explode']; reveal?: ShowcaseMotion['reveal']; focus?: ShowcaseMotion['focus']; children: React.ReactNode;
}) {
  const transform = useTransform(p, (v) => {
    const r = reveal ? reveal(v, index, count) : 1;
    const f = focus?.(v);
    const pull = f && f[0] === layerKey ? f[1] : 0;
    // Arriving pieces drop in from above; a focused piece lifts towards the viewer.
    const z = index * gap * explode(v) + (1 - r) * 420 + pull * 200;
    return `translate3d(0, ${-pull * 40}px, ${z}px) scale(${1 + pull * 0.06})`;
  });
  const opacity = useTransform(p, (v) => {
    const r = reveal ? reveal(v, index, count) : 1;
    const f = focus?.(v);
    const dim = f && f[1] > 0 && f[0] !== layerKey && index > 0 ? 1 - 0.7 * f[1] : 1;
    return Math.min(1, r * 1.4) * dim;
  });
  const sheet = useTransform(p, (v) => (index === 0 ? 0 : explode(v) * (reveal ? reveal(v, index, count) : 1)));
  return (
    <motion.div className="absolute inset-0" style={{ transform, opacity, transformStyle: 'preserve-3d' }}>
      <motion.div className="absolute inset-0 rounded-[14px]" style={{ opacity: sheet, background: `color-mix(in srgb, ${primary} 6%, transparent)`, border: `1.5px solid color-mix(in srgb, ${primary} 55%, transparent)`, boxShadow: `0 0 50px color-mix(in srgb, ${primary} 18%, transparent)` }} />
      {children}
    </motion.div>
  );
}
