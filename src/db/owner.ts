// Owner queries. Owner only (architecture rule 7). Server only.
// Read-only in this step (O1). The owner can see patient phone numbers.

import { getSupabase } from "@/lib/supabase-server";
import {
  addDaysToColomboDate,
  colomboToDate,
  isColomboDate,
} from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

export type OwnerBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: "booked" | "cancelled";
  source: "online" | "phone" | "walk_in";
  branchId: string;
  branchName: string;
  dentistName: string;
  serviceName: string;
  patientName: string;
  patientPhone: string;
};

export type BranchChoice = { id: string; name: string };

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ownerOnly(user: CurrentUser): void {
  if (user.role !== "owner") {
    throw new Error("Not allowed: owner data needs the owner login.");
  }
}

export async function getAllBranches(
  user: CurrentUser
): Promise<BranchChoice[]> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("branches")
    .select("id, name")
    .order("name");
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as BranchChoice[];
}

// All appointments in the 7 days starting at weekStart (a Colombo Monday),
// optionally limited to one branch. Cancelled ones are included so the page
// can count them.
export async function getWeekBookings(
  user: CurrentUser,
  weekStart: string,
  branchId: string | null
): Promise<OwnerBooking[]> {
  ownerOnly(user);
  if (!isColomboDate(weekStart)) return [];

  const from = colomboToDate(weekStart, "00:00").toISOString();
  const to = colomboToDate(
    addDaysToColomboDate(weekStart, 7),
    "00:00"
  ).toISOString();

  let query = getSupabase()
    .from("appointments")
    .select(
      "id, start_at, end_at, status, source, branch_id, patients(full_name, phone), dentists(full_name), services(name), branches(name)"
    )
    .gte("start_at", from)
    .lt("start_at", to)
    .order("start_at", { ascending: true });
  if (branchId) query = query.eq("branch_id", branchId);

  const res = await query;
  if (res.error) throw new Error(res.error.message);

  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    status: "booked" | "cancelled";
    source: "online" | "phone" | "walk_in";
    branch_id: string;
    patients:
      | { full_name: string; phone: string }
      | { full_name: string; phone: string }[]
      | null;
    dentists: { full_name: string } | { full_name: string }[] | null;
    services: { name: string } | { name: string }[] | null;
    branches: { name: string } | { name: string }[] | null;
  };

  return (res.data as unknown as Row[]).map((r) => ({
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    source: r.source,
    branchId: r.branch_id,
    branchName: first(r.branches)?.name ?? "",
    dentistName: first(r.dentists)?.full_name ?? "",
    serviceName: first(r.services)?.name ?? "",
    patientName: first(r.patients)?.full_name ?? "",
    patientPhone: first(r.patients)?.phone ?? "",
  }));
}
