import { server } from '@/lib/supabase';

export const PROPERTY_BUCKET = 'crm-property-media';
export type PropertyAsset = { path: string; name: string; kind: 'image' | 'document' };
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_DOCUMENT = 12 * 1024 * 1024;
const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENTS = new Set(['application/pdf']);
export function parseAssets(value: unknown): PropertyAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is PropertyAsset =>
    !!v && typeof v === 'object' && typeof v.path === 'string' && typeof v.name === 'string' &&
    (v.kind === 'image' || v.kind === 'document') &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.test(v.path)
  );
}
export function validateAsset(file: File, kind: PropertyAsset['kind']) {
  if (kind === 'image' && (!IMAGES.has(file.type) || file.size > MAX_IMAGE)) throw new Error('Solo JPG, PNG o WebP de hasta 8 MB.');
  if (kind === 'document' && (!DOCUMENTS.has(file.type) || file.size > MAX_DOCUMENT)) throw new Error('Solo PDF de hasta 12 MB.');
  if (file.size === 0) throw new Error('El archivo está vacío.');
}
const extFor = (mime: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<string, string>)[mime];
export async function uploadPropertyAsset(appId: string, recordId: string, file: File, kind: PropertyAsset['kind']) {
  validateAsset(file, kind);
  const path = `${appId}/${recordId}/${crypto.randomUUID()}.${extFor(file.type)}`;
  const { error } = await server().storage.from(PROPERTY_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return { path, name: file.name.slice(0, 120), kind } satisfies PropertyAsset;
}
export async function signedPropertyUrl(path: string) {
  const { data, error } = await server().storage.from(PROPERTY_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('No se pudo abrir el archivo.');
  return data.signedUrl;
}
export async function removePropertyAsset(path: string) {
  const { error } = await server().storage.from(PROPERTY_BUCKET).remove([path]);
  if (error) throw error;
}
