/** Development unit inventory and reservation decisions; pure domain validation, no database write. */
export type UnitStatus = 'available' | 'reserved' | 'under_contract' | 'sold';
export interface DevelopmentUnit { id: string; developmentId: string; organizationId: string; status: UnitStatus; currency: string; askingPriceMinor: number; reservedUntil?: string; buyerId?: string }
export interface ReservationRequest { organizationId: string; buyerId: string; reservedUntil: string; today: string }
const day = (value: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be YYYY-MM-DD');
  const date = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0,10) !== value) throw new Error('Invalid date');
  return date;
};
export function reserveDevelopmentUnit(unit: DevelopmentUnit, request: ReservationRequest): DevelopmentUnit {
  if (!unit.organizationId || unit.organizationId !== request.organizationId) throw new Error('Organization mismatch');
  if (!request.buyerId.trim()) throw new Error('Buyer is required');
  if (!Number.isSafeInteger(unit.askingPriceMinor) || unit.askingPriceMinor < 0) throw new Error('Invalid price');
  if (!/^[A-Z]{3}$/.test(unit.currency)) throw new Error('Invalid currency');
  if (day(request.reservedUntil) <= day(request.today)) throw new Error('Reservation expiry must be in the future');
  if (unit.status !== 'available') throw new Error('Unit is not available');
  return { ...unit, status: 'reserved', buyerId: request.buyerId, reservedUntil: request.reservedUntil };
}
export function releaseExpiredUnit(unit: DevelopmentUnit, today: string): DevelopmentUnit {
  if (unit.status !== 'reserved' || !unit.reservedUntil || day(unit.reservedUntil) >= day(today)) return unit;
  return { ...unit, status: 'available', buyerId: undefined, reservedUntil: undefined };
}
