import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

// Shared pieces of the public web: the soft estate mesh with grain and light,
// a reveal-on-scroll wrapper and the section heading. Motion is reduced by
// the MotionConfig in Landing and by the CSS media query in index.css.

/** Slow mesh of lime, sage and sun over cream (or over forest with `dark`), with grain and a top light. */
export function Mesh({ className = '', intensity = 1, dark = false }: { className?: string; intensity?: number; dark?: boolean }) {
  const line = dark ? 'rgba(244,242,236,.05)' : 'rgba(30,58,43,.055)';
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${dark ? 'sh-dark' : ''} ${className}`}>
      <div className="sh-mesh" style={{ opacity: intensity }}>
        <span className="sh-blob sh-blob-a" />
        <span className="sh-blob sh-blob-b" />
        <span className="sh-blob sh-blob-c" />
        <span className="sh-blob sh-blob-d" />
      </div>
      <div className="absolute inset-x-0 top-0 h-[70%]" style={{ background: `radial-gradient(60% 55% at 50% 0%, ${dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.7)'} 0%, rgba(255,255,255,0) 70%)` }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 75%)',
      }} />
      <div className="sh-grain" />
    </div>
  );
}

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = '', y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  // Without IntersectionObserver (old browsers, tests) it is simply there.
  if (typeof IntersectionObserver === 'undefined') return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function SectionHead({ eyebrow, title, text, id, center = true, dark = false }: { eyebrow: string; title: ReactNode; text?: ReactNode; id?: string; center?: boolean; dark?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-estate-lime' : 'text-estate-moss'}`}>{eyebrow}</p>
      <h2 id={id} className={`mt-4 text-balance font-serif text-[2.3rem] font-normal leading-[1.04] tracking-[-0.02em] sm:text-[3.6rem] ${dark ? 'sh-dark text-estate-cream' : 'text-estate-ink'}`}>{title}</h2>
      {text && <p className={`mt-5 text-pretty text-base sm:text-lg ${dark ? 'text-estate-cream/75' : 'text-estate-muted'}`}>{text}</p>}
    </Reveal>
  );
}
