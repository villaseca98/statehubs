import { describe, expect, it } from 'vitest';
import { allocateCommission } from './commissionSplitPlanning';

describe('allocateCommission', () => {
  it('allocates every minor unit with stable largest-remainder rounding', () => {
    const result = allocateCommission(101, 'EUR', [
      { participantId: 'broker-a', basisPoints: 5000 },
      { participantId: 'broker-b', basisPoints: 5000 },
    ]);
    expect(result.splits.map(p => p.amountMinor)).toEqual([51, 50]);
    expect(result.splits.reduce((sum, p) => sum + p.amountMinor, 0)).toBe(101);
  });
  it('does not depend on input order for tie-breaking', () => {
    const result = allocateCommission(1, 'USD', [
      { participantId: 'z', basisPoints: 5000 },
      { participantId: 'a', basisPoints: 5000 },
    ]);
    expect(result.splits.find(p => p.participantId === 'a')?.amountMinor).toBe(1);
  });
  it('handles large integer amounts without floating-point multiplication', () => {
    const result = allocateCommission(Number.MAX_SAFE_INTEGER, 'GBP', [
      { participantId: 'a', basisPoints: 3333 },
      { participantId: 'b', basisPoints: 6667 },
    ]);
    expect(result.splits.reduce((sum, p) => sum + BigInt(p.amountMinor), 0n)).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  });
  it('rejects invalid percentages, duplicates, and fractional money', () => {
    expect(() => allocateCommission(100, 'EUR', [{ participantId: 'a', basisPoints: 9999 }])).toThrow();
    expect(() => allocateCommission(100.5, 'EUR', [{ participantId: 'a', basisPoints: 10000 }])).toThrow();
    expect(() => allocateCommission(100, 'eur', [{ participantId: 'a', basisPoints: 10000 }])).toThrow();
    expect(() => allocateCommission(100, 'EUR', [{ participantId: 'a', basisPoints: 5000 }, { participantId: 'a', basisPoints: 5000 }])).toThrow();
  });
});
