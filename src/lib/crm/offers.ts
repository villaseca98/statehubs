import { CURRENCY_CODES } from './currencies';
export type OfferStatus = 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
export interface OfferRevision {
 id: string; app_id: string; deal_id: string; contact_id: string; property_id: string;
 revision: number; amount: number; currency: string; status: OfferStatus; note: string;
 actor_id: string | null; created_at: string;
}
export interface OfferInput { amount: number; currency: string; status: OfferStatus; note: string }
export const isOfferOpen = (offer?: OfferRevision) => !offer || offer.status === 'submitted' || offer.status === 'countered';
export function validateOffer(input: OfferInput, previous?: OfferRevision) {
 if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 999999999999 || !CURRENCY_CODES.some(c=>c===input.currency) || input.note.length > 4000) throw new Error('Invalid offer terms');
 if (!previous && input.status !== 'submitted') throw new Error('The first revision must be submitted');
 if (previous && (!isOfferOpen(previous) || !['countered','accepted','rejected','withdrawn'].includes(input.status))) throw new Error('Invalid offer transition');
 if (previous && input.status !== 'countered' && (input.amount !== previous.amount || input.currency !== previous.currency)) throw new Error('Counter the offer before changing its terms');
}
