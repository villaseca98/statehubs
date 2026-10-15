import { describe, expect, it } from 'vitest';
import { buildMonthlyRentSchedule } from './rentalLease';

describe('monthly rent schedule', () => {
  it('clamps month-end without drifting', () => {
    expect(buildMonthlyRentSchedule({ startsOn: '2027-01-31', endsOn: '2027-04-30', rentMinor: 125000, currency: 'EUR', cadence: 'monthly' }).map(x => x.dueOn))
      .toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });
  it('rejects invalid dates, reversed leases and unsafe money', () => {
    const base = { startsOn: '2027-02-01', endsOn: '2027-04-01', rentMinor: 10000, currency: 'USD', cadence: 'monthly' as const };
    expect(() => buildMonthlyRentSchedule({ ...base, startsOn: '2027-02-30' })).toThrow();
    expect(() => buildMonthlyRentSchedule({ ...base, endsOn: '2027-01-01' })).toThrow();
    expect(() => buildMonthlyRentSchedule({ ...base, rentMinor: 10.5 })).toThrow();
    expect(() => buildMonthlyRentSchedule({ ...base, currency: 'usd' })).toThrow();
  });
  it('does not silently truncate long leases', () => {
    expect(() => buildMonthlyRentSchedule({ startsOn: '2027-01-01', endsOn: '2030-01-01', rentMinor: 1, currency: 'EUR', cadence: 'monthly' }, 2)).toThrow('limit');
  });
});
