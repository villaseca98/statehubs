/** Pure, currency-safe commission split planner for co-brokerage deals.
 * It does not create invoices, payments, or ledger entries.
 */
export interface CommissionParticipant {
  participantId: string;
  basisPoints: number;
}
export interface CommissionSplit {
  participantId: string;
  amountMinor: number;
  basisPoints: number;
}
export interface CommissionAllocation {
  currency: string;
  totalMinor: number;
  splits: CommissionSplit[];
}
export function allocateCommission(
  totalMinor: number,
  currency: string,
  participants: readonly CommissionParticipant[],
): CommissionAllocation {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('Commission must be nonnegative integer minor units');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be an uppercase ISO code');
  if (!participants.length || participants.length > 100) throw new Error('Provide 1–100 participants');
  const ids = new Set<string>();
  let sum = 0;
  for (const p of participants) {
    if (!p.participantId.trim() || ids.has(p.participantId)) throw new Error('Participant IDs must be unique and nonempty');
    if (!Number.isSafeInteger(p.basisPoints) || p.basisPoints < 0 || p.basisPoints > 10000) throw new Error('Invalid basis points');
    ids.add(p.participantId);
    sum += p.basisPoints;
  }
  if (sum !== 10000) throw new Error('Commission shares must total 10000 basis points');
  // BigInt prevents precision loss when multiplying large safe-integer amounts.
  const total = BigInt(totalMinor);
  const splits = participants.map(p => {
    const product = total * BigInt(p.basisPoints);
    return {
      participantId: p.participantId,
      basisPoints: p.basisPoints,
      amountMinor: Number(product / 10000n),
      remainder: product % 10000n,
    };
  });
  const distributed = splits.reduce((sum, p) => sum + p.amountMinor, 0);
  let remaining = totalMinor - distributed;
  // Largest-remainder method; ties broken by participant ID for stable results.
  const order = [...splits].sort((a, b) =>
    a.remainder === b.remainder ? a.participantId.localeCompare(b.participantId) : a.remainder > b.remainder ? -1 : 1
  );
  for (const split of order) {
    if (remaining <= 0) break;
    split.amountMinor += 1;
    remaining -= 1;
  }
  return {
    currency,
    totalMinor,
    splits: splits.map(({ participantId, amountMinor, basisPoints }) => ({ participantId, amountMinor, basisPoints })),
  };
}
