// Booking rules: which start times can be offered.
// Pure functions: no database calls here. Pages pass the data in.

import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
} from "@/lib/format";

// Online bookings need at least this much notice.
export const MIN_NOTICE_HOURS = 2;
// Online bookings can be made at most this many days ahead (today counts as day 0).
export const MAX_DAYS_AHEAD = 14;
// Start times are offered on this grid (09:00, 09:30, 10:00, ...).
export const SLOT_STEP_MINUTES = 30;

// One dentist's working hours at one branch, for ONE weekday.
// Times are local Colombo times like "09:00" (the database may return "09:00:00").
export type WorkingHours = {
  dentistId: string;
  branchId: string;
  startTime: string;
  endTime: string;
};

// A booked appointment. Pass booked ones only, for the dentists being checked,
// from ALL branches (a dentist cannot be in two places at once).
export type BusyRange = {
  dentistId: string;
  startAt: string; // ISO timestamp
  endAt: string;
};

// A closure. Exactly one of branchId or dentistId is set.
export type BlockedRange = {
  branchId: string | null;
  dentistId: string | null;
  startAt: string;
  endAt: string;
};

export type Slot = {
  dentistId: string;
  startAt: string; // ISO timestamp
  endAt: string;
};

// True if the Colombo date is today or later, and within MAX_DAYS_AHEAD.
export function isDateBookable(isoDate: string, now: Date = new Date()): boolean {
  const today = colomboDateString(now);
  const last = addDaysToColomboDate(today, MAX_DAYS_AHEAD);
  return isoDate >= today && isoDate <= last;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Two time ranges overlap if each starts before the other ends.
// Back-to-back (one ends exactly when the next starts) is NOT an overlap.
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// All free start times on one Colombo date, one entry per dentist per start time.
// `hours` must already be limited to the chosen branch, the chosen dentist (if any),
// dentists who offer the service, and this date's weekday.
// minNoticeMinutes: how far ahead a start time must be. Online bookings use the
// default (MIN_NOTICE_HOURS). Reception passes 0 (anything from now onwards).
export function generateSlots(input: {
  isoDate: string;
  branchId: string;
  durationMinutes: number;
  hours: WorkingHours[];
  appointments: BusyRange[];
  blocked: BlockedRange[];
  minNoticeMinutes?: number;
  now?: Date;
}): Slot[] {
  const now = input.now ?? new Date();
  if (!isDateBookable(input.isoDate, now)) return [];

  const noticeMinutes = input.minNoticeMinutes ?? MIN_NOTICE_HOURS * 60;
  const earliest = new Date(now.getTime() + noticeMinutes * 60 * 1000);
  const slots: Slot[] = [];

  for (const h of input.hours) {
    const dayStart = toMinutes(h.startTime);
    const dayEnd = toMinutes(h.endTime);

    for (
      let t = dayStart;
      t + input.durationMinutes <= dayEnd;
      t += SLOT_STEP_MINUTES
    ) {
      const start = colomboToDate(input.isoDate, toHHMM(t));
      const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

      // Not enough notice.
      if (start < earliest) continue;

      // This dentist already has a booking (in any branch).
      const busy = input.appointments.some(
        (a) =>
          a.dentistId === h.dentistId &&
          overlaps(start, end, new Date(a.startAt), new Date(a.endAt))
      );
      if (busy) continue;

      // The branch or the dentist is blocked.
      const closed = input.blocked.some(
        (b) =>
          (b.branchId === h.branchId || b.dentistId === h.dentistId) &&
          overlaps(start, end, new Date(b.startAt), new Date(b.endAt))
      );
      if (closed) continue;

      slots.push({
        dentistId: h.dentistId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    }
  }

  return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
}
