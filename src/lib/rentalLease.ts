/** Deterministic lease schedule helpers. No legal renewal or payment processing is implied. */
export type LeaseCadence = 'monthly';
export type LeaseDraft = {
  startsOn: string;
  endsOn: string;
  rentMinor: number;
  currency: string;
  cadence: LeaseCadence;
};
export type RentInstallment = { dueOn: string; amountMinor: number; currency: string };

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid calendar date');
  }
  return date;
}

function monthDue(start: Date, offset: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + offset;
  const first = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)));
}

export function buildMonthlyRentSchedule(lease: LeaseDraft, maxInstallments = 240): RentInstallment[] {
  if (lease.cadence !== 'monthly') throw new Error('Unsupported cadence');
  if (!Number.isSafeInteger(lease.rentMinor) || lease.rentMinor < 0) throw new Error('Invalid rent amount');
  if (!/^[A-Z]{3}$/.test(lease.currency)) throw new Error('Use an uppercase ISO currency code');
  if (!Number.isSafeInteger(maxInstallments) || maxInstallments < 1 || maxInstallments > 1200) {
    throw new Error('Invalid schedule limit');
  }
  const start = parseDate(lease.startsOn);
  const end = parseDate(lease.endsOn);
  if (end < start) throw new Error('Lease ends before it starts');
  const installments: RentInstallment[] = [];
  for (let i = 0; i < maxInstallments; i++) {
    const due = monthDue(start, i);
    if (due > end) return installments;
    installments.push({ dueOn: due.toISOString().slice(0, 10), amountMinor: lease.rentMinor, currency: lease.currency });
  }
  if (monthDue(start, maxInstallments) <= end) throw new Error('Lease exceeds schedule limit');
  return installments;
}
