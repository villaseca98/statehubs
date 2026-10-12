import { useRef, useState } from 'react';
import { ImageUp, RotateCcw } from 'lucide-react';
import { AppLogo } from './Logo';
import { imageToLogo } from '@/lib/brand/logo';

// Every app starts with the StateHubs mark. Here the owner swaps it for their
// own: the image is shrunk to a small PNG in the browser and saved in the
// blueprint, so it arrives as a proposal like any other change.

export function LogoSetup({ name, logo, disabled, onChange }: { name: string; logo?: string; disabled?: boolean; onChange: (logo: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    try { onChange(await imageToLogo(file)); } catch (e) { setError((e as Error).message); }
  };
  return (
    <section aria-label="Tu logo" className="rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <AppLogo src={logo} name={name} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Tu logo</h3>
          <p className="text-xs text-muted-foreground">{logo ? 'Es el que sale en el menú de tu app.' : 'Ahora lleva el de StateHubs. Pon el tuyo cuando quieras.'}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:opacity-50">
          <ImageUp className="h-4 w-4" /> {logo ? 'Cambiar logo' : 'Subir mi logo'}
        </button>
        {logo && (
          <button type="button" disabled={disabled} onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground disabled:opacity-50">
            <RotateCcw className="h-4 w-4" /> Volver al de StateHubs
          </button>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Archivo del logo" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
