// src/lib/dates.ts
// UTC-safe date helpers. AGENTS.md: "All timestamps stored in UTC to prevent
// timezone bugs." The old analytics used server-LOCAL date parts — wrong when
// the server is not in UTC. Every day-key / month-key in this codebase goes
// through here.

export const DAY_MS = 86_400_000;

/** Date → "YYYY-MM-DD" using UTC calendar parts. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → UTC midnight Date. */
export function utcDayStart(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

/** Month index in UTC — year*12+month, immune to local timezone drift. */
export function utcMonthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Inverse of utcMonthIndex → first day of that month, UTC. */
export function utcDateFromMonthIndex(idx: number): Date {
  return new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1));
}

/** "2024-03-15" → "Mar 24" label (UTC-stable). */
export function utcDayLabel(dateStr: string): string {
  const d = utcDayStart(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Today's UTC day key. */
export function todayUtc(): string {
  return utcDayKey(new Date());
}

/** N days ago as UTC day key. */
export function daysAgoUtc(n: number): string {
  return utcDayKey(new Date(Date.now() - n * DAY_MS));
}

/** Inclusive list of UTC day keys between two "YYYY-MM-DD" strings. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let t = utcDayStart(from).getTime();
  const end = utcDayStart(to).getTime();
  for (; t <= end; t += DAY_MS) out.push(utcDayKey(new Date(t)));
  return out;
}

/** Validate "YYYY-MM-DD". */
export function isValidDayKey(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(utcDayStart(s).getTime())
  );
}
