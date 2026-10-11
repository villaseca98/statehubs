import type { ViewAction } from '@shared/blueprint/types.ts';

// Spanish numbers without prefix get +34 so wa.me opens the right chat.
export function whatsappUrl(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}`;
}

export function actionsFor(actions: ViewAction[], stage: unknown): ViewAction[] {
  return actions.filter((a) => !a.when?.length || a.when.includes(String(stage ?? '')));
}
