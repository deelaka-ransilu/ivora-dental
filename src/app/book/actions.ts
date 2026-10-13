"use server";

// Public booking action. Anyone can call it, so everything is checked again here.
// The database exclusion constraint is still the real double-booking guard.

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase-server";
import { colomboDateString, formatDateTime } from "@/lib/format";
import { getAvailableSlots } from "@/db/booking";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function bookAppointment(formData: FormData) {
  const branchId = field(formData, "branch");
  const serviceId = field(formData, "service");
  const dentistFilter = field(formData, "dentist");
  const date = field(formData, "date");
  const slot = field(formData, "slot");
  const name = field(formData, "name");
  const phone = field(formData, "phone").replace(/[\s\-()]/g, "");
  const consent = formData.get("consent") === "on";

  // Send the visitor back to the same search, with an error code.
  const fail = (error: string): never => {
    const params = new URLSearchParams();
    if (branchId) params.set("branch", branchId);
    if (serviceId) params.set("service", serviceId);
    if (dentistFilter) params.set("dentist", dentistFilter);
    if (date) params.set("date", date);
    params.set("error", error);
    redirect(`/book?${params.toString()}`);
  };

  if (!slot) fail("slot");
  if (name.length < 2 || name.length > 80) fail("name");
  if (!/^(\+94|0)\d{9}$/.test(phone)) fail("phone");
  if (!consent) fail("consent");

  const [dentistId, startAt] = slot.split("|");
  if (
    !UUID.test(branchId) ||
    !UUID.test(serviceId) ||
    !UUID.test(dentistId ?? "") ||
    Number.isNaN(new Date(startAt ?? "").getTime())
  ) {
    fail("slot");
  }

  // Re-check that this exact time is still free (hours, closures, notice, other bookings).
  const free = await getAvailableSlots({
    isoDate: colomboDateString(startAt),
    branchId,
    serviceId,
    dentistId,
  });
  const chosen = free.find(
    (s) => new Date(s.startAt).getTime() === new Date(startAt).getTime()
  );
  if (!chosen) fail("taken");
  const booked = chosen!;

  const db = getSupabase();

  const patientRes = await db
    .from("patients")
    .insert({
      full_name: name,
      phone,
      consent_given_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (patientRes.error) {
    console.error("patient insert failed:", patientRes.error.message);
    fail("server");
  }
  const patientId = (patientRes.data as { id: string }).id;

  const apptRes = await db
    .from("appointments")
    .insert({
      patient_id: patientId,
      branch_id: branchId,
      dentist_id: dentistId,
      service_id: serviceId,
      start_at: booked.startAt,
      end_at: booked.endAt,
      status: "booked",
      source: "online",
      created_by: null,
    })
    .select("id")
    .single();

  if (apptRes.error) {
    // Undo the patient row so nothing is left behind.
    await db.from("patients").delete().eq("id", patientId);
    // 23P01 = the database refused an overlapping booking for this dentist.
    if (apptRes.error.code === "23P01") fail("taken");
    console.error("appointment insert failed:", apptRes.error.message);
    fail("server");
  }
  const appointmentId = (apptRes.data as { id: string }).id;

  // Simulated SMS: written to sms_log, nothing is really sent.
  const branchRes = await db
    .from("branches")
    .select("name, phone")
    .eq("id", branchId)
    .maybeSingle();
  const branch = (branchRes.data ?? null) as {
    name: string;
    phone: string;
  } | null;
  const first = name.split(" ")[0];
  const smsRes = await db.from("sms_log").insert({
    appointment_id: appointmentId,
    to_phone: phone,
    message: `Ivora Dental: Hi ${first}, your appointment at ${
      branch?.name ?? "our branch"
    } is booked for ${formatDateTime(booked.startAt)}. Please call ${
      branch?.phone ?? "the branch"
    } if you need to change it.`,
  });
  if (smsRes.error) {
    console.error("sms_log insert failed:", smsRes.error.message);
  }

  const done = new URLSearchParams({
    confirmed: "1",
    branch: branchId,
    service: serviceId,
    dentist: dentistId,
    start: booked.startAt,
  });
  redirect(`/book?${done.toString()}`);
}
