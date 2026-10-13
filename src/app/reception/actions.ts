"use server";

// Reception actions. Every action checks the role first (architecture rule 2).

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  cancelBranchBooking,
  deleteBranchPatient,
  moveBranchBooking,
} from "@/db/reception";
import { createBranchBooking } from "@/db/reception-create";
import { colomboDateString, isColomboDate } from "@/lib/format";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function cancelBooking(formData: FormData) {
  const user = await requireRole(["receptionist"]);

  const id = field(formData, "id");
  const rawDate = field(formData, "date");
  const date = isColomboDate(rawDate) ? rawDate : colomboDateString();

  await cancelBranchBooking(user, id);

  redirect(`/reception?date=${date}`);
}

export async function addBooking(formData: FormData) {
  const user = await requireRole(["receptionist"]);

  const serviceId = field(formData, "service");
  const dentistFilter = field(formData, "dentist");
  const date = field(formData, "date");
  const slot = field(formData, "slot");
  const name = field(formData, "name");
  const phone = field(formData, "phone").replace(/[\s\-()]/g, "");
  const source = field(formData, "source");
  const agreed = formData.get("agreed") === "on";

  // Send the receptionist back to the same search, with an error code.
  const fail = (error: string): never => {
    const params = new URLSearchParams();
    if (serviceId) params.set("service", serviceId);
    if (dentistFilter) params.set("dentist", dentistFilter);
    if (date) params.set("date", date);
    params.set("error", error);
    redirect(`/reception/new?${params.toString()}`);
  };

  if (!slot) fail("slot");
  if (name.length < 2 || name.length > 80) fail("name");
  if (!/^(\+94|0)\d{9}$/.test(phone)) fail("phone");
  if (source !== "phone" && source !== "walk_in") fail("source");
  if (!agreed) fail("agreed");

  const [dentistId, startAt] = slot.split("|");
  if (
    !UUID.test(serviceId) ||
    !UUID.test(dentistId ?? "") ||
    Number.isNaN(new Date(startAt ?? "").getTime())
  ) {
    fail("slot");
  }

  const result = await createBranchBooking(user, {
    serviceId,
    dentistId,
    startAt,
    patientName: name,
    patientPhone: phone,
    source: source as "phone" | "walk_in",
  });
  if (!result.ok) return fail(result.reason);

  redirect(`/reception?date=${colomboDateString(result.startAt)}&added=1`);
}

// Move a booking to a new time (same service, same dentist, same branch).
// "date" is the day the receptionist searched on the move screen.
export async function moveBooking(formData: FormData) {
  const user = await requireRole(["receptionist"]);

  const id = field(formData, "id");
  const rawDate = field(formData, "date");
  const slot = field(formData, "slot"); // the new start time (ISO timestamp)

  // Send the receptionist back to the move screen, with an error code.
  const fail = (error: string): never => {
    const params = new URLSearchParams();
    params.set("id", id);
    if (isColomboDate(rawDate)) params.set("date", rawDate);
    params.set("error", error);
    redirect(`/reception/move?${params.toString()}`);
  };

  if (!UUID.test(id)) redirect("/reception?error=notfound");
  if (!slot || Number.isNaN(new Date(slot).getTime())) fail("slot");

  const result = await moveBranchBooking(user, id, slot);
  if (!result.ok) {
    if (result.reason === "notfound") redirect("/reception?error=notfound");
    return fail(result.reason);
  }

  redirect(`/reception?date=${colomboDateString(result.startAt)}&moved=1`);
}

// R3: delete a patient's data on request. Removes the patient and all their
// bookings. Refuses if the patient also has bookings at another branch.
export async function deletePatientData(formData: FormData) {
  const user = await requireRole(["receptionist"]);

  const id = field(formData, "id");
  const rawDate = field(formData, "date");
  const date = isColomboDate(rawDate) ? rawDate : colomboDateString();

  const result = await deleteBranchPatient(user, id);
  if (!result.ok) redirect(`/reception?date=${date}&error=${result.reason}`);

  redirect(`/reception?date=${date}&deleted=1`);
}
