// Date helpers. Calendar days follow Asia/Taipei (UTC+8, no DST).
// WearLog.date is a Postgres DATE; Prisma reads/writes it as UTC midnight of that calendar day,
// so a day key is always date.toISOString().slice(0, 10).

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Today's calendar date in Asia/Taipei as YYYY-MM-DD. */
export function taipeiToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> Date at UTC midnight (the value Prisma expects for @db.Date). */
export function dayStringToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Date from a @db.Date column -> YYYY-MM-DD. */
export function dateToDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

/** [start, end) of a month for @db.Date comparisons (UTC midnight bounds). */
export function monthDateRange(month: string): { start: Date; end: Date } {
  return { start: dayStringToDate(`${month}-01`), end: dayStringToDate(`${addMonths(month, 1)}-01`) };
}

/** Instant at which a Taipei month starts (for timestamp columns such as createdAt). */
export function taipeiMonthStartInstant(month: string): Date {
  return new Date(`${month}-01T00:00:00+08:00`);
}

export function lastDayOfMonth(month: string): string {
  const { end } = monthDateRange(month);
  return dateToDayString(new Date(end.getTime() - 24 * 60 * 60 * 1000));
}
