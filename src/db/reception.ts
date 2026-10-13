// Reception queries. Every function takes the current user and limits
// the data to that receptionist's own branch (architecture rule 7).
// Server only.

import { getSupabase } from "@/lib/supabase-server";
import { getAvailableSlots } from "@/db/booking";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  isColomboDate,
} from "@/lib/format";
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

// ---- Move and delete patient data (Phase 3) ----

export type OwnBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: "booked" | "cancelled";
  serviceId: string;
  serviceName: string;
  dentistId: string;
  dentistName: string;
  patientName: string;
};

// One booking, but only if it belongs to the user's own branch. Otherwise null.
export async function getOwnBranchBooking(
  user: CurrentUser,
  appointmentId: string
): Promise<OwnBooking | null> {
  const branchId = ownBranchId(user);
  if (!UUID_RE.test(appointmentId)) return null;

  const res = await getSupabase()
    .from("appointments")
    .select(
      "id, start_at, end_at, status, service_id, dentist_id, patients(full_name), dentists(full_name), services(name)"
    )
    .eq("id", appointmentId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;

  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    status: "booked" | "cancelled";
    service_id: string;
    dentist_id: string;
    patients: { full_name: string } | { full_name: string }[] | null;
    dentists: { full_name: string } | { full_name: string }[] | null;
    services: { name: string } | { name: string }[] | null;
  };
  const r = res.data as unknown as Row;

  return {
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    serviceId: r.service_id,
    serviceName: first(r.services)?.name ?? "",
    dentistId: r.dentist_id,
    dentistName: first(r.dentists)?.full_name ?? "",
    patientName: first(r.patients)?.full_name ?? "",
  };
}

export type MoveBookingResult =
  | { ok: true; startAt: string }
  | { ok: false; reason: "taken" | "notfound" | "server" };

// Moves a booked appointment to a new start time. Same service, same dentist,
// same branch. One UPDATE, so if the new time is refused nothing changes.
// Reception has no 2-hour notice rule (minNoticeMinutes: 0).
export async function moveBranchBooking(
  user: CurrentUser,
  appointmentId: string,
  newStartAt: string
): Promise<MoveBookingResult> {
  const branchId = ownBranchId(user);
  if (Number.isNaN(new Date(newStartAt).getTime())) {
    return { ok: false, reason: "notfound" };
  }

  const booking = await getOwnBranchBooking(user, appointmentId);
  if (!booking || booking.status !== "booked") {
    return { ok: false, reason: "notfound" };
  }

  // Re-check that the new time is still free for this dentist and service.
  const free = await getAvailableSlots({
    isoDate: colomboDateString(newStartAt),
    branchId,
    serviceId: booking.serviceId,
    dentistId: booking.dentistId,
    minNoticeMinutes: 0,
  });
  const chosen = free.find(
    (s) => new Date(s.startAt).getTime() === new Date(newStartAt).getTime()
  );
  if (!chosen) return { ok: false, reason: "taken" };

  const res = await getSupabase()
    .from("appointments")
    .update({ start_at: chosen.startAt, end_at: chosen.endAt })
    .eq("id", appointmentId)
    .eq("branch_id", branchId)
    .eq("status", "booked")
    .select("id");

  if (res.error) {
    // 23P01 = the database refused an overlapping booking for this dentist.
    if (res.error.code === "23P01") return { ok: false, reason: "taken" };
    console.error("move failed:", res.error.message);
    return { ok: false, reason: "server" };
  }
  if ((res.data?.length ?? 0) === 0) return { ok: false, reason: "notfound" };

  return { ok: true, startAt: chosen.startAt };
}

export type DeletePatientResult =
  | { ok: true }
  | { ok: false; reason: "notfound" | "other_branch" | "server" };

// R3: deletes the patient behind one of this branch's appointments.
// The patient's appointments and SMS log rows are removed by the database (cascade).
// Refuses if the patient also has bookings at another branch.
export async function deleteBranchPatient(
  user: CurrentUser,
  appointmentId: string
): Promise<DeletePatientResult> {
  const branchId = ownBranchId(user);
  if (!UUID_RE.test(appointmentId)) return { ok: false, reason: "notfound" };

  const db = getSupabase();

  // Find the patient, but only through an appointment at the user's own branch.
  const apptRes = await db
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (apptRes.error) {
    console.error("delete lookup failed:", apptRes.error.message);
    return { ok: false, reason: "server" };
  }
  if (!apptRes.data) return { ok: false, reason: "notfound" };
  const patientId = (apptRes.data as { patient_id: string }).patient_id;

  // Do not let one branch erase data that another branch still uses.
  const otherRes = await db
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .neq("branch_id", branchId)
    .limit(1);
  if (otherRes.error) {
    console.error("delete check failed:", otherRes.error.message);
    return { ok: false, reason: "server" };
  }
  if ((otherRes.data?.length ?? 0) > 0) {
    return { ok: false, reason: "other_branch" };
  }

  const delRes = await db.from("patients").delete().eq("id", patientId);
  if (delRes.error) {
    console.error("patient delete failed:", delRes.error.message);
    return { ok: false, reason: "server" };
  }

  return { ok: true };
}
