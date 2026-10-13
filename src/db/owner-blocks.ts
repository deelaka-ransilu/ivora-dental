// Owner block queries (O3). Owner only. Server only.
// A block stops NEW bookings, because generateSlots reads blocked_times.
// It never cancels existing bookings.

import { getSupabase } from "@/lib/supabase-server";
import {
  addDaysToColomboDate,
  colomboDateString,
  colomboToDate,
  isColomboDate,
} from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BlockTarget = { kind: "branch" | "dentist"; id: string };

export type BlockInput = {
  target: BlockTarget;
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
  reason: string;
};

export type ParseResult =
  | { ok: true; value: BlockInput }
  | { ok: false; error: "target" | "date" | "time" | "order" };

export type WeekBlock = {
  id: string;
  kind: "branch" | "dentist";
  targetId: string;
  targetName: string;
  startAt: string;
  endAt: string;
  reason: string;
};

export type DentistChoice = { id: string; fullName: string };

// Supabase returns an embedded row as an object (or sometimes a one-item array).
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ownerOnly(user: CurrentUser): void {
  if (user.role !== "owner") {
    throw new Error("Not allowed: blocks need the owner login.");
  }
}

// Turns the form fields into a block. Used by the preview and by the save action,
// so both always agree.
export function parseBlockInput(raw: Record<string, string>): ParseResult {
  const m = /^(branch|dentist):([0-9a-f-]{36})$/i.exec(raw.target ?? "");
  if (!m || !UUID.test(m[2])) return { ok: false, error: "target" };

  const startDate = raw.startDate ?? "";
  if (!isColomboDate(startDate) || startDate < colomboDateString()) {
    return { ok: false, error: "date" };
  }

  let endDate = raw.endDate ?? "";
  let startTime = raw.startTime ?? "";
  let endTime = raw.endTime ?? "";

  if (raw.wholeDay === "1") {
    // Whole day: midnight to midnight, starting on startDate.
    endDate = addDaysToColomboDate(startDate, 1);
    startTime = "00:00";
    endTime = "00:00";
  } else {
    if (!isColomboDate(endDate)) return { ok: false, error: "date" };
    if (!TIME.test(startTime) || !TIME.test(endTime)) {
      return { ok: false, error: "time" };
    }
  }

  const start = colomboToDate(startDate, startTime);
  const end = colomboToDate(endDate, endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "date" };
  }
  if (end <= start) return { ok: false, error: "order" };

  return {
    ok: true,
    value: {
      target: { kind: m[1] as "branch" | "dentist", id: m[2] },
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: (raw.reason ?? "").trim().slice(0, 120),
    },
  };
}

export async function getAllDentists(
  user: CurrentUser
): Promise<DentistChoice[]> {
  ownerOnly(user);
  const res = await getSupabase()
    .from("dentists")
    .select("id, full_name")
    .order("full_name");
  if (res.error) throw new Error(res.error.message);
  return (res.data as { id: string; full_name: string }[]).map((d) => ({
    id: d.id,
    fullName: d.full_name,
  }));
}

// Blocks that touch the week starting at weekStart (a Colombo Monday).
export async function getWeekBlocks(
  user: CurrentUser,
  weekStart: string
): Promise<WeekBlock[]> {
  ownerOnly(user);
  if (!isColomboDate(weekStart)) return [];

  const from = colomboToDate(weekStart, "00:00").toISOString();
  const to = colomboToDate(
    addDaysToColomboDate(weekStart, 7),
    "00:00"
  ).toISOString();

  const res = await getSupabase()
    .from("blocked_times")
    .select(
      "id, start_at, end_at, reason, branch_id, dentist_id, branches(name), dentists(full_name)"
    )
    .lt("start_at", to)
    .gt("end_at", from)
    .order("start_at", { ascending: true });
  if (res.error) throw new Error(res.error.message);

  type Row = {
    id: string;
    start_at: string;
    end_at: string;
    reason: string | null;
    branch_id: string | null;
    dentist_id: string | null;
    branches: { name: string } | { name: string }[] | null;
    dentists: { full_name: string } | { full_name: string }[] | null;
  };

  return (res.data as unknown as Row[]).map((r) => {
    const isBranch = Boolean(r.branch_id);
    return {
      id: r.id,
      kind: isBranch ? "branch" : "dentist",
      targetId: (isBranch ? r.branch_id : r.dentist_id) ?? "",
      targetName: isBranch
        ? (first(r.branches)?.name ?? "")
        : (first(r.dentists)?.full_name ?? ""),
      startAt: r.start_at,
      endAt: r.end_at,
      reason: r.reason ?? "",
    };
  });
}

// How many booked appointments overlap this time, at the branch or for the dentist.
export async function countOverlappingBookings(
  user: CurrentUser,
  target: BlockTarget,
  startAt: string,
  endAt: string
): Promise<number> {
  ownerOnly(user);

  let query = getSupabase()
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "booked")
    .lt("start_at", endAt)
    .gt("end_at", startAt);
  query =
    target.kind === "branch"
      ? query.eq("branch_id", target.id)
      : query.eq("dentist_id", target.id);

  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export async function addBlock(
  user: CurrentUser,
  input: BlockInput
): Promise<boolean> {
  ownerOnly(user);
  const res = await getSupabase().from("blocked_times").insert({
    branch_id: input.target.kind === "branch" ? input.target.id : null,
    dentist_id: input.target.kind === "dentist" ? input.target.id : null,
    start_at: input.startAt,
    end_at: input.endAt,
    reason: input.reason || null,
    created_by: user.id,
  });
  if (res.error) {
    console.error("block insert failed:", res.error.message);
    return false;
  }
  return true;
}

export async function removeBlock(
  user: CurrentUser,
  id: string
): Promise<boolean> {
  ownerOnly(user);
  if (!UUID.test(id)) return false;
  const res = await getSupabase()
    .from("blocked_times")
    .delete()
    .eq("id", id)
    .select("id");
  if (res.error) throw new Error(res.error.message);
  return (res.data?.length ?? 0) > 0;
}
