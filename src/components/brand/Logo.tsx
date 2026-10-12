import { useId } from 'react';
import { BRAND } from '@shared/blueprint/look.ts';

// The StateHubs mark, "Capas de estado": three layers, the top one with a dot.
// It is also the default logo of every app until its owner uploads their own.

interface MarkProps { size?: number; className?: string; tile?: 'light' | 'dark' | 'none'; title?: string }

export function LogoMark({ size = 32, className, tile = 'none', title }: MarkProps) {
  const id = useId().replace(/:/g, '');
  const cut = tile === 'dark' ? BRAND.ink : tile === 'light' ? '#ffffff' : 'none';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`sh-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND.from} />
          <stop offset="1" stopColor={BRAND.to} />
        </linearGradient>
      </defs>
      {tile !== 'none' && <rect width="100" height="100" rx="24" fill={cut} />}
      <g transform={tile === 'none' ? 'translate(0 -2) scale(1)' : 'translate(10 10) scale(.8)'}>
        {[['M50 54L80 68L50 82L20 68Z', 0.35], ['M50 38L80 52L50 66L20 52Z', 0.65], ['M50 22L80 36L50 50L20 36Z', 1]].map(([d, o]) => (
          <path key={d as string} d={d as string} fill={`url(#sh-${id})`} opacity={o as number} stroke={tile === 'none' ? 'none' : cut} strokeWidth="4" strokeLinejoin="round" />
        ))}
        <circle cx="50" cy="36" r="4.5" fill={tile === 'none' ? '#ffffff' : cut} />
      </g>
    </svg>
  );
}

// "statehubs" with "hubs" in the brand gradient. `dark` for dark backgrounds.
export function Wordmark({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`} style={{ color: dark ? '#ffffff' : BRAND.ink }}>
      state<span style={{ background: `linear-gradient(90deg, ${BRAND.from}, ${BRAND.to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>hubs</span>
    </span>
  );
}

export function Logo({ dark = false, size = 28, className = '' }: { dark?: boolean; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="StateHubs">
      <LogoMark size={size} />
      <Wordmark dark={dark} className="text-[1.15em]" />
    </span>
  );
}

// An app's own logo: the one its owner uploaded, or the StateHubs mark.
export function AppLogo({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  if (src) return <img src={src} alt={`Logo de ${name}`} width={size} height={size} className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size, background: '#fff' }} />;
  return <LogoMark size={size} tile="dark" title={`Logo de ${name}`} />;
}
