// Dentist queries. Read-only. Every function takes the current user and returns
// only that dentist's own bookings (architecture rules 7 and 8).
// Patient phone numbers are NEVER selected here. Server only.

import { getSupabase } from "@/lib/supabase-server";
import {
  addDaysToColomboDate,
  colomboToDate,
  isColomboDate,
} from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

export type DentistBooking = {
  id: string;
  startAt: string;
  endAt: string;
  patientName: string;
  serviceName: string;
  branchName: string;
};

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// The dentist record this user is linked to. Throws for anyone else.
function ownDentistId(user: CurrentUser): string {
  if (user.role !== "dentist" || !user.dentistId) {
    throw new Error("Not allowed: dentist data needs a dentist login.");
  }
  return user.dentistId;
}

// This dentist's booked appointments on one Colombo date, in ALL their branches.
// Cancelled appointments are left out.
export async function getOwnDentistBookings(
  user: CurrentUser,
  isoDate: string
): Promise<DentistBooking[]> {
  const dentistId = ownDentistId(user);
  if (!isColomboDate(isoDate)) return [];

  const dayStart = colomboToDate(isoDate, "00:00").toISOString();
  const dayEnd = colomboToDate(
    addDaysToColomboDate(isoDate, 1),
    "00:00"
  ).toISOString();

  // Note: no phone column anywhere in this select.
  const res = await getSupabase()
    .from("appointments")
    .select(
      "id, start_at, end_at, patients(full_name), services(name), branches(name)"
    )
    .eq("dentist_id", dentistId)
    .eq("status", "booked")
    .gte("start_at", dayStart)
    .lt("start_at", dayEnd)
    .order("start_at", { ascending: true });
  if (res.error) throw new Error(res.error.message);

  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    patients: { full_name: string } | { full_name: string }[] | null;
    services: { name: string } | { name: string }[] | null;
    branches: { name: string } | { name: string }[] | null;
  };

  return (res.data as unknown as Row[]).map((r) => ({
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    patientName: first(r.patients)?.full_name ?? "",
    serviceName: first(r.services)?.name ?? "",
    branchName: first(r.branches)?.name ?? "",
  }));
}
