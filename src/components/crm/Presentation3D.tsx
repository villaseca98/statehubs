import { useEffect, useMemo, useState } from 'react';
import { useAnimationFrame, useMotionValue } from 'framer-motion';
import { Box, X } from 'lucide-react';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { LOOK } from '@shared/blueprint/look.ts';
import { AppShowcase } from './AppShowcase';
import { ease, seg, showcaseLayers, win } from './showcase';

// "Verlo en 3D": the customer's own app, with their data, coming apart into
// its pieces and back on a loop. Good to show it off or to screen-record it
// for a reel.

const PERIOD = 14; // seconds per loop

function useStageSize() {
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return size;
}

export function Presentation3D({ blueprint, records, onClose }: { blueprint: Blueprint; records: AppRecord[]; onClose: () => void }) {
  const clock = useMotionValue(0);
  useAnimationFrame((ms) => clock.set(((ms / 1000) % PERIOD) / PERIOD));
  const { w, h } = useStageSize();
  const wide = w >= 1024; // the app lays itself out by screen width
  const app = wide ? { width: 1180, height: 780 } : { width: 400, height: 760 };
  const scale = 0.88 * Math.min(1, (w - 32) / (app.width * (wide ? 1.15 : 1.75)), (h - 170) / (app.height * (wide ? 1.05 : 0.95)));
  const layers = useMemo(() => showcaseLayers(blueprint), [blueprint]);
  const panels = layers.slice(2).map((l) => l.key);
  const primary = LOOK.colors.primary;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label="Tu aplicación en 3D" className="fixed inset-0 z-50 flex flex-col overflow-hidden text-white" style={{ background: '#100f0d' }}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${primary} 35%, transparent) 0%, transparent 65%)` }} />
      <header className="relative z-10 flex flex-wrap items-center gap-3 px-4 py-3">
        <Box className="h-4 w-4" style={{ color: primary }} />
        <span className="font-semibold">{blueprint.name}</span>
        <span className="hidden text-sm text-white/60 sm:inline">en 3D · con tus datos</span>
        <button onClick={onClose} aria-label="Cerrar" className="ml-auto rounded-full border border-white/20 p-1.5 hover:border-white/60"><X className="h-4 w-4" /></button>
      </header>
      <div className="relative flex flex-1 items-center justify-center" style={{ perspective: 2200 }}>
        <div style={{ width: app.width * scale, height: app.height * scale, transformStyle: 'preserve-3d' }}>
          <div style={{ width: app.width, height: app.height, transform: `scale(${scale})`, transformOrigin: '0 0', transformStyle: 'preserve-3d' }}>
            <AppShowcase blueprint={blueprint} records={records} p={clock} width={app.width} height={app.height} gap={wide ? 105 : 80} maxLayers={wide ? 6 : 5} panelMax={wide ? 250 : 210}
              tilt={(v) => win(v, 0.06, 0.18, 0.78, 0.9)}
              explode={(v) => win(v, 0.14, 0.3, 0.68, 0.82)}
              spin={(v) => 16 * ease(seg(v, 0.06, 0.8))}
              focus={(v) => {
                if (!panels.length || v < 0.32 || v > 0.66) return null;
                const span = 0.34 / panels.length;
                const i = Math.min(panels.length - 1, Math.floor((v - 0.32) / span));
                const local = (v - 0.32 - i * span) / span;
                return [panels[i], win(local, 0, 0.3, 0.7, 1)];
              }} />
          </div>
        </div>
      </div>
      <p className="relative z-10 pb-4 text-center text-xs text-white/50">Graba la pantalla y tienes un vídeo de tu propio CRM. Esc para salir.</p>
    </div>
  );
}
