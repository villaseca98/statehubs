import type { AppRecord, Blueprint } from '@shared/blueprint/types';
import { contactInactive, explicitlyQualified, linkedContacts, linkedToProperty, propertyCategory } from './propertyFeed';

// Everything the mini-CRM of one property shows, computed from the same
// records as the global CRM: no separate store, so every view stays in sync.

const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const VIEWING = /^(cita_inmo|visita|viewing|viewings|appointment)$/i;
const BOOKING = /^(reserva|reservas|booking|bookings|reservation|reservations)$/i;
const DEAL = /^(operacion|deal|deals|oportunidad)$/i;
const CONVERSATION = /^(conversacion|conversation|conversations)$/i;
const NEW_DAYS = 7;

export const viewingAt = (r: AppRecord) => str(r.data.cuando || r.data.start || r.data.start_date || r.data.date);
export const bookingFrom = (r: AppRecord) => str(r.data.entrada || r.data.check_in);
export const bookingTo = (r: AppRecord) => str(r.data.salida || r.data.check_out);
export const isCancelled = (r: AppRecord) => /^(cancelada|cancelled|canceled)$/i.test(str(r.data.estado || r.data.status));
/** A viewing is confirmed only when the record says so; a stored date alone is a request. */
export const viewingConfirmed = (r: AppRecord) => r.data.confirmada === true || /^(confirmada|confirmed|hecha|interesa|oferta)$/i.test(str(r.data.resultado || r.data.status));

export interface PropertyHubData {
 leads: { qualified: AppRecord[]; potential: AppRecord[]; fresh: AppRecord[]; discarded: AppRecord[] };
 conversations: AppRecord[];
 viewings: { upcoming: AppRecord[]; past: AppRecord[] };
 bookings: { upcoming: AppRecord[]; past: AppRecord[] };
 deals: { open: AppRecord[]; closed: AppRecord[] };
 next: { kind: 'viewing' | 'booking'; record: AppRecord; at: string } | null;
 agentId: string | null;
 holiday: boolean;
}

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function propertyHub(property: AppRecord, records: AppRecord[], blueprint: Blueprint, now = new Date()): PropertyHubData {
 const today = local(now);
 const linked = records.filter(r => r.id !== property.id && linkedToProperty(r, property, blueprint));
 const contacts = linkedContacts(property, records, blueprint, true);
 const contactIds = new Set(contacts.map(c => c.id));
 const active = contacts.filter(c => !contactInactive(c));
 const recent = (r: AppRecord) => !!r.created_at && now.getTime() - Date.parse(r.created_at) < NEW_DAYS * 86400000;
 const qualified = active.filter(explicitlyQualified);
 const potential = active.filter(c => !explicitlyQualified(c));
 const viewings = linked.filter(r => VIEWING.test(r.entity)).sort((a, b) => viewingAt(a).localeCompare(viewingAt(b)));
 const bookings = linked.filter(r => BOOKING.test(r.entity)).sort((a, b) => bookingFrom(a).localeCompare(bookingFrom(b)));
 const deals = linked.filter(r => DEAL.test(r.entity));
 const closedDeal = (r: AppRecord) => /^(ganada|perdida|cerrada|won|lost|closed)$/i.test(str(r.data.etapa || r.data.stage || r.data.estado));
 // Conversations about the property, or with someone already linked to it.
 const conversations = records.filter(r => CONVERSATION.test(r.entity) && Boolean(r.is_sample) === Boolean(property.is_sample)
  && (linkedToProperty(r, property, blueprint) || contactIds.has(str(r.data.contacto))))
  .sort((a, b) => str(b.data.ultima_actividad || b.updated_at).localeCompare(str(a.data.ultima_actividad || a.updated_at)));
 const upcomingViewings = viewings.filter(v => viewingAt(v) && viewingAt(v) >= today && !isCancelled(v));
 const upcomingBookings = bookings.filter(b => (bookingTo(b) || bookingFrom(b)) >= today.slice(0, 10) && !isCancelled(b));
 const candidates = [
  ...upcomingViewings.map(record => ({ kind: 'viewing' as const, record, at: viewingAt(record) })),
  ...upcomingBookings.filter(b => bookingFrom(b) >= today.slice(0, 10)).map(record => ({ kind: 'booking' as const, record, at: bookingFrom(record) })),
 ].sort((a, b) => a.at.localeCompare(b.at));
 return {
  leads: { qualified, potential, fresh: potential.filter(recent), discarded: contacts.filter(contactInactive) },
  conversations,
  viewings: { upcoming: upcomingViewings, past: viewings.filter(v => !upcomingViewings.includes(v)).reverse() },
  bookings: { upcoming: upcomingBookings, past: bookings.filter(b => !upcomingBookings.includes(b)).reverse() },
  deals: { open: deals.filter(d => !closedDeal(d)), closed: deals.filter(closedDeal) },
  next: candidates[0] ?? null,
  agentId: str(property.data.agente || property.data.agent_id) || null,
  holiday: propertyCategory(property).market === 'holiday-rentals',
 };
}

/** Commission of a deal from its own amount and percentage; null when either is missing. */
export function dealCommission(deal: AppRecord): number | null {
 const amount = num(deal.data.importe ?? deal.data.amount), rate = num(deal.data.comision ?? deal.data.commission_rate);
 return amount === null || rate === null ? null : Math.round(amount * rate) / 100;
}
