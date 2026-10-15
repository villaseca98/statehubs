import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyGallery } from './PropertyGallery';
const { sign } = vi.hoisted(() => ({ sign: vi.fn() }));
vi.mock('@/lib/crm/propertyMedia', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/crm/propertyMedia')>(), signedPropertyUrl: sign }));
const root = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/';
const record = { id: 'property', entity: 'inmueble', data: { statehubs_media: [
 { path: `${root}33333333-3333-3333-3333-333333333333.jpg`, kind: 'image', name: 'Front' },
 { path: `${root}44444444-4444-4444-4444-444444444444.jpg`, kind: 'image', name: 'Interior' },
] } };
beforeEach(() => { vi.clearAllMocks(); sign.mockImplementation(async path => `https://example.com/${path}`); });
it('signs private photos on demand, supports swipe/keyboard buttons and ignores vertical scrolling', async () => {
 render(<PropertyGallery record={record} title="Ocean House" />);
 expect(await screen.findByRole('img', { name: 'Ocean House · Property photo 1' })).toBeTruthy();
 const first = screen.getByRole('img');
 const surface = first.parentElement!;
 fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 100 }] });
 fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 100, clientY: 200 }] });
 expect(screen.getByRole('img')).toHaveAttribute('alt', 'Ocean House · Property photo 1');
 fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 100 }] });
 fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 100, clientY: 105 }] });
 expect(await screen.findByRole('img', { name: 'Ocean House · Property photo 2' })).toBeTruthy();
 expect(sign).toHaveBeenCalledTimes(2);
 expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled();
 fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
 expect(await screen.findByRole('img', { name: 'Ocean House · Property photo 1' })).toBeTruthy();
});
it('reports signing errors and retries without persisting signed URLs', async () => {
 sign.mockRejectedValueOnce(new Error('Not authorized'));
 render(<PropertyGallery record={record} title="Ocean House" />);
 expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this photo.');
 fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
 expect(await screen.findByRole('img')).toBeTruthy();
 expect(record.data.statehubs_media[0]).not.toHaveProperty('url');
});
it('hands a swipe at the photo boundary to property navigation', () => {
 const onPropertySwipe = vi.fn();
 const { container } = render(<PropertyGallery record={{ ...record, data: { foto: '/demo/hero-villa.jpg' } }} title="Ocean House" onPropertySwipe={onPropertySwipe} />);
 const surface = container.firstElementChild!;
 fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 100 }] });
 fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 100, clientY: 105 }] });
 expect(onPropertySwipe).toHaveBeenCalledWith(1);
});
