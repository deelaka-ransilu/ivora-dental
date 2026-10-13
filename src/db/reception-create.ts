// Creates a phone or walk-in booking at the receptionist's OWN branch.
// Server only. The branch always comes from the signed-in user, never from the form.

import { getSupabase } from "@/lib/supabase-server";
import { getAvailableSlots } from "@/db/booking";
import { colomboDateString } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

export type CreateBookingResult =
  | { ok: true; startAt: string }
  | { ok: false; reason: "taken" | "server" };

export async function createBranchBooking(
  user: CurrentUser,
  input: {
    serviceId: string;
    dentistId: string;
    startAt: string; // ISO timestamp of the chosen slot
    patientName: string;
    patientPhone: string;
    source: "phone" | "walk_in";
  }
): Promise<CreateBookingResult> {
  if (user.role !== "receptionist" || !user.branchId) {
    throw new Error("Not allowed: bookings need a receptionist with a branch.");
  }
  const branchId = user.branchId;

  // Re-check that this exact time is still free. Reception has no 2-hour notice rule.
  const free = await getAvailableSlots({
    isoDate: colomboDateString(input.startAt),
    branchId,
    serviceId: input.serviceId,
    dentistId: input.dentistId,
    minNoticeMinutes: 0,
  });
  const chosen = free.find(
    (s) => new Date(s.startAt).getTime() === new Date(input.startAt).getTime()
  );
  if (!chosen) return { ok: false, reason: "taken" };

  const db = getSupabase();

  const patientRes = await db
    .from("patients")
    .insert({
      full_name: input.patientName,
      phone: input.patientPhone,
      consent_given_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (patientRes.error) {
    console.error("patient insert failed:", patientRes.error.message);
    return { ok: false, reason: "server" };
  }
  const patientId = (patientRes.data as { id: string }).id;

  const apptRes = await db.from("appointments").insert({
    patient_id: patientId,
    branch_id: branchId,
    dentist_id: input.dentistId,
    service_id: input.serviceId,
    start_at: chosen.startAt,
    end_at: chosen.endAt,
    status: "booked",
    source: input.source,
    created_by: user.id,
  });

  if (apptRes.error) {
    // Undo the patient row so nothing is left behind.
    await db.from("patients").delete().eq("id", patientId);
    // 23P01 = the database refused an overlapping booking for this dentist.
    if (apptRes.error.code === "23P01") return { ok: false, reason: "taken" };
    console.error("appointment insert failed:", apptRes.error.message);
    return { ok: false, reason: "server" };
  }

  return { ok: true, startAt: chosen.startAt };
}
