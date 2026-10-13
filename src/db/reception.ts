// Reception queries. Every function takes the current user and limits
// the data to that receptionist's own branch (architecture rule 7).
// Server only.

import { getSupabase } from "@/lib/supabase-server";
import { addDaysToColomboDate, colomboToDate, isColomboDate } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

export type BranchBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: "booked" | "cancelled";
  source: "online" | "phone" | "walk_in";
  patientName: string;
  patientPhone: string;
  dentistName: string;
  serviceName: string;
};

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// The branch this receptionist belongs to. Throws for anyone else.
function ownBranchId(user: CurrentUser): string {
  if (user.role !== "receptionist" || !user.branchId) {
    throw new Error("Not allowed: reception data needs a receptionist with a branch.");
  }
  return user.branchId;
}

export async function getOwnBranchName(user: CurrentUser): Promise<string> {
  const branchId = ownBranchId(user);
  const res = await getSupabase()
    .from("branches")
    .select("name")
    .eq("id", branchId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as { name: string } | null)?.name ?? "";
}

// All bookings (booked and cancelled) at the user's own branch on one Colombo date.
export async function getBranchBookings(
  user: CurrentUser,
  isoDate: string
): Promise<BranchBooking[]> {
  const branchId = ownBranchId(user);
  if (!isColomboDate(isoDate)) return [];

  const dayStart = colomboToDate(isoDate, "00:00").toISOString();
  const dayEnd = colomboToDate(addDaysToColomboDate(isoDate, 1), "00:00").toISOString();

  const res = await getSupabase()
    .from("appointments")
    .select(
      "id, start_at, end_at, status, source, patients(full_name, phone), dentists(full_name), services(name)"
    )
    .eq("branch_id", branchId)
    .gte("start_at", dayStart)
    .lt("start_at", dayEnd)
    .order("start_at", { ascending: true });
  if (res.error) throw new Error(res.error.message);

  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    status: "booked" | "cancelled";
    source: "online" | "phone" | "walk_in";
    patients: { full_name: string; phone: string } | { full_name: string; phone: string }[] | null;
    dentists: { full_name: string } | { full_name: string }[] | null;
    services: { name: string } | { name: string }[] | null;
  };

  return (res.data as unknown as Row[]).map((r) => ({
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    source: r.source,
    patientName: first(r.patients)?.full_name ?? "",
    patientPhone: first(r.patients)?.phone ?? "",
    dentistName: first(r.dentists)?.full_name ?? "",
    serviceName: first(r.services)?.name ?? "",
  }));
}

// ---- Cancel ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cancels a booking, but only if it belongs to the user's own branch and is still booked.
// Returns true if a booking was cancelled. Cancelled rows free the time again,
// because the double-booking rule ignores cancelled appointments.
export async function cancelBranchBooking(
  user: CurrentUser,
  appointmentId: string
): Promise<boolean> {
  const branchId = ownBranchId(user);
  if (!UUID_RE.test(appointmentId)) return false;

  const res = await getSupabase()
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("branch_id", branchId)
    .eq("status", "booked")
    .select("id");
  if (res.error) throw new Error(res.error.message);

  return (res.data?.length ?? 0) > 0;
}
