import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible in-app drawer: focus entry, Escape, Tab loop and focus restoration. */
export function RecordDialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (!dialog) return;
    const first = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]') ?? dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      // Stacked dialogs: only the one holding focus reacts.
      const focused = document.activeElement;
      if (focused && focused !== document.body && !dialog.contains(focused)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      const firstEl = elements[0], lastEl = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === firstEl || document.activeElement === dialog)) { event.preventDefault(); lastEl.focus(); }
      else if (!event.shiftKey && (document.activeElement === lastEl || !dialog.contains(document.activeElement))) { event.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus(); };
  }, []);
  return <div className="absolute inset-0 z-40 flex justify-end p-0 md:p-3" style={{ background: 'rgba(11,16,32,.4)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`h-full w-full ${wide ? 'max-w-[1080px]' : 'max-w-[500px]'} min-w-0 overflow-hidden shadow-2xl md:rounded-[20px]`} style={{ border: '1px solid var(--crm-border)' }}>
      {children}
    </div>
  </div>;
}
