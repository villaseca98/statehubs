import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { photoOf } from '@/lib/crm/estate';

// A property photo. Only web addresses and the app's own files ('/demo/…')
// are shown; anything else, or a photo that fails to load, becomes a green
// tile with the reference so the layout never breaks.

export function Photo({ src, label, className = '', small = false }: { src: unknown; label?: string; className?: string; small?: boolean }) {
  // 0: the small copy when asked for, 1: the full photo, 2: none loads.
  const [step, setStep] = useState(small ? 0 : 1);
  const url = photoOf(src);
  const shown = step === 0 ? url.replace(/\.jpg$/, '-sm.jpg') : url;
  if (url && step < 2) {
    return <img src={shown} alt="" loading="lazy" onError={() => setStep((s) => s + 1)} className={`object-cover ${className}`} />;
  }
  return (
    <span className={`grid place-items-center text-[0.8em] font-semibold text-white ${className}`} style={{ background: 'linear-gradient(135deg, var(--crm-primary), #0f2e22)' }}>
      {label || <Building2 className="h-5 w-5" />}
    </span>
  );
}
