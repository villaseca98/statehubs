import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/* eslint-disable react-refresh/only-export-components */
// A tiny toaster: one line of title, one of detail, gone after a few seconds.
interface Toast { id: number; title: string; description?: string; error?: boolean }
const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto flex gap-3 rounded-xl border bg-card p-3 shadow-lg ${t.error ? 'border-destructive/40' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold ${t.error ? 'text-destructive' : ''}`}>{t.title}</div>
              {t.description && <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>}
            </div>
            <button aria-label="Cerrar aviso" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
