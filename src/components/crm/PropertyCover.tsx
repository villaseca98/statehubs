import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { signedPropertyUrl, parseAssets } from '@/lib/crm/propertyMedia';
/** Private media cover; signed URLs expire and are never persisted in CRM JSON. */
export function PropertyCover({ value, fallback, alt }: { value: unknown; fallback: ReactNode; alt: string }) {
  const first = parseAssets(value).find((asset) => asset.kind === 'image');
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    setSrc('');
    if (first) signedPropertyUrl(first.path).then((url) => { if (active) setSrc(url); }).catch(() => {});
    return () => { active = false; };
  }, [first?.path]);
  return src ? <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" /> : <>{fallback}</>;
}
