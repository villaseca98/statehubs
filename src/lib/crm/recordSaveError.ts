/** Convert database errors to actionable English messages without leaking SQL internals. */
export function recordSaveError(error: unknown): string {
  const value = error && typeof error === 'object' ? error as {code?:unknown;message?:unknown} : null;
  const code = typeof value?.code === 'string' ? value.code : '';
  const message = typeof value?.message === 'string' ? value.message : error instanceof Error ? error.message : '';
  if (code === '23P01' || /property is unavailable for these dates/i.test(message))
    return 'This property is already booked or blocked for the selected dates. Choose another date range.';
  if (/booking requires a property/i.test(message))
    return 'Select a property before saving this booking.';
  if (/booking requires ISO check-in and check-out dates/i.test(message))
    return 'Enter valid check-in and check-out dates.';
  if (/check-out must be later than check-in/i.test(message))
    return 'Check-out must be later than check-in.';
  if (code === '23514' && /booking|check-in|check-out/i.test(message))
    return 'Please check the booking details and try again.';
  return message || 'The change could not be saved. Please try again.';
}
