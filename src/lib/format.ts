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