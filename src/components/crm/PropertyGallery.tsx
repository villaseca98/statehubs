import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppRecord } from '@shared/blueprint/types';
import { parseAssets, signedPropertyUrl } from '@/lib/crm/propertyMedia';
import { photoOf } from '@/lib/crm/estate';
import { usePropertyFeedText } from '@/i18n/propertyFeed';

function GalleryImage({ path, url, alt }: { path?: string; url?: string; alt: string }) {
 const t = usePropertyFeedText();
 const [src, setSrc] = useState(url ?? '');
 const [failed, setFailed] = useState(false);
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  let active = true;
  setSrc(url ?? ''); setFailed(false);
  if (path) signedPropertyUrl(path).then(value => { if (active) setSrc(value); }, () => { if (active) setFailed(true); });
  return () => { active = false; };
 }, [path, url, attempt]);
 if (failed) return <div role="alert" className="grid h-full content-center justify-items-center gap-3 px-6 text-center text-sm"><p>{t.photoError}</p><button type="button" className="min-h-11 rounded-full border px-4" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button></div>;
 return src ? <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" /> : <p role="status" className="grid h-full place-items-center">{t.loadingPhoto}</p>;
}

export function PropertyGallery({ record, title, onPropertySwipe }: { record: AppRecord; title: string; onPropertySwipe?: (step: number) => void }) {
 const t = usePropertyFeedText();
 const [index, setIndex] = useState(0);
 const touch = useRef<{ x: number; y: number } | null>(null);
 const images: { path?: string; url?: string }[] = parseAssets(record.data.statehubs_media).filter(a => a.kind === 'image').map(a => ({ path: a.path }));
 const legacy = photoOf(record.data.foto || record.data.imagen || record.data.image || record.data.photo || record.data.cover);
 if (legacy) images.push({ url: legacy });
 const safeIndex = Math.min(index, Math.max(0, images.length - 1));
 const selected = images[safeIndex];
 const move = (step: number) => setIndex(Math.max(0, Math.min(images.length - 1, safeIndex + step)));
 return <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--crm-bg)' }}
  onTouchStart={e => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; }}
  onTouchCancel={() => { touch.current = null; }}
  onTouchEnd={e => {
   const p = e.changedTouches[0], start = touch.current;
   if (start && p && Math.abs(p.clientX - start.x) > 65 && Math.abs(p.clientY - start.y) < 40) {
    const step = p.clientX < start.x ? 1 : -1;
    // Photos first, then the next property at the gallery boundary.
    if (safeIndex + step < 0 || safeIndex + step >= images.length) onPropertySwipe?.(step);
    else move(step);
   }
   touch.current = null;
  }}>
  {selected ? <GalleryImage key={selected.path ?? selected.url} {...selected} alt={`${title} · ${t.photo} ${safeIndex + 1}`} /> : <div className="grid h-full content-center justify-items-center gap-2 text-sm" style={{ color: 'var(--crm-muted)' }}><Building2 aria-hidden="true" className="h-10 w-10" /><span>{t.noPhoto}</span></div>}
  {images.length > 1 && <div role="group" aria-label={t.photo} className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
   <button type="button" aria-label={t.previousPhoto} disabled={safeIndex === 0} onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white disabled:opacity-40"><ChevronLeft /></button>
   <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white" role="status">{safeIndex + 1} / {images.length}</span>
   <button type="button" aria-label={t.nextPhoto} disabled={safeIndex === images.length - 1} onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white disabled:opacity-40"><ChevronRight /></button>
  </div>}
 </div>;
}
