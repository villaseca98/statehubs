import { describe, expect, it } from 'vitest';
import { parseAssets, validateAsset } from './propertyMedia';
const app = '11111111-1111-4111-8111-111111111111';
const record = '22222222-2222-4222-8222-222222222222';
const file = '33333333-3333-4333-8333-333333333333';
describe('property media security boundaries', () => {
  it('accepts only scoped private asset paths', () => {
    const good = { path: `${app}/${record}/${file}.webp`, name: 'Salón', kind: 'image' };
    expect(parseAssets([good, { ...good, path: 'https://evil.example/a.jpg' }, { ...good, path: '../../other.jpg' }])).toEqual([good]);
    expect(parseAssets(null)).toEqual([]);
  });
  it('allows image MIME and rejects unsupported formats', () => {
    expect(() => validateAsset(new File(['image'], 'casa.webp', { type: 'image/webp' }), 'image')).not.toThrow();
    expect(() => validateAsset(new File(['bad'], 'image.svg', { type: 'image/svg+xml' }), 'image')).toThrow();
    expect(() => validateAsset(new File(['bad'], 'plan.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'document')).toThrow();
  });
  it('enforces size and empty-file limits', () => {
    expect(() => validateAsset(new File([], 'empty.pdf', { type: 'application/pdf' }), 'document')).toThrow();
    const large = { type: 'image/png', size: 9 * 1024 * 1024 } as File;
    expect(() => validateAsset(large, 'image')).toThrow();
  });
});
