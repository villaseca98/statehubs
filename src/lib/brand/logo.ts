import { MAX_LOGO } from '@shared/blueprint/validate.ts';

// Shrinks any image the owner picks to a small PNG data URL for bp.logo.

const SIZE = 256;

export async function imageToLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen (PNG, JPG, WebP o SVG).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, SIZE / Math.max(img.naturalWidth || SIZE, img.naturalHeight || SIZE));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || SIZE) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || SIZE) * scale));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    // [SECURITY] Re-encoding as PNG drops anything an SVG or a crafted file could carry.
    const data = canvas.toDataURL('image/png');
    if (data.length > MAX_LOGO) throw new Error('La imagen es demasiado grande incluso reducida.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}

