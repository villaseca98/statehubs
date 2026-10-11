import type { Availability } from './types.ts';

// Bookable slots for a worklist's `schedule` action. Datetimes are stored as
// local "YYYY-MM-DDTHH:MM" strings (what a datetime-local input produces).

export interface DaySlots { date: string; slots: { time: string; value: string; taken: boolean }[] }

const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The next `count` working days from `from` (today included), each with its slots.
// Slots already past on today, and slots inside the break, are left out.
export function buildSlots(a: Availability, taken: Iterable<string>, from: Date, count = 5): DaySlots[] {
  const busy = new Set([...taken].map((t) => String(t).slice(0, 16)));
  const out: DaySlots[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const nowMin = from.getHours() * 60 + from.getMinutes();
  for (let guard = 0; out.length < count && guard < 60; guard++, day.setDate(day.getDate() + 1)) {
    const weekday = ((day.getDay() + 6) % 7) + 1;
    if (!a.days.includes(weekday)) continue;
    const date = isoDay(day);
    const isToday = date === isoDay(from);
    const slots: DaySlots['slots'] = [];
    for (let m = toMin(a.from); m + a.slotMinutes <= toMin(a.to); m += a.slotMinutes) {
      if (a.breakFrom && a.breakTo && m < toMin(a.breakTo) && m + a.slotMinutes > toMin(a.breakFrom)) continue;
      if (isToday && m <= nowMin) continue;
      const time = toHHMM(m);
      const value = `${date}T${time}`;
      slots.push({ time, value, taken: busy.has(value) });
    }
    if (slots.length) out.push({ date, slots });
  }
  return out;
}
