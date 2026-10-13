// Booking queries: what the public booking page can show.
// Server only. Screens call these, not supabase directly.
// Nothing here returns patient data.

import { getSupabase } from "@/lib/supabase-server";
import {
  addDaysToColomboDate,
  colomboDayOfWeek,
  colomboToDate,
  isColomboDate,
} from "@/lib/format";
import {
  generateSlots,
  isDateBookable,
  type BlockedRange,
  type BusyRange,
  type Slot,
  type WorkingHours,
} from "@/lib/rules";

type BranchRow = { id: string; name: string; is_active?: boolean };
type DentistRow = { id: string; full_name: string; is_active?: boolean };
type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  is_active?: boolean;
};

export type BranchOption = { id: string; name: string };
export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
};
export type DentistOption = {
  id: string;
  fullName: string;
  serviceIds: string[];
  branchIds: string[];
};
export type BookingOptions = {
  branches: BranchOption[];
  services: ServiceOption[];
  dentists: DentistOption[];
};
export type AvailableSlot = Slot & { dentistName: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Branches, services and dentists the booking form can offer.
export async function getBookingOptions(): Promise<BookingOptions> {
  const db = getSupabase();

  const [branches, dentists, services, dentistServices, hours] =
    await Promise.all([
      db.from("branches").select("*").order("name"),
      db.from("dentists").select("*").order("full_name"),
      db.from("services").select("*").order("name"),
      db.from("dentist_services").select("dentist_id, service_id"),
      db.from("dentist_branch_hours").select("dentist_id, branch_id"),
    ]);

  for (const res of [branches, dentists, services, dentistServices, hours]) {
    if (res.error) throw new Error(res.error.message);
  }

  const serviceIdsByDentist = new Map<string, Set<string>>();
  for (const r of dentistServices.data as {
    dentist_id: string;
    service_id: string;
  }[]) {
    if (!serviceIdsByDentist.has(r.dentist_id)) {
      serviceIdsByDentist.set(r.dentist_id, new Set());
    }
    serviceIdsByDentist.get(r.dentist_id)!.add(r.service_id);
  }

  const branchIdsByDentist = new Map<string, Set<string>>();
  for (const r of hours.data as { dentist_id: string; branch_id: string }[]) {
    if (!branchIdsByDentist.has(r.dentist_id)) {
      branchIdsByDentist.set(r.dentist_id, new Set());
    }
    branchIdsByDentist.get(r.dentist_id)!.add(r.branch_id);
  }

  return {
    branches: (branches.data as BranchRow[])
      .filter((b) => b.is_active !== false)
      .map((b) => ({ id: b.id, name: b.name })),
    services: (services.data as ServiceRow[])
      .filter((s) => s.is_active !== false)
      .map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.duration_minutes,
      })),
    dentists: (dentists.data as DentistRow[])
      .filter((d) => d.is_active !== false)
      .map((d) => ({
        id: d.id,
        fullName: d.full_name,
        serviceIds: [...(serviceIdsByDentist.get(d.id) ?? [])],
        branchIds: [...(branchIdsByDentist.get(d.id) ?? [])],
      })),
  };
}

// Free start times for one date, branch and service (optionally one dentist).
// Returns [] for anything invalid or not bookable.
// minNoticeMinutes: leave out for online bookings (2 hours). Reception passes 0.
export async function getAvailableSlots(input: {
  isoDate: string;
  branchId: string;
  serviceId: string;
  dentistId?: string | null;
  minNoticeMinutes?: number;
}): Promise<AvailableSlot[]> {
  const { isoDate, branchId, serviceId } = input;
  const dentistId = input.dentistId || null;

  if (!isColomboDate(isoDate) || !isDateBookable(isoDate)) return [];
  if (!UUID.test(branchId) || !UUID.test(serviceId)) return [];
  if (dentistId && !UUID.test(dentistId)) return [];

  const db = getSupabase();

  const svcRes = await db
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();
  if (svcRes.error) throw new Error(svcRes.error.message);
  const service = svcRes.data as ServiceRow | null;
  if (!service || service.is_active === false) return [];

  let hoursQuery = db
    .from("dentist_branch_hours")
    .select("dentist_id, branch_id, start_time, end_time")
    .eq("branch_id", branchId)
    .eq("day_of_week", colomboDayOfWeek(isoDate));
  if (dentistId) hoursQuery = hoursQuery.eq("dentist_id", dentistId);

  const [hoursRes, offeredRes, dentistsRes] = await Promise.all([
    hoursQuery,
    db.from("dentist_services").select("dentist_id").eq("service_id", serviceId),
    db.from("dentists").select("*"),
  ]);
  for (const res of [hoursRes, offeredRes, dentistsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const offered = new Set(
    (offeredRes.data as { dentist_id: string }[]).map((r) => r.dentist_id)
  );
  const dentistNames = new Map<string, string>();
  for (const d of dentistsRes.data as DentistRow[]) {
    if (d.is_active !== false) dentistNames.set(d.id, d.full_name);
  }

  const hours: WorkingHours[] = (
    hoursRes.data as {
      dentist_id: string;
      branch_id: string;
      start_time: string;
      end_time: string;
    }[]
  )
    .filter((h) => offered.has(h.dentist_id) && dentistNames.has(h.dentist_id))
    .map((h) => ({
      dentistId: h.dentist_id,
      branchId: h.branch_id,
      startTime: h.start_time,
      endTime: h.end_time,
    }));
  if (hours.length === 0) return [];

  const dentistIds = [...new Set(hours.map((h) => h.dentistId))];
  const dayStart = colomboToDate(isoDate, "00:00").toISOString();
  const dayEnd = colomboToDate(addDaysToColomboDate(isoDate, 1), "00:00").toISOString();

  // Booked appointments for these dentists in ANY branch (a dentist cannot be in two places).
  const apptRes = await db
    .from("appointments")
    .select("dentist_id, start_at, end_at")
    .eq("status", "booked")
    .in("dentist_id", dentistIds)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);
  if (apptRes.error) throw new Error(apptRes.error.message);

  // Closures for this branch, or for any of these dentists. All ids are checked UUIDs.
  const blockedRes = await db
    .from("blocked_times")
    .select("branch_id, dentist_id, start_at, end_at")
    .or(`branch_id.eq.${branchId},dentist_id.in.(${dentistIds.join(",")})`)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);
  if (blockedRes.error) throw new Error(blockedRes.error.message);

  const appointments: BusyRange[] = (
    apptRes.data as { dentist_id: string; start_at: string; end_at: string }[]
  ).map((a) => ({
    dentistId: a.dentist_id,
    startAt: a.start_at,
    endAt: a.end_at,
  }));

  const blocked: BlockedRange[] = (
    blockedRes.data as {
      branch_id: string | null;
      dentist_id: string | null;
      start_at: string;
      end_at: string;
    }[]
  ).map((b) => ({
    branchId: b.branch_id,
    dentistId: b.dentist_id,
    startAt: b.start_at,
    endAt: b.end_at,
  }));

  return generateSlots({
    isoDate,
    branchId,
    durationMinutes: service.duration_minutes,
    hours,
    appointments,
    blocked,
    minNoticeMinutes: input.minNoticeMinutes,
  }).map((s) => ({
    ...s,
    dentistName: dentistNames.get(s.dentistId) ?? "",
  }));
}
