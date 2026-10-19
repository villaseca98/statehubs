import type { AppRecord } from '@shared/blueprint/types';
import { photoOf } from './estate';
import { propertyCategory } from './propertyFeed';

// Display helpers shared by the property card, the mini-CRM and the Matcher.
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

export const currencyCode = (r: AppRecord) => str(r.data.moneda || r.data.currency).toUpperCase();
export function money(value: unknown, currency: string, language: string, missingCurrency: string) {
 const n = amount(value);
 if (n === null) return '';
 try { return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
 catch { return `${new Intl.NumberFormat(language).format(n)} · ${missingCurrency}`; }
}
/** Nightly price for holiday rentals, sale or monthly price otherwise. Missing currency is shown, never assumed. */
export function propertyPrice(r: AppRecord, language: string, t: { night: string; currency: string }) {
 const holiday = propertyCategory(r).market === 'holiday-rentals';
 const value = holiday ? r.data.precio_noche ?? r.data.nightly_price : r.data.precio ?? r.data.price ?? r.data.list_price;
 const label = money(value, currencyCode(r), language, t.currency);
 return label && holiday ? `${label} ${t.night}` : label;
}
export const propertyLocation = (r: AppRecord) => [str(r.data.zona || r.data.area), str(r.data.ciudad || r.data.city), str(r.data.ubicacion || r.data.location)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
export const legacyPhoto = (r: AppRecord) => photoOf(r.data.foto || r.data.imagen || r.data.image || r.data.photo || r.data.cover);
export const initials = (name: string) => name.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

export interface ContactLinks { email?: string; phone?: string; whatsapp?: string }
export function contactLinks(r: AppRecord | undefined): ContactLinks {
 if (!r) return {};
 const email = str(r.data.email || r.data.correo);
 const phone = str(r.data.telefono || r.data.phone || r.data.mobile || r.data.whatsapp);
 const digits = phone.replace(/[^+\d]/g, '');
 return {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
  phone: digits.replace(/\D/g, '').length >= 6 ? digits : undefined,
  // wa.me needs the international number; a local number without a prefix is not guessed.
  whatsapp: digits.startsWith('+') ? `https://wa.me/${digits.slice(1)}` : undefined,
 };
}
export function shortDate(value: string, language: string) {
 if (!value) return '';
 const time = value.length > 10;
 const d = new Date(time ? value : `${value}T00:00`);
 if (!Number.isFinite(d.getTime())) return value;
 return new Intl.DateTimeFormat(language, time ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }).format(d);
}
