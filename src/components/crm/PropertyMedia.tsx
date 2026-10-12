import { useEffect, useState } from 'react';
import { FileText, ImagePlus, LoaderCircle, Trash2, ExternalLink } from 'lucide-react';
import type { AppRecord, RecordData } from '@shared/blueprint/types.ts';
import { hasServer } from '@/lib/supabase';
import { parseAssets, removePropertyAsset, signedPropertyUrl, uploadPropertyAsset } from '@/lib/crm/propertyMedia';
import type { PropertyAsset } from '@/lib/crm/propertyMedia';

export function PropertyMedia({ appId, record, onUpdate }: { appId?: string; record: AppRecord; onUpdate: (id: string, data: RecordData) => void }) {
  const assets = parseAssets(record.data.statehubs_media);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const enabled = hasServer && !!appId;
  useEffect(() => {
    let active = true;
    Promise.all(assets.map(async (asset) => {
      try { return [asset.path, await signedPropertyUrl(asset.path)] as const; }
      catch { return [asset.path, ''] as const; }
    })).then((items) => { if (active) setUrls(Object.fromEntries(items)); });
    return () => { active = false; };
  // Keyed by persisted paths; record changes elsewhere should refresh URLs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.map((a) => a.path).join('|')]);
  const upload = async (file: File | undefined, kind: PropertyAsset['kind']) => {
    if (!file || !appId || busy) return;
    setBusy(true); setError('');
    try {
      const asset = await uploadPropertyAsset(appId, record.id, file, kind);
      onUpdate(record.id, { statehubs_media: [...assets, asset] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al subir el archivo.'); }
    finally { setBusy(false); }
  };
  const remove = async (asset: PropertyAsset) => {
    if (busy || !window.confirm('¿Eliminar este archivo de forma permanente?')) return;
    setBusy(true); setError('');
    try {
      await removePropertyAsset(asset.path);
      onUpdate(record.id, { statehubs_media: assets.filter((a) => a.path !== asset.path) });
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el archivo.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Galería y documentos" className="mb-6 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Galería y documentos</h3>
      {enabled && <div className="flex flex-wrap gap-2">
        {(['image', 'document'] as const).map((kind) => <label key={kind} className="sh-focus inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--crm-border)' }}>
          {kind === 'image' ? <ImagePlus aria-hidden="true" className="h-4 w-4"/> : <FileText aria-hidden="true" className="h-4 w-4"/>}
          {kind === 'image' ? 'Añadir foto' : 'Añadir PDF'}
          <input type="file" className="sr-only" accept={kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'application/pdf'} disabled={busy} aria-label={kind === 'image' ? 'Subir foto' : 'Subir PDF'}
            onChange={(e) => { void upload(e.target.files?.[0], kind); e.target.value = ''; }} />
        </label>)}
      </div>}
    </div>
    {!enabled && <p className="text-xs" style={{ color: 'var(--crm-muted)' }}>La subida privada requiere iniciar sesión y tener Supabase configurado.</p>}
    {busy && <p role="status" className="flex items-center gap-2 text-xs"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none"/> Procesando archivo…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {assets.map((asset) => <div key={asset.path} className="group relative overflow-hidden rounded-xl border" style={{ borderColor: 'var(--crm-border)' }}>
        {asset.kind === 'image' && urls[asset.path] ? <img src={urls[asset.path]} alt={asset.name} loading="lazy" className="aspect-[4/3] w-full object-cover"/> :
          <div className="flex aspect-[4/3] items-center justify-center"><FileText className="h-7 w-7" aria-hidden="true"/></div>}
        <div className="flex items-center justify-between gap-1 p-2">
          <span className="min-w-0 flex-1 truncate text-xs" title={asset.name}>{asset.name}</span>
          {urls[asset.path] && <a href={urls[asset.path]} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${asset.name}`} className="sh-focus rounded p-1"><ExternalLink className="h-4 w-4"/></a>}
          {enabled && <button type="button" disabled={busy} onClick={() => void remove(asset)} aria-label={`Eliminar ${asset.name}`} className="sh-focus rounded p-1 disabled:opacity-40"><Trash2 className="h-4 w-4"/></button>}
        </div>
      </div>)}
    </div> : <p className="rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-muted)' }}>Todavía no hay fotografías ni documentos privados.</p>}
  </section>;
}
