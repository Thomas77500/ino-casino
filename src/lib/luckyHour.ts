export const LUCKY_HOUR_BONUS_RATE = 0.15;
const WINDOW_MS = 35 * 60 * 1000; // 35 min

// Deterministic per-day window: every client derives the same hour/minute from today's date
// string, so the "lucky hour" is shared by everyone without any server call or table.
function hashToday(day: string): number {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return h;
}

export function luckyWindow(now = new Date()): { start: number; end: number } {
  const day = now.toISOString().slice(0, 10);
  const midnight = new Date(`${day}T00:00:00`).getTime();
  const hash = hashToday(day);
  const startOfDay = midnight + (hash % (24 * 60)) * 60 * 1000; // minute offset within the day
  return { start: startOfDay, end: startOfDay + WINDOW_MS };
}

export function isLuckyHourNow(now = Date.now()): boolean {
  const { start, end } = luckyWindow(new Date(now));
  return now >= start && now < end;
}

export function luckyHourMsRemaining(now = Date.now()): number {
  const { end } = luckyWindow(new Date(now));
  return Math.max(0, end - now);
}
