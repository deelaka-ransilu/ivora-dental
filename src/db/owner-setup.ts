// Owner setup queries (O2): edit dentists, services and opening hours.
// Nothing is added or deleted here. Owner only. Server only.

import { getSupabase } from "@/lib/supabase-server";
import {
  colomboDateString,
  colomboDayOfWeek,
  colomboMinuteOfDay,
} from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

export type DentistRow = {
  id: string;
  fullName: string;
  isActive: boolean;
  futureBookings: number;
};
export type ServiceRow = { id: string; name: string; durationMinutes: number };
export type HoursRow = {
  id: string;
  dentistId: string;
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  dentistName: string;
  branchName: string;
};
export type SetupData = {
  dentists: DentistRow[];
  services: ServiceRow[];
  hours: HoursRow[];
};

type HoursDbRow = {
  id: string;
  dentist_id: string;
  branch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  dentists: { full_name: string } | { full_name: string }[] | null;
  branches: { name: string } | { name: string }[] | null;
};

const HOURS_SELECT =
  "id, dentist_id, branch_id, day_of_week, start_time, end_time, dentists(full_name), branches(name)";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ownerOnly(user: CurrentUser): void {
  if (user.role !== "owner") {
    throw new Error("Not allowed: setup needs the owner login.");
  }
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function mapHours(r: HoursDbRow): HoursRow {
  return {
    id: r.id,
    dentistId: r.dentist_id,
    branchId: r.branch_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    dentistName: first(r.dentists)?.full_name ?? "",
    branchName: first(r.branches)?.name ?? "",
  };
}

// Booked appointments from now on, optionally for one dentist and/or one branch.
async function futureBookings(
  dentistId: string | null,
  branchId: string | null
): Promise<
  { dentist_id: string; branch_id: string; start_at: string; end_at: string }[]
> {
  let query = getSupabase()
    .from("appointments")
    .select("dentist_id, branch_id, start_at, end_at")
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());
  if (dentistId) query = query.eq("dentist_id", dentistId);
  if (branchId) query = query.eq("branch_id", branchId);

  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return res.data as {
    dentist_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
  }[];
}

export async function getSetupData(user: CurrentUser): Promise<SetupData> {
  ownerOnly(user);
  const db = getSupabase();

  const [dentistRes, serviceRes, hoursRes, future] = await Promise.all([
    db.from("dentists").select("id, full_name, is_active").order("full_name"),
    db.from("services").select("id, name, duration_minutes").order("name"),
    db.from("dentist_branch_hours").select(HOURS_SELECT),
    futureBookings(null, null),
  ]);
  for (const res of [dentistRes, serviceRes, hoursRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const counts = new Map<string, number>();
  for (const f of future) {
    counts.set(f.dentist_id, (counts.get(f.dentist_id) ?? 0) + 1);
  }

  const dentists = (
    dentistRes.data as { id: string; full_name: string; is_active: boolean }[]
  ).map((d) => ({
    id: d.id,
    fullName: d.full_name,
    isActive: d.is_active,
    futureBookings: counts.get(d.id) ?? 0,
  }));

  const services = (
    serviceRes.data as { id: string; name: string; duration_minutes: number }[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.duration_minutes,
  }));

  const hours = (hoursRes.data as unknown as HoursDbRow[])
    .map(mapHours)
    .sort(
      (a, b) =>
        a.dentistName.localeCompare(b.dentistName) ||
        a.branchName.localeCompare(b.branchName) ||
        a.dayOfWeek - b.dayOfWeek ||
        a.startTime.localeCompare(b.startTime)
    );

  return { dentists, services, hours };
}

// How many future bookings this dentist has (any branch).
export async function countFutureForDentist(
  user: CurrentUser,
  dentistId: string
): Promise<number> {
  ownerOnly(user);
  const rows = await futureBookings(dentistId, null);
  return rows.length;
}

// Turning a dentist off hides them from the booking form only.
// Existing bookings are not touched.
export async function updateDentist(
  user: CurrentUser,
  id: string,
  fullName: string,
  isActive: boolean
): Promise<boolean> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("dentists")
    .update({ full_name: fullName, is_active: isActive })
    .eq("id", id)
    .select("id");
  if (res.error) {
    console.error("dentist update failed:", res.error.message);
    return false;
  }
  return (res.data?.length ?? 0) > 0;
}

// Changes the duration of NEW bookings only. Existing bookings keep their end time.
export async function updateService(
  user: CurrentUser,
  id: string,
  name: string,
  durationMinutes: number
): Promise<boolean> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("services")
    .update({ name, duration_minutes: durationMinutes })
    .eq("id", id)
    .select("id");
  if (res.error) {
    console.error("service update failed:", res.error.message);
    return false;
  }
  return (res.data?.length ?? 0) > 0;
}

export async function getHoursRow(
  user: CurrentUser,
  id: string
): Promise<HoursRow | null> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("dentist_branch_hours")
    .select(HOURS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;
  return mapHours(res.data as unknown as HoursDbRow);
}

// Future bookings for this dentist at this branch, on this weekday,
// that would fall outside the NEW start and end times.
export async function countOutsideHours(
  user: CurrentUser,
  row: HoursRow,
  startTime: string,
  endTime: string
): Promise<number> {
  ownerOnly(user);
  const from = toMin(startTime);
  const to = toMin(endTime);
  const rows = await futureBookings(row.dentistId, row.branchId);

  return rows.filter((b) => {
    if (colomboDayOfWeek(colomboDateString(b.start_at)) !== row.dayOfWeek) {
      return false;
    }
    return (
      colomboMinuteOfDay(b.start_at) < from ||
      colomboMinuteOfDay(b.end_at) > to
    );
  }).length;
}

export async function updateHours(
  user: CurrentUser,
  id: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("dentist_branch_hours")
    .update({ start_time: startTime, end_time: endTime })
    .eq("id", id)
    .select("id");
  if (res.error) {
    console.error("hours update failed:", res.error.message);
    return false;
  }
  return (res.data?.length ?? 0) > 0;
}
