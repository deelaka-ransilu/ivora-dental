// Times are stored as UTC (timestamptz) and shown in Sri Lanka time
// (Asia/Colombo, UTC+5:30, no daylight saving).
// This is the ONLY file that converts between the two.

const TZ = "Asia/Colombo";

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// ---- Colombo calendar helpers ----
// A "Colombo date" is a plain string like "2026-10-13".

// The Colombo calendar date of a moment in time.
export function colomboDateString(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

// Add (or subtract) whole days to a Colombo date string.
export function addDaysToColomboDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Weekday of a Colombo date: 0 = Sunday ... 6 = Saturday.
export function colomboDayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

// A Colombo date plus a local time ("09:30") as the real moment in time.
export function colomboToDate(isoDate: string, hhmm: string): Date {
  return new Date(`${isoDate}T${hhmm}:00+05:30`);
}

// True only for strings like "2026-10-13" that are real dates.
export function isColomboDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}